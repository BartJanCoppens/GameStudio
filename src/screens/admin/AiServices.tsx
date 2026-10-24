import { useCallback, useEffect, useState } from 'react';
import { Banner, Button, Dialog, Field, Input, LinkButton, Select, StatusChip, type Status } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import { callFunction, errorMessage, supabase } from '../../lib/supabase';
import { GROUP_LABELS, PROVIDERS, openAiBase, type ProviderDef, type ProviderGroup } from '../../../supabase/functions/_shared/providers.ts';
import { PageHead, Screen } from '../../shell/ui';
import { card } from '../../shell/styles';

/** A row of public.ai_services as the browser sees it: never the key, only its last four characters. */
interface ServiceRow {
  id: string;
  scope: 'platform' | 'game';
  game_key: string | null;
  provider: string;
  enabled: boolean;
  address: string | null;
  model: string | null;
  models: string[];
  key_hint: string | null;
  test_status: 'ok' | 'failed' | null;
  test_message: string | null;
  tested_at: string | null;
}

type Scope = 'platform' | 'game';
const COLUMNS = 'id, scope, game_key, provider, enabled, address, model, models, key_hint, test_status, test_message, tested_at';

function useServices() {
  const [rows, setRows] = useState<ServiceRow[] | null>(null);
  const [assistant, setAssistant] = useState<{ provider?: string; model?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchAll = () => Promise.all([
    supabase.from('ai_services').select(COLUMNS).returns<ServiceRow[]>(),
    supabase.from('ai_settings').select('value').eq('key', 'studio_assistant').maybeSingle(),
  ]);
  const apply = useCallback(([s, a]: Awaited<ReturnType<typeof fetchAll>>) => {
    if (s.error) setError(s.error.message);
    else { setRows(s.data ?? []); setError(null); }
    setAssistant((a.data?.value as { provider?: string; model?: string } | undefined) ?? null);
  }, []);
  const reload = useCallback(async () => apply(await fetchAll()), [apply]);
  useEffect(() => {
    let cancelled = false;
    fetchAll().then(r => { if (!cancelled) apply(r); });
    return () => { cancelled = true; };
  }, [apply]);
  return { rows, assistant, error, reload };
}

const hasKey = (def: ProviderDef, row?: ServiceRow) => Boolean(row) && (def.auth !== 'key' || Boolean(row?.key_hint));

/** The chip next to a provider: is it usable, and whose key does it use. */
function statusOf(def: ProviderDef, scope: Scope, own?: ServiceRow, platform?: ServiceRow): { st: Status; label: string } {
  const describe = (row: ServiceRow, ready: string) =>
    row.test_status === 'failed' ? { st: 'clarification' as const, label: 'Test failed' } : { st: 'accepted' as const, label: ready };
  if (own && hasKey(def, own)) return describe(own, scope === 'game' ? 'Own key' : def.auth === 'none' ? 'Set up' : 'Ready');
  if (scope === 'game' && platform && hasKey(def, platform)) return { st: 'submitted', label: 'Uses platform key' };
  if (def.auth === 'none') return { st: 'na', label: 'No key needed' };
  return { st: 'not-started', label: 'Not set up' };
}

/** Local servers (Ollama, LM Studio) are only reachable from this browser, so they are tested here. */
async function testLocally(def: ProviderDef, address: string | null): Promise<{ ok: boolean; message: string; models: string[] }> {
  const base = openAiBase(def, address);
  try {
    const r = await fetch(`${base}/models`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return { ok: false, message: `${def.name} answered HTTP ${r.status}`, models: [] };
    const body = await r.json() as { data?: { id: string }[] };
    const models = (body.data ?? []).map(m => m.id);
    return { ok: true, message: `Connected · ${models.length} models on this computer`, models };
  } catch {
    return { ok: false, message: `Couldn’t reach ${def.name} at ${base}. Is it running, and does it allow requests from this page (for Ollama: OLLAMA_ORIGINS)?`, models: [] };
  }
}

function ServiceDialog({ def, scope, gameKey, row, onClose, onSaved }: { def: ProviderDef; scope: Scope; gameKey?: string; row?: ServiceRow; onClose: () => void; onSaved: (msg: string) => void }) {
  const [key, setKey] = useState('');
  const [address, setAddress] = useState(row?.address ?? def.defaultAddress ?? '');
  const [model, setModel] = useState(row?.model ?? '');
  const [models, setModels] = useState<string[]>(row?.models ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const needsAddress = def.local || def.id === 'other';
  const isModel = def.group === 'model';

  const run = async (work: () => Promise<string | void>) => {
    setBusy(true); setError(null);
    try { const msg = await work(); if (msg) onSaved(msg); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const save = () => run(async () => {
    if (!row && def.auth === 'key' && !key.trim()) throw new Error('Paste the API key');
    await callFunction('ai-services', {
      action: 'save', scope, game_key: gameKey, provider: def.id,
      ...(key.trim() ? { key: key.trim() } : {}),
      ...(needsAddress ? { address } : {}),
      ...(isModel ? { model } : {}),
      ...(def.local ? { models } : {}),
    });
    return `${def.name} saved${scope === 'game' ? ' for this game' : ''}`;
  });
  const remove = () => run(async () => {
    await callFunction('ai-services', { action: 'remove', scope, game_key: gameKey, provider: def.id });
    return `${def.name} removed${scope === 'game' ? ' from this game' : ''}`;
  });
  const findLocalModels = () => run(async () => {
    const r = await testLocally(def, address);
    setNote(r.message);
    if (r.ok) { setModels(r.models); if (!model && r.models[0]) setModel(r.models[0]); }
  });

  return (
    <Dialog
      title={`${def.name}${scope === 'game' ? ' · this game' : ''}`}
      subtitle={def.description}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <Button variant="primary" size="xl" onClick={() => void save()} disabled={busy}>Save</Button>
          <Button variant="secondary" size="xl" onClick={onClose} disabled={busy}>Cancel</Button>
          {row ? <LinkButton tone="muted" onClick={() => void remove()} style={{ marginLeft: 'auto' }}>Remove</LinkButton> : null}
        </>
      }
    >
      {error ? <Banner tone="warning">{error}</Banner> : null}
      {scope === 'game' ? <div style={{ fontSize: 12.5, color: '#5a6058' }}>This game uses the key below instead of the platform’s. Usage is billed to the account behind it.</div> : null}
      {def.auth !== 'none' ? (
        <Field label={row?.key_hint ? `API key (now ends in …${row.key_hint})` : def.auth === 'optional' ? 'API key (if the server needs one)' : 'API key'} hint="Stored encrypted. Nobody can read it back, including you: paste a new one to change it.">
          <Input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder={row?.key_hint ? 'Leave empty to keep the current key' : 'Paste the key'} />
        </Field>
      ) : null}
      {needsAddress ? (
        <Field label="Address" hint={def.local ? 'Where the server runs on this computer' : 'The OpenAI-compatible base URL, https only'}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder={def.defaultAddress ?? 'https://api.example.com/v1'} />
            {def.local ? <Button variant="secondary" size="lg" onClick={() => void findLocalModels()} disabled={busy}>Find models</Button> : null}
          </div>
        </Field>
      ) : null}
      {note ? <div style={{ fontSize: 12.5, color: '#5a6058' }}>{note}</div> : null}
      {isModel ? (
        <Field label="Default model" hint={models.length ? `${models.length} models available · or type a model id` : 'Test the key to list the available models, or type a model id'}>
          <Input list={`models-${def.id}`} value={model} onChange={e => setModel(e.target.value)} placeholder="Model id" />
          <datalist id={`models-${def.id}`}>{models.map(m => <option key={m} value={m} />)}</datalist>
        </Field>
      ) : null}
    </Dialog>
  );
}

function AssistantCard({ rows, assistant, onSaved }: { rows: ServiceRow[]; assistant: { provider?: string; model?: string } | null; onSaved: (msg: string) => void }) {
  const ready = PROVIDERS.filter(p => p.studio && hasKey(p, rows.find(r => r.scope === 'platform' && r.provider === p.id)));
  const [picked, setPicked] = useState(assistant?.provider ?? '');
  // Falls back to the first ready provider, which may appear only after the card was first drawn.
  const provider = ready.some(p => p.id === picked) ? picked : ready[0]?.id ?? '';
  const [model, setModel] = useState(assistant?.model ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const row = rows.find(r => r.scope === 'platform' && r.provider === provider);
  const current = assistant?.provider ? `${PROVIDERS.find(p => p.id === assistant.provider)?.name ?? assistant.provider} · ${assistant.model}` : 'Not chosen: Claude with the project’s fallback key, if there is one';

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await callFunction('ai-services', { action: 'set_assistant', provider, model: model || row?.model || '' });
      onSaved('Studio assistant updated');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontWeight: 600 }}>Studio assistant</div>
        <div style={{ fontSize: 12.5, color: '#5a6058', marginTop: 2 }}>The model behind “Draft with AI” in the Studio. It can only work on the game being edited. Now: {current}</div>
      </div>
      {error ? <Banner tone="warning">{error}</Banner> : null}
      {ready.length ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="Provider" size="sm" style={{ minWidth: 200 }}>
            <Select value={provider} onChange={e => { setPicked(e.target.value); setModel(''); }} options={ready.map(p => ({ value: p.id, label: p.name }))} />
          </Field>
          <Field label="Model" size="sm" style={{ minWidth: 260, flex: 1 }}>
            <Input list="assistant-models" value={model} onChange={e => setModel(e.target.value)} placeholder={row?.model ?? 'Model id'} />
            <datalist id="assistant-models">{(row?.models ?? []).map(m => <option key={m} value={m} />)}</datalist>
          </Field>
          <Button variant="dark" size="lg" onClick={() => void save()} disabled={busy || !provider}>Use for the Studio</Button>
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: '#7a5000' }}>Add a key for a language model below first. Models on this computer (Ollama, LM Studio) can’t run it: the assistant runs on the server.</div>
      )}
    </div>
  );
}

