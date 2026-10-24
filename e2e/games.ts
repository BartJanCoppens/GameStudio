import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { adminClient, emailFor, password, type E2eRole } from './accounts';

// Helpers for tests that set up games directly, without the AI.

export const tinyGame = () => JSON.parse(readFileSync('e2e/fixtures/tiny-game.json', 'utf8'));

function env() {
  process.loadEnvFile('.env.local');
  return { url: process.env.VITE_SUPABASE_URL!, key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY! };
}

/** A browser-like client signed in as one of the e2e accounts. */
export async function userClient(role: E2eRole): Promise<{ client: SupabaseClient; token: string; userId: string }> {
  const { url, key } = env();
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: emailFor(role), password: password() });
  if (error) throw error;
  return { client, token: data.session!.access_token, userId: data.user!.id };
}

/** Calls an Edge Function as an e2e account; returns the status and parsed body. */
export async function callAs(role: E2eRole, fn: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const { url, key } = env();
  const { token } = await userClient(role);
  const res = await fetch(`${url}/functions/v1/${fn}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/** A game owned by the e2e creator with the given draft; optionally checked and published (no AI involved). */
export async function seedGame(title: string, content: unknown, opts: { secret?: object; publish?: boolean } = {}): Promise<string> {
  const { client } = await userClient('creator');
  const key = `e2e-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
  const games = await client.from('games').insert({ key, title }).select('key');
  if (games.error) throw games.error;
  const draft = await client.from('game_content').insert({ game_key: key, stage: 'draft', content });
  if (draft.error) throw draft.error;
  if (opts.secret) {
    const s = await client.from('game_secrets').insert({ game_key: key, stage: 'draft', ai: opts.secret });
    if (s.error) throw s.error;
  }
  if (opts.publish) {
    const admin = adminClient();
    const { data: fingerprint, error } = await admin.rpc('draft_fingerprint', { p_game_key: key });
    if (error) throw error;
    const check = await admin.from('game_checks').insert({ game_key: key, fingerprint, passed: true, reasons: [] });
    if (check.error) throw check.error;
    const pub = await client.rpc('publish_game', { p_game_key: key });
    if (pub.error) throw pub.error;
  }
  return key;
}
