// Row shapes of the tables in supabase/migrations/*_user_and_role_management.sql.

export interface RoleRow {
  key: string;
  name: string;
  short_name: string;
  description: string;
  is_system: boolean;
  sort_order: number;
  created_at: string;
}

export interface PermissionRow {
  key: string;
  name: string;
  category: string;
  sort_order: number;
}

/** 1 = granted, 2 = partial. A missing row means not granted. */
export type GrantLevel = 1 | 2;

export interface RolePermissionRow {
  role_key: string;
  permission_key: string;
  level: GrantLevel;
}

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  cohort: string;
  status: 'active' | 'deactivated';
  last_sign_in_at: string | null;
  created_at: string;
}

export interface UserRoleRow {
  user_id: string;
  role_key: string;
}

/** Permissions the Platform admin role can never lose (enforced by a trigger too). */
export const LOCKED_ADMIN_PERMISSIONS = ['users.manage', 'roles.manage'];

export const byRoleOrder = (a: RoleRow, b: RoleRow) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
