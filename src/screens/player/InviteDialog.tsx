import { useEffect, useState } from 'react';
import { Banner, Button, Dialog, Input } from '../../ds';
import { useApp } from '../../app/useApp';
import type { TurnsConfig } from '../../game/content';
import { callMatch } from '../../game/matches';
import { errorMessage, supabase } from '../../lib/supabase';

interface Colleague { id: string; full_name: string }

/** Invite a colleague who may also play this game; live or turn by turn when the game allows both. */
export function InviteDialog({ gameKey, title, turns, onClose }: { gameKey: string; title: string; turns: TurnsConfig; onClose: () => void }) {
  const { go, toast } = useApp();
  const [colleagues, setColleagues] = useState<Colleague[] | null>(null);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const [way, setWay] = useState<'live' | 'async'>(turns.ways.includes('async') ? 'async' : 'live');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('match_candidates', { p_game_key: gameKey }).then(({ data, error: e }) => {
      if (cancelled) return;
      if (e) setError(errorMessage(e));
      setColleagues((data ?? []) as Colleague[]);
    });
    return () => { cancelled = true; };
  }, [gameKey]);

  const shown = (colleagues ?? []).filter(c => c.full_name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 12);
  const send = async () => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      await callMatch('invite', { game_key: gameKey, invitee: chosen, way });
      toast(`Invitation sent to ${colleagues?.find(c => c.id === chosen)?.full_name ?? 'your colleague'}`);
      onClose();
      go('library');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog
      title={`Invite a colleague to ${title}`}
      subtitle="Only colleagues who may play this game are listed."
      onClose={busy ? undefined : onClose}
      footer={<><Button variant="primary" size="xl" disabled={busy || !chosen} onClick={() => void send()}>{busy ? 'Sending…' : 'Send invitation'}</Button><Button variant="secondary" size="xl" disabled={busy} onClick={onClose}>Cancel</Button></>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Input aria-label="Find a colleague" placeholder="Find a colleague…" value={query} onChange={e => setQuery(e.target.value)} autoFocus />
        <div role="radiogroup" aria-label="Colleague" style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflow: 'auto' }}>
          {colleagues === null ? <span style={{ color: 'var(--tc-ink-5)' }}>Loading…</span> : null}
          {colleagues && !shown.length ? <span style={{ color: 'var(--tc-ink-5)' }}>Nobody found.</span> : null}
          {shown.map(c => (
            <label key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
              <input type="radio" name="colleague" checked={chosen === c.id} onChange={() => setChosen(c.id)} style={{ accentColor: 'var(--tc-green)' }} />
              <span>{c.full_name}</span>
            </label>
          ))}
        </div>
        {turns.ways.length > 1 ? (
          <div role="radiogroup" aria-label="How to play" style={{ display: 'flex', gap: 16 }}>
            {(['live', 'async'] as const).map(w => (
              <label key={w} style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input type="radio" name="way" checked={way === w} onChange={() => setWay(w)} style={{ accentColor: 'var(--tc-green)' }} />
                <span>{w === 'live' ? `Live · ${turns.turnSeconds} s a turn` : 'Turn by turn'}</span>
              </label>
            ))}
          </div>
        ) : null}
        {error ? <Banner tone="warning">{error}</Banner> : null}
      </div>
    </Dialog>
  );
}
