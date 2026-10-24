// Helpers shared by the Edge Functions: CORS, errors, the admin client, the caller and their permissions.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

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

export const adminClient = (): SupabaseClient =>
  createClient(Deno.env.get('SUPABASE_URL')!, secretKey(), { auth: { persistSession: false, autoRefreshToken: false } });

/** A client that acts as the caller (their token, row level security applies): for checks the database owns. */
export const userClient = (req: Request): SupabaseClient =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

export interface Caller {
  id: string;
  permissions: Set<string>;
}

/** The signed-in, active caller and the permissions their roles grant (level 1). */
export async function caller(admin: SupabaseClient, req: Request): Promise<Caller> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Sign in first');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Sign in first');
  const id = data.user.id;
  const { data: profile } = await admin.from('profiles').select('status').eq('id', id).single();
  if (profile?.status !== 'active') throw new HttpError(403, 'Your account is deactivated');
  const { data: roles } = await admin.from('user_roles').select('role_key').eq('user_id', id);
  const roleKeys = (roles ?? []).map(r => r.role_key as string);
  if (!roleKeys.length) return { id, permissions: new Set() };
  const { data: grants } = await admin.from('role_permissions').select('permission_key').in('role_key', roleKeys).eq('level', 1);
  return { id, permissions: new Set((grants ?? []).map(g => g.permission_key as string)) };
}

export function requirePermission(c: Caller, permission: string, label: string) {
  if (!c.permissions.has(permission)) throw new HttpError(403, `You need “${label}”`);
}

export interface Game {
  key: string;
  title: string;
  created_by: string | null;
}

/** The game a request names; 404 when it doesn't exist. */
export async function gameOf(admin: SupabaseClient, key: unknown): Promise<Game> {
  if (typeof key !== 'string' || !/^[a-z0-9][a-z0-9-]{2,59}$/.test(key)) throw new HttpError(400, 'Say which game (game_key)');
  const { data } = await admin.from('games').select('key, title, created_by').eq('key', key).maybeSingle<Game>();
  if (!data) throw new HttpError(404, 'That game no longer exists');
  return data;
}

/** Same rule as private.can_edit_game: its creator or a platform admin. */
export function requireEditable(c: Caller, game: Game) {
  requirePermission(c, 'games.create', 'Create a game in the Studio');
  if (game.created_by !== c.id && !c.permissions.has('users.manage')) throw new HttpError(403, 'Only the game’s creator can edit it');
}

/** True for addresses that aren't on the public internet, parsed numerically (IPv4 and IPv6). */
export function isPrivateIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const h = ip.toLowerCase();
  // IPv4-mapped or -compatible IPv6 (::ffff:10.0.0.1, ::10.0.0.1): judge the IPv4 part.
  const mapped = h.match(/^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isPrivateIp(mapped[1]);
  if (h === '::' || h === '::1') return true;
  // Prefixes that translate to IPv4 and could reach a private IPv4 address: NAT64 (64:ff9b::/96,
  // 64:ff9b:1::/48), 6to4 (2002::/16), Teredo (2001:0::/32); and documentation (2001:db8::/32).
  if (/^64:ff9b:/.test(h) || /^2002:/.test(h) || /^2001:(0{0,4}:|db8:)/.test(h)) return true;
  const first = parseInt(h.split(':')[0] || '0', 16);
  return (first & 0xfe00) === 0xfc00 /* fc00::/7 */ || (first & 0xffc0) === 0xfe80 /* fe80::/10 */ || (first & 0xff00) === 0xff00 /* multicast */ || h.startsWith('::ffff:');
}

/**
 * Right before the server calls a custom address: resolve its name and refuse if any address it points
 * at is private. Checked per call, so a name that is re-pointed later is caught on the next call.
 */
export async function assertPublicTarget(address: string) {
  assertPublicHttps(address);
  const host = new URL(address).hostname.replace(/^\[|\]$/g, '');
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    if (isPrivateIp(host)) throw new HttpError(400, 'The address must be a public server, not this computer or a private network');
    return;
  }
  const resolved: string[] = [];
  for (const type of ['A', 'AAAA'] as const) {
    try { resolved.push(...await Deno.resolveDns(host, type)); } catch { /* no records of this type */ }
  }
  if (!resolved.length) throw new HttpError(400, `Couldn’t find ${host}`);
  if (resolved.some(isPrivateIp)) throw new HttpError(400, 'The address points to a private network');
}

/**
 * Addresses the server may call on an admin's behalf: https only, and not this machine or a private
 * network (so a custom provider address can't be used to probe Supabase's own infrastructure).
 */
export function assertPublicHttps(address: string) {
  let url: URL;
  try { url = new URL(address); } catch { throw new HttpError(400, 'Enter a full address, like https://api.example.com/v1'); }
  if (url.protocol !== 'https:') throw new HttpError(400, 'The address must start with https://');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const privateHost =
    host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) ||
    (host.includes(':') && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80'))) ||
    (!host.includes('.') && !host.includes(':'));
  if (privateHost) throw new HttpError(400, 'The address must be a public server, not this computer or a private network');
}
