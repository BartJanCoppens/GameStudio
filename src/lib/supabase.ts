import { createClient, FunctionsHttpError } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** False until .env.local names a Supabase project; the app then shows setup steps instead of the login. */
export const supabaseConfigured = Boolean(url && key);

// The publishable (or legacy anon) key is meant for browsers: every query runs under row level security.
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing-key');

/** Calls the admin-users Edge Function and surfaces its error message. */
export async function adminUsers<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('admin-users', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error ?? error.message);
    }
    throw error;
  }
  return data as T;
}

/** Turns a Supabase/Postgres error into a sentence for a toast. */
export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') return e.message;
  return 'Something went wrong';
}