/** Model, avatar and voice providers with their keys, for the platform or for one game. */
export function AiServicesPanel({ scope, gameKey }: { scope: Scope; gameKey?: string }) {
  const { toast } = useApp();
  const { rows, assistant, error, reload } = useServices();
  const [editing, setEditing] = useState<ProviderDef | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const own = (id: string) => rows?.find(r => r.provider === id && r.scope === scope && (scope === 'platform' || r.game_key === gameKey));
  const platform = (id: string) => rows?.find(r => r.provider === id && r.scope === 'platform');

  const saved = async (msg: string) => { setEditing(null); toast(msg); await reload(); };
  const test = async (def: ProviderDef) => {
    setTesting(def.id);
    try {
      const row = own(def.id) ?? (scope === 'game' ? platform(def.id) : undefined);
      const result = def.local
        ? await testLocally(def, row?.address ?? null)
        : await callFunction<{ ok: boolean; message: string }>('ai-services', { action: 'test', scope, game_key: gameKey, provider: def.id });
      toast(`${def.name}: ${result.message}`);
      await reload();
    } catch (e) {
      toast(`${def.name}: ${errorMessage(e)}`);
    } finally {
      setTesting(null);
    }
  };

  if (error) return <Banner tone="warning" title="Could not load AI services.">{error}</Banner>;
  if (!rows) return <div style={{ color: '#8b918a' }}>Loading…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {scope === 'platform' ? <AssistantCard key={JSON.stringify(assistant)} rows={rows} assistant={assistant} onSaved={msg => void saved(msg)} /> : null}
      {(['model', 'avatar', 'voice'] as ProviderGroup[]).map(group => (
        <div key={group} style={card}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #eef0ea', fontWeight: 600 }}>{GROUP_LABELS[group]}</div>
          {PROVIDERS.filter(p => p.group === group).map((def, i) => {
            const mine = own(def.id), fallback = platform(def.id);
            const st = statusOf(def, scope, mine, fallback);
            const shown = mine ?? (scope === 'game' ? fallback : undefined);
            // Only keys set at this scope are tested here; the platform's keys are tested on the platform screen.
            const canTest = def.local ? Boolean(shown || def.defaultAddress) : Boolean(mine);
            return (
              <div key={def.id} style={{ padding: '12px 18px', borderTop: i ? '1px solid #eef0ea' : 0, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{def.name}</span>
                    <StatusChip status={st.st} label={st.label} size="xs" />
                  </div>
                  <div style={{ fontSize: 12.5, color: '#5a6058', marginTop: 2 }}>{def.description}</div>
                  {shown ? (
                    <div style={{ fontSize: 11.5, color: '#8b918a', marginTop: 2 }}>
                      {[shown.key_hint ? `key …${shown.key_hint}` : null, shown.address, shown.model ? `model ${shown.model}` : null, shown.test_message ? `${shown.test_message}${shown.tested_at ? ` · ${new Date(shown.tested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}` : null].filter(Boolean).join(' · ')}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {(() => {
                    const action = def.local ? 'Address…' : mine ? (def.auth === 'key' ? 'Change key…' : 'Change…') : def.id === 'other' ? 'Set up…' : scope === 'game' ? 'Use own key…' : 'Add key…';
                    return <LinkButton onClick={() => setEditing(def)} aria-label={`${def.name}: ${action}`}>{action}</LinkButton>;
                  })()}
                  {canTest ? <Button variant="secondary" size="md" onClick={() => void test(def)} disabled={testing === def.id} aria-label={`Test ${def.name}`}>{testing === def.id ? 'Testing…' : 'Test'}</Button> : null}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <div style={{ fontSize: 12, color: '#8b918a' }}>
        Keys are stored encrypted in Supabase Vault and used only on the server. {scope === 'platform' ? 'A game administrator can give their game its own key per provider; the game then uses that one.' : 'Without its own key, this game uses the platform’s.'}
      </div>
      {editing ? <ServiceDialog def={editing} scope={scope} gameKey={gameKey} row={own(editing.id)} onClose={() => setEditing(null)} onSaved={msg => void saved(msg)} /> : null}
    </div>
  );
}

export function AiServicesScreen() {
  const { permissions } = useSignedIn();
  return (
    <Screen label="Admin · AI services">
      <PageHead title="AI services" lead="Models, avatars and voices the platform and its games can use · keys are stored encrypted and never shown again" />
      {permissions.has('ai.manage') ? <AiServicesPanel scope="platform" /> : <Banner tone="info">You need “Manage AI services and keys” to see this page.</Banner>}
    </Screen>
  );
}
