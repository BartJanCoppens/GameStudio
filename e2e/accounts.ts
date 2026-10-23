import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

// Throwaway accounts for one test session: e2e-<role>@deloitte.com, one per built-in role.
export const ROLES = ['player', 'creator', 'gameadmin', 'admin'] as const;
export type E2eRole = (typeof ROLES)[number];
export const emailFor = (role: E2eRole) => `e2e-${role}@deloitte.com`;
export const PREFIX = 'e2e-';

/** The admin client from .env.seed (URL + secret key); never reaches the browser. */
export function adminClient() {
  if (existsSync('.env.seed')) process.loadEnvFile('.env.seed');
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error('e2e needs SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.seed.example)');
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const PASSWORD_FILE = 'e2e/.password';
export const password = () => readFileSync(PASSWORD_FILE, 'utf8').trim();

/** Deletes every e2e-* account; their profiles, roles and runs go with them. */
export async function deleteE2eAccounts() {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  for (const u of data.users.filter(x => x.email?.startsWith(PREFIX))) {
    const { error: e } = await admin.auth.admin.deleteUser(u.id);
    if (e) throw e;
  }
}
