// Stored AI services: finding the one to use (a game's own key before the platform's) and testing a key.
import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import { openAiBase, providerById, type ProviderDef } from './providers.ts';
import { HttpError, assertPublicTarget } from './server.ts';

export interface ServiceRow {
  id: string;
  scope: 'platform' | 'game';
  game_key: string | null;
  provider: string;
  enabled: boolean;
  address: string | null;
  model: string | null;
  secret_id: string | null;
}

export interface ResolvedService {
  def: ProviderDef;
  row: ServiceRow;
  key: string | null;
}

export async function secretOf(admin: SupabaseClient, row: ServiceRow): Promise<string | null> {
  if (!row.secret_id) return null;
  const { data, error } = await admin.rpc('ai_secret_get', { p_service: row.id });
  if (error) throw new HttpError(500, 'Could not read the stored key');
  return (data as string | null) ?? null;
}

/** The provider as set up for this game, else as set up for the platform; null when neither is usable. */
export async function resolveService(admin: SupabaseClient, provider: string, gameKey: string | null): Promise<ResolvedService | null> {
  const def = providerById(provider);
  if (!def) return null;
  const { data } = await admin.from('ai_services').select('id, scope, game_key, provider, enabled, address, model, secret_id').eq('provider', provider).returns<ServiceRow[]>();
  const rows = (data ?? []).filter(r => r.enabled);
  const usable = (r: ServiceRow) => def.auth !== 'key' || Boolean(r.secret_id);
  const row = rows.find(r => r.scope === 'game' && r.game_key === gameKey && usable(r)) ?? rows.find(r => r.scope === 'platform' && usable(r));
  if (!row) return null;
  return { def, row, key: await secretOf(admin, row) };
}

export interface TestResult {
  ok: boolean;
  message: string;
  models: string[];
}

const TIMEOUT = 15_000;
const MAX_MODELS = 300;

async function get(url: string, headers: Record<string, string>): Promise<Response> {
  let r: Response;
  try {
    // No redirects: a public address must not bounce the server to a private one.
    r = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT) });
  } catch {
    throw new HttpError(502, 'Couldn’t reach the provider');
  }
  if (r.status >= 300 && r.status < 400) throw new HttpError(502, 'The provider answered with a redirect; use the final address');
  return r;
}

const rejected = (r: Response): TestResult => ({
  ok: false,
  message: r.status === 401 || r.status === 403 ? 'The key was rejected' : `The provider answered HTTP ${r.status}`,
  models: [],
});

/** A cheap, read-only call that proves the key works; for model providers it also lists the models. */
export async function testService(def: ProviderDef, key: string | null, address: string | null): Promise<TestResult> {
  if (def.local) throw new HttpError(400, `${def.name} runs on your computer; test it from your browser`);
  if (def.auth === 'key' && !key) return { ok: false, message: 'No key set', models: [] };

  switch (def.api) {
    case 'anthropic': {
      const client = new Anthropic({ apiKey: key!, maxRetries: 0, timeout: TIMEOUT });
      try {
        const models: string[] = [];
        for await (const m of client.models.list()) {
          models.push(m.id);
          if (models.length >= MAX_MODELS) break;
        }
        return { ok: true, message: `Connected · ${models.length} models`, models };
      } catch (e) {
        if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return { ok: false, message: 'The key was rejected', models: [] };
        if (e instanceof Anthropic.APIError) return { ok: false, message: `Anthropic answered HTTP ${e.status ?? 'error'}`, models: [] };
        return { ok: false, message: 'Couldn’t reach Anthropic', models: [] };
      }
    }
    case 'openai': {
      const base = openAiBase(def, address);
      if (!base) return { ok: false, message: 'No address set', models: [] };
      // A custom address is re-checked against DNS right before the call.
      if (!def.baseUrl) await assertPublicTarget(base);
      const auth: Record<string, string> = key ? { Authorization: `Bearer ${key}` } : {};
      // OpenRouter lists its models without a key, so check the key itself first.
      if (def.id === 'openrouter') {
        const k = await get(`${base}/key`, auth);
        if (!k.ok) return rejected(k);
      }
      const r = await get(`${base}/models`, auth);
      if (!r.ok) return rejected(r);
      const body = await r.json().catch(() => null) as { data?: { id?: string }[] } | null;
      const models = (body?.data ?? []).map(m => String(m.id ?? '')).filter(Boolean).slice(0, MAX_MODELS);
      return { ok: true, message: `Connected · ${models.length} models`, models };
    }
    case 'heygen': {
      const r = await get('https://api.heygen.com/v3/users/me', { 'X-Api-Key': key! });
      return r.ok ? { ok: true, message: 'Connected', models: [] } : rejected(r);
    }
    case 'liveavatar': {
      const r = await get('https://api.liveavatar.com/v1/users/credits', { 'X-API-KEY': key! });
      return r.ok ? { ok: true, message: 'Connected', models: [] } : rejected(r);
    }
    case 'elevenlabs': {
      const r = await get('https://api.elevenlabs.io/v1/user', { 'xi-api-key': key! });
      return r.ok ? { ok: true, message: 'Connected', models: [] } : rejected(r);
    }
  }
}
