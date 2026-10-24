import { useEffect, useState } from 'react';
import { Banner, Button, Dialog, Field, Textarea } from '../../ds';
import { contrastChecks, designUsable, type DesignTokens } from '../../../supabase/functions/_shared/design.ts';
import { DesignSpecimen } from '../../game/DesignSpecimen';
import { callFunction, errorMessage, supabase } from '../../lib/supabase';

/** A look chosen for a game: copied into the game's concept. id: the design system it came from. */
export interface GameDesign {
  id: string | null;
  name: string;
  tokens: DesignTokens;
}

interface DesignRow {
  id: string;
  name: string;
  description: string;
  tokens: DesignTokens;
  library: boolean;
}

interface AiDesign {
  status: 'design' | 'out_of_scope';
  reply: string;
  name: string;
  description: string;
  tokens: DesignTokens;
}

const LOOK_EXAMPLE = 'Bold and friendly for young graduates: deep purple accent, soft lilac page, rounded corners.';

interface Props {
  gameKey: string;
  gameTitle: string;
  current: GameDesign | undefined;
  userId: string;
  onClose: () => void;
  /** undefined = back to the TaxConnect default. */
  onApply: (design: GameDesign | undefined) => Promise<void>;
}

/** Choose how the game looks to players: a preset from the library, one of your own, or a new one made with AI. */
export function LookDialog({ gameKey, gameTitle, current, userId, onClose, onApply }: Props) {
  const [designs, setDesigns] = useState<DesignRow[] | null>(null);
  const [prompt, setPrompt] = useState('');
  const [made, setMade] = useState<AiDesign | null>(null);
  const [busy, setBusy] = useState<null | 'designing' | 'applying'>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.from('design_systems').select('id, name, description, tokens, library').order('library', { ascending: false }).order('created_at').returns<DesignRow[]>()
      .then(({ data, error: e }) => { if (!cancelled) { setDesigns(data ?? []); if (e) setError(e.message); } });
    return () => { cancelled = true; };
  }, []);

  const apply = async (design: GameDesign | undefined) => {
    setBusy('applying');
    setError(null);
    try { await onApply(design); } catch (e) { setError(errorMessage(e)); setBusy(null); }
  };

  const design = async () => {
    if (prompt.trim().length < 5) { setError('Describe the look in a few words.'); return; }
    setBusy('designing');
    setError(null);
    try {
      const r = await callFunction<AiDesign>('design-ai', { prompt: prompt.trim(), game_key: gameKey, ...(made ? { base: made.tokens } : {}) });
      if (r.status !== 'design') setError(r.reply || 'The AI only designs the look of games.');
      else setMade(r);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  /** A made design is saved to "my designs" so it can be reused for other games. */
  const applyMade = async () => {
    if (!made) return;
    setBusy('applying');
    setError(null);
    try {
      const { data, error: e } = await supabase.from('design_systems').insert({ name: made.name || 'My design', description: made.description, tokens: made.tokens, library: false, owner_id: userId }).select('id').single();
      if (e) throw e;
      await onApply({ id: data.id, name: made.name || 'My design', tokens: made.tokens });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  };

  const checks = made ? contrastChecks(made.tokens) : [];
  const usable = made ? designUsable(made.tokens) : false;
  const choice = (key: string, name: string, description: string, tokens: DesignTokens | undefined, design: GameDesign | undefined, selected: boolean) => (
    <button
      key={key}
      type="button"
      onClick={() => void apply(design)}
      disabled={!!busy}
      aria-pressed={selected}
      aria-label={`Use the look ${name}`}
      style={{ textAlign: 'left', font: 'inherit', color: 'inherit', background: '#fff', border: `${selected ? 2 : 1}px solid ${selected ? 'var(--tc-ink)' : 'var(--tc-line-soft)'}`, borderRadius: 8, padding: selected ? 7 : 8, cursor: busy ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <DesignSpecimen tokens={tokens} title={gameTitle} compact />
      <div style={{ padding: '0 2px' }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{name}{selected ? ' · in use' : ''}</div>
        <div style={{ fontSize: 12, color: 'var(--tc-ink-3)' }}>{description}</div>
      </div>
    </button>
  );

  const library = (designs ?? []).filter(d => d.library);
  const mine = (designs ?? []).filter(d => !d.library);

  return (
    <Dialog
      title="Choose a look"
      subtitle="How the game looks to players: colours, fonts and corners. The look is part of the draft and goes live when you publish."
      onClose={busy ? undefined : onClose}
      width={820}
      footer={<Button variant="secondary" size="xl" onClick={onClose} disabled={!!busy}>Close</Button>}
    >
      {error ? <Banner tone="warning">{error}</Banner> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
        {choice('default', 'TaxConnect', 'The platform’s own look.', undefined, undefined, !current)}
        {library.map(d => choice(d.id, d.name, d.description, d.tokens, { id: d.id, name: d.name, tokens: d.tokens }, current?.id === d.id))}
        {mine.map(d => choice(d.id, d.name, d.description || 'One of your designs.', d.tokens, { id: d.id, name: d.name, tokens: d.tokens }, current?.id === d.id))}
      </div>

      <div style={{ borderTop: '1px solid var(--tc-line-hair)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field label={made ? 'Change it' : 'Or describe a look and let the AI design it'} hint={made ? 'Describe what to change; the AI starts from the design above.' : `e.g. ${LOOK_EXAMPLE}`}>
          <Textarea value={prompt} onChange={e => setPrompt(e.target.value.slice(0, 1000))} rows={2} placeholder={LOOK_EXAMPLE} disabled={!!busy} />
        </Field>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button variant={made ? 'secondary' : 'primary'} size="lg" onClick={() => void design()} disabled={!!busy}>{busy === 'designing' ? 'Designing…' : made ? 'Change with AI' : 'Design with AI'}</Button>
          {busy === 'designing' ? <span role="status" style={{ fontSize: 12.5, color: 'var(--tc-ink-3)' }}>Usually 10–20 seconds</span> : null}
        </div>
        {made ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <DesignSpecimen tokens={made.tokens} title={gameTitle} />
              <div style={{ fontWeight: 600 }}>{made.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--tc-ink-3)' }}>{made.reply}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tc-ink-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Readability (WCAG AA)</div>
              {checks.map(c => (
                <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: c.ok ? 'var(--tc-ink)' : c.blocking ? 'var(--tc-red-text)' : 'var(--tc-ink-3)' }}>
                  <span>{c.ok ? '✓' : c.blocking ? '✕' : '!'} {c.label}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{c.ratio.toFixed(1)} : 1 (min {c.min})</span>
                </div>
              ))}
              {!usable ? <div style={{ fontSize: 12.5, color: 'var(--tc-red-text)' }}>Some text would be hard to read. Ask the AI to fix the contrast.</div> : null}
              <Button variant="primary" size="lg" onClick={() => void applyMade()} disabled={!!busy || !usable} style={{ alignSelf: 'flex-start', marginTop: 4 }}>Use this look</Button>
            </div>
          </div>
        ) : null}
      </div>
      {designs === null ? <div style={{ color: 'var(--tc-ink-5)' }}>Loading looks…</div> : null}
      {busy === 'applying' ? <div role="status" style={{ color: 'var(--tc-ink-3)' }}>Applying…</div> : null}
    </Dialog>
  );
}
