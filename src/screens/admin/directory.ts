import { useCallback, useEffect, useState } from 'react';
import { errorMessage, supabase } from '../../lib/supabase';
import { byRoleOrder, type PermissionRow, type ProfileRow, type RolePermissionRow, type RoleRow, type UserRoleRow } from '../../lib/db';
import type { Status } from '../../ds';

export interface DirectoryUser extends ProfileRow {
  roleKeys: string[];
}

export interface Directory {
  users: DirectoryUser[];
  roles: RoleRow[];
  permissions: PermissionRow[];
  grants: RolePermissionRow[];
}

async function fetchDirectory(): Promise<Directory> {
  const [profiles, assignments, roles, permissions, grants] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name').returns<ProfileRow[]>(),
    supabase.from('user_roles').select('user_id, role_key').returns<UserRoleRow[]>(),
    supabase.from('roles').select('*').returns<RoleRow[]>(),
    supabase.from('permissions').select('*').order('sort_order').returns<PermissionRow[]>(),
    supabase.from('role_permissions').select('*').returns<RolePermissionRow[]>(),
  ]);
  const failed = [profiles, assignments, roles, permissions, grants].find(r => r.error);
  if (failed?.error) throw failed.error;

  const roleList = (roles.data ?? []).sort(byRoleOrder);
  const order = new Map(roleList.map((r, i) => [r.key, i]));
  const byUser = new Map<string, string[]>();
  for (const a of assignments.data ?? []) byUser.set(a.user_id, [...(byUser.get(a.user_id) ?? []), a.role_key]);
  return {
    users: (profiles.data ?? []).map(p => ({ ...p, roleKeys: (byUser.get(p.id) ?? []).sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)) })),
    roles: roleList,
    permissions: permissions.data ?? [],
    grants: grants.data ?? [],
  };
}

/** Users, roles and the permission matrix, as the signed-in user's RLS lets them see it. */
export function useDirectory() {
  const [data, setData] = useState<Directory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setData(await fetchDirectory());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetchDirectory().then(
      d => { if (!cancelled) setData(d); },
      e => { if (!cancelled) setError(errorMessage(e)); },
    );
    return () => { cancelled = true; };
  }, []);
  return { data, error, reload, setData };
}

export function userStatus(u: ProfileRow): { st: Status; label: string } {
  if (u.status === 'deactivated') return { st: 'not-started', label: 'Deactivated' };
  if (!u.last_sign_in_at) return { st: 'submitted', label: 'Not signed in yet' };
  return { st: 'accepted', label: 'Active' };
}

export const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—');

/** A temporary password that meets the project policy: 14 characters with upper, lower and digits. */
export function generatePassword(): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789'];
  const all = sets.join('');
  const pick = (chars: string) => chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
  const out = [...sets.map(pick), ...Array.from({ length: 11 }, () => pick(all))];
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join('');
}
