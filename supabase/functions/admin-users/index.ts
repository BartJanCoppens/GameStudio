// admin-users: the account operations that need the secret key.
//   create        { email, password, full_name, cohort, roles }   → new account, no email sent
//   set_status    { user_id, status: 'active' | 'deactivated' }   → also blocks or restores sign-in
//   set_password  { user_id, password }
// Callers must hold "Manage users and invitations" (users.manage), and may only hand out roles,
// or act on users, whose permissions they hold themselves. Role assignments and profile edits
// go straight to the tables under RLS (same rule there); they don't need this function.
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

/** Permission keys granted (level 1) by these roles. */
async function permissionsOfRoles(admin: SupabaseClient, roleKeys: string[]): Promise<Set<string>> {
  if (!roleKeys.length) return new Set();
  const { data, error } = await admin.from('role_permissions').select('permission_key').in('role_key', roleKeys).eq('level', 1);
  if (error) throw new HttpError(500, error.message);
  return new Set((data ?? []).map(r => r.permission_key as string));
}

async function permissionsOfUser(admin: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data, error } = await admin.from('user_roles').select('role_key').eq('user_id', userId);
  if (error) throw new HttpError(500, error.message);
  return permissionsOfRoles(admin, (data ?? []).map(r => r.role_key as string));
}

interface Caller {
  id: string;
  permissions: Set<string>;
}

async function requireUserManager(admin: SupabaseClient, req: Request): Promise<Caller> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Sign in first');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Sign in first');
  const id = data.user.id;

  const { data: profile } = await admin.from('profiles').select('status').eq('id', id).single();
  if (profile?.status !== 'active') throw new HttpError(403, 'Your account is deactivated');

  const permissions = await permissionsOfUser(admin, id);
  if (!permissions.has('users.manage')) throw new HttpError(403, 'You need the “Manage users and invitations” permission');
  return { id, permissions };
}

/**
 * No escalation (the same rule the database applies to role assignments): a caller may only hand out,
 * or act on someone holding, permissions they hold themselves.
 */
function requireCovers(caller: Caller, needed: Set<string>, what: string) {
  const missing = [...needed].filter(p => !caller.permissions.has(p));
  if (missing.length) throw new HttpError(403, `You can’t ${what}: it involves permissions you don’t hold (${missing.join(', ')})`);
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

async function createUser(admin: SupabaseClient, caller: Caller, body: Record<string, unknown>) {
  const email = requireString(body, 'email').toLowerCase();
  if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email address');
  const password = requirePassword(body);
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const cohort = typeof body.cohort === 'string' ? body.cohort.trim() : '';
  const roles = Array.isArray(body.roles) ? body.roles.filter((r): r is string => typeof r === 'string') : [];
  if (!roles.length) throw new HttpError(400, 'Give the user at least one role');
  requireCovers(caller, await permissionsOfRoles(admin, roles), 'give these roles');

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

async function setStatus(admin: SupabaseClient, caller: Caller, body: Record<string, unknown>) {
  const userId = requireString(body, 'user_id');
  const status = body.status;
  if (status !== 'active' && status !== 'deactivated') throw new HttpError(400, 'status must be active or deactivated');
  requireCovers(caller, await permissionsOfUser(admin, userId), status === 'deactivated' ? 'deactivate this user' : 'reactivate this user');

  if (status === 'deactivated') {
    if (userId === caller.id) throw new HttpError(400, 'You cannot deactivate your own account');
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

async function setPassword(admin: SupabaseClient, caller: Caller, body: Record<string, unknown>) {
  const userId = requireString(body, 'user_id');
  const password = requirePassword(body);
  requireCovers(caller, await permissionsOfUser(admin, userId), 'reset this user’s password');
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) throw new HttpError(400, error.message);
  return { id: userId };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, secretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const caller = await requireUserManager(admin, req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    switch (body.action) {
      case 'create': return json(200, await createUser(admin, caller, body));
      case 'set_status': return json(200, await setStatus(admin, caller, body));
      case 'set_password': return json(200, await setPassword(admin, caller, body));
      default: return json(400, { error: 'Unknown action' });
    }
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    console.error(e);
    return json(500, { error: 'Unexpected error' });
  }
});
