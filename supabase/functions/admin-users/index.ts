// admin-users: the account operations that need the secret key.
//   create        { email, password, full_name, cohort, roles }   → new account, no email sent
//   set_status    { user_id, status: 'active' | 'deactivated' }   → also blocks or restores sign-in
//   set_password  { user_id, password }
// Callers must hold "Manage users and invitations" (users.manage). Role assignments and
// profile edits go straight to the tables under RLS; they don't need this function.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 10;
const BANNED_FOR = '876000h'; // ~100 years: "until reactivated"

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

function secretKey(): string {
  // Hosted projects expose the new secret keys as a JSON map; older and local setups use the legacy key.
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>;
    const key = parsed.default ?? Object.values(parsed)[0];
    if (key) return key;
  }
  const key = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new HttpError(500, 'Function is missing its secret key');
  return key;
}

async function requireUserManager(admin: SupabaseClient, req: Request): Promise<string> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Sign in first');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Sign in first');
  const uid = data.user.id;

  const { data: profile } = await admin.from('profiles').select('status').eq('id', uid).single();
  if (profile?.status !== 'active') throw new HttpError(403, 'Your account is deactivated');

  const { data: roles } = await admin.from('user_roles').select('role_key').eq('user_id', uid);
  const roleKeys = (roles ?? []).map(r => r.role_key as string);
  if (roleKeys.length) {
    const { count } = await admin
      .from('role_permissions')
      .select('role_key', { count: 'exact', head: true })
      .in('role_key', roleKeys)
      .eq('permission_key', 'users.manage')
      .eq('level', 1);
    if (count) return uid;
  }
  throw new HttpError(403, 'You need the “Manage users and invitations” permission');
}

function requireString(body: Record<string, unknown>, key: string): string {
  const v = body[key];
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `Missing ${key}`);
  return v.trim();
}

function requirePassword(body: Record<string, unknown>): string {
  const pw = body.password;
  if (typeof pw !== 'string' || pw.length < MIN_PASSWORD) throw new HttpError(400, `Password must be at least ${MIN_PASSWORD} characters`);
  return pw;
}

async function createUser(admin: SupabaseClient, body: Record<string, unknown>) {
  const email = requireString(body, 'email').toLowerCase();
  if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email address');
  const password = requirePassword(body);
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const cohort = typeof body.cohort === 'string' ? body.cohort.trim() : '';
  const roles = Array.isArray(body.roles) ? body.roles.filter((r): r is string => typeof r === 'string') : [];
  if (!roles.length) throw new HttpError(400, 'Give the user at least one role');

  // email_confirm: the account works straight away and no email goes out.
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !data.user) throw new HttpError(error?.status === 422 ? 409 : 400, error?.message ?? 'Could not create the user');
  const id = data.user.id;

  const { error: profileError } = await admin.from('profiles').update({ full_name: fullName, cohort }).eq('id', id);
  const { error: rolesError } = profileError ? { error: profileError } : await admin.from('user_roles').insert(roles.map(role_key => ({ user_id: id, role_key })));
  if (rolesError) {
    await admin.auth.admin.deleteUser(id);
    throw new HttpError(400, rolesError.message);
  }
  return { id };
}

async function setStatus(admin: SupabaseClient, callerId: string, body: Record<string, unknown>) {
  const userId = requireString(body, 'user_id');
  const status = body.status;
  if (status !== 'active' && status !== 'deactivated') throw new HttpError(400, 'status must be active or deactivated');

  if (status === 'deactivated') {
    if (userId === callerId) throw new HttpError(400, 'You cannot deactivate your own account');
    const { data: isAdmin } = await admin.from('user_roles').select('user_id').eq('user_id', userId).eq('role_key', 'admin').maybeSingle();
    if (isAdmin) {
      const { data: admins } = await admin.from('user_roles').select('user_id, profiles!inner(status)').eq('role_key', 'admin').eq('profiles.status', 'active');
      if ((admins ?? []).filter(a => a.user_id !== userId).length === 0) throw new HttpError(400, 'At least one active platform admin is required');
    }
  }

  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: status === 'deactivated' ? BANNED_FOR : 'none' });
  if (banError) throw new HttpError(400, banError.message);
  const { error } = await admin.from('profiles').update({ status }).eq('id', userId);
  if (error) throw new HttpError(400, error.message);
  return { id: userId, status };
}

async function setPassword(admin: SupabaseClient, body: Record<string, unknown>) {
  const userId = requireString(body, 'user_id');
  const password = requirePassword(body);
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) throw new HttpError(400, error.message);
  return { id: userId };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, secretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const callerId = await requireUserManager(admin, req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    switch (body.action) {
      case 'create': return json(200, await createUser(admin, body));
      case 'set_status': return json(200, await setStatus(admin, callerId, body));
      case 'set_password': return json(200, await setPassword(admin, body));
      default: return json(400, { error: 'Unknown action' });
    }
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    console.error(e);
    return json(500, { error: 'Unexpected error' });
  }
});
