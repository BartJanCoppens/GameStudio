// ai-services: set up, test and remove AI providers and their keys, for the platform or one game.
//   save           { scope, provider, key?, address?, model?, enabled?, models? }
//   remove         { scope, provider }
//   test           { scope, provider }
//   set_assistant  { provider, model }      which provider and model the Studio assistant uses
// Platform scope needs "Manage AI services and keys" (ai.manage); game scope needs "Set AI services
// for a game" (ai.game). Keys go into Supabase Vault and never come back to the browser.
import { providerById } from '../_shared/providers.ts';
import { secretOf, testService, type ServiceRow } from '../_shared/ai.ts';
import { CORS, HttpError, adminClient, assertPublicTarget, caller, gameOf, json, requirePermission, type Caller } from '../_shared/server.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';

const PUBLIC_COLUMNS = 'id, scope, game_key, provider, enabled, address, model, models, key_hint, test_status, test_message, tested_at, updated_at';

type Body = Record<string, unknown>;

async function scopeOf(admin: SupabaseClient, body: Body, c: Caller): Promise<{ scope: 'platform' | 'game'; gameKey: string | null }> {
  if (body.scope === 'platform') {
    requirePermission(c, 'ai.manage', 'Manage AI services and keys');
    return { scope: 'platform', gameKey: null };
  }
  if (body.scope === 'game') {
    requirePermission(c, 'ai.game', 'Set AI services for a game');
    return { scope: 'game', gameKey: (await gameOf(admin, body.game_key)).key };
  }
  throw new HttpError(400, 'scope must be platform or game');
}

function providerOf(body: Body) {
  const def = typeof body.provider === 'string' ? providerById(body.provider) : undefined;
  if (!def) throw new HttpError(400, 'Unknown provider');
  return def;
}

async function findRow(admin: SupabaseClient, scope: string, gameKey: string | null, provider: string): Promise<ServiceRow | null> {
  let q = admin.from('ai_services').select('id, scope, game_key, provider, enabled, address, model, secret_id').eq('scope', scope).eq('provider', provider);
  q = gameKey ? q.eq('game_key', gameKey) : q.is('game_key', null);
  const { data } = await q.maybeSingle<ServiceRow>();
  return data;
}

async function save(admin: SupabaseClient, c: Caller, body: Body) {
  const { scope, gameKey } = await scopeOf(admin, body, c);
  const def = providerOf(body);
  const patch: Record<string, unknown> = { updated_by: c.id, updated_at: new Date().toISOString() };

  let key: string | null = null;
  if (typeof body.key === 'string' && body.key.trim()) {
    if (def.auth === 'none') throw new HttpError(400, `${def.name} doesn’t use a key`);
    key = body.key.trim();
    if (key.length > 500 || /\s/.test(key)) throw new HttpError(400, 'That doesn’t look like an API key');
    patch.key_hint = key.slice(-4);
  }
  if (body.address !== undefined) {
    const address = typeof body.address === 'string' ? body.address.trim().replace(/\/+$/, '') : '';
    if (address) {
      if (def.local) {
        if (!/^https?:\/\/[^\s]+$/.test(address)) throw new HttpError(400, 'Enter an address like http://localhost:11434');
      } else if (def.id === 'other') {
        await assertPublicTarget(address);
      } else {
        throw new HttpError(400, `${def.name} has a fixed address`);
      }
    }
    patch.address = address || null;
  }
  if (body.model !== undefined) {
    const model = typeof body.model === 'string' ? body.model.trim() : '';
    if (model.length > 200) throw new HttpError(400, 'Model name is too long');
    patch.model = model || null;
  }
  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
  // Local providers are tested from the browser, which then saves the models it found.
  if (def.local && Array.isArray(body.models)) patch.models = body.models.filter((m): m is string => typeof m === 'string').slice(0, 300);
  // A new key or address means the last test no longer says anything.
  if (key || body.address !== undefined) Object.assign(patch, { test_status: null, test_message: null, tested_at: null });

  const existing = await findRow(admin, scope, gameKey, def.id);
  const { data: row, error } = existing
    ? await admin.from('ai_services').update(patch).eq('id', existing.id).select('id').single()
    : await admin.from('ai_services').insert({ scope, game_key: gameKey, provider: def.id, ...patch }).select('id').single();
  if (error || !row) throw new HttpError(400, error?.message ?? 'Could not save');
  if (key) {
    const { error: e } = await admin.rpc('ai_secret_set', { p_service: row.id, p_secret: key });
    if (e) throw new HttpError(500, 'Could not store the key');
  }
  const { data } = await admin.from('ai_services').select(PUBLIC_COLUMNS).eq('id', row.id).single();
  return data;
}

async function remove(admin: SupabaseClient, c: Caller, body: Body) {
  const { scope, gameKey } = await scopeOf(admin, body, c);
  const def = providerOf(body);
  const row = await findRow(admin, scope, gameKey, def.id);
  if (row) await admin.from('ai_services').delete().eq('id', row.id); // the trigger deletes the Vault secret
  return { removed: Boolean(row) };
}

async function test(admin: SupabaseClient, c: Caller, body: Body) {
  const { scope, gameKey } = await scopeOf(admin, body, c);
  const def = providerOf(body);
  const row = await findRow(admin, scope, gameKey, def.id);
  if (!row) throw new HttpError(400, `${def.name} isn’t set up yet`);
  const result = await testService(def, await secretOf(admin, row), row.address);
  await admin.from('ai_services').update({
    test_status: result.ok ? 'ok' : 'failed',
    test_message: result.message.slice(0, 300),
    tested_at: new Date().toISOString(),
    ...(result.ok && result.models.length ? { models: result.models } : {}),
  }).eq('id', row.id);
  return result;
}

async function setAssistant(admin: SupabaseClient, c: Caller, body: Body) {
  requirePermission(c, 'ai.manage', 'Manage AI services and keys');
  const def = providerOf(body);
  if (!def.studio) throw new HttpError(400, `${def.name} can’t run the Studio assistant`);
  const model = typeof body.model === 'string' ? body.model.trim() : '';
  if (!model || model.length > 200) throw new HttpError(400, 'Choose a model');
  const { error } = await admin.from('ai_settings').upsert({ key: 'studio_assistant', value: { provider: def.id, model }, updated_by: c.id, updated_at: new Date().toISOString() });
  if (error) throw new HttpError(400, error.message);
  return { provider: def.id, model };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  try {
    const admin = adminClient();
    const c = await caller(admin, req);
    const body = (await req.json().catch(() => ({}))) as Body;
    switch (body.action) {
      case 'save': return json(200, await save(admin, c, body));
      case 'remove': return json(200, await remove(admin, c, body));
      case 'test': return json(200, await test(admin, c, body));
      case 'set_assistant': return json(200, await setAssistant(admin, c, body));
      default: return json(400, { error: 'Unknown action' });
    }
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    console.error(e);
    return json(500, { error: 'Unexpected error' });
  }
});
