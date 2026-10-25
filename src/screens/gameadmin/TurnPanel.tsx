import { useEffect, useState } from 'react';
import { Button, Field, Input } from '../../ds';
import { useApp } from '../../app/useApp';
import type { GameConcept } from '../../game/content';
import type { GameMeta } from '../../game/games';
import type { MatchRow } from '../../game/matches';
import { errorMessage, supabase } from '../../lib/supabase';
import { card, cardHead } from '../../shell/styles';
import { intervalSeconds } from '../../game/turns';

/** A turn-taking game's settings and games, for its game admin: how long without a move, who played whom. */
export function TurnPanel({ game, concept }: { game: GameMeta; concept: GameConcept }) {
  const { toast } = useApp();
  const [days, setDays] = useState('');
  // The fields stay disabled until the saved values arrive, so typing can't be overwritten by them.
  const [loaded, setLoaded] = useState(false);
  const [minutes, setMinutes] = useState('');
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.from('games').select('turn_limit_async, turn_limit_live').eq('key', game.key).maybeSingle().then(({ data }) => {
      if (cancelled || !data) return;
      setDays(String(Math.round((intervalSeconds(data.turn_limit_async as string) / 86400) * 10) / 10));
      setMinutes(String(Math.round(intervalSeconds(data.turn_limit_live as string) / 60)));
      setLoaded(true);
    });
    supabase.from('matches').select('*').eq('game_key', game.key).eq('status', 'finished').order('finished_at', { ascending: false }).limit(50)
      .returns<MatchRow[]>().then(({ data }) => { if (!cancelled) setMatches(data ?? []); });
    return () => { cancelled = true; };
  }, [game.key]);

  const save = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc('set_turn_limits', { p_game_key: game.key, p_async: `${Number(days) * 24} hours`, p_live: `${Number(minutes)} minutes` });
      if (error) throw error;
      toast('Limits saved');
    } catch (e) { toast(errorMessage(e)); } finally { setBusy(false); }
  };
  const valid = Number(days) > 0 && Number(days) <= 30 && Number(minutes) >= 1 && Number(minutes) <= 1440;

  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ ...card, flex: '0 1 360px', display: 'flex', flexDirection: 'column' }}>
        <div style={cardHead}>Longest time without a move</div>
        <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, color: 'var(--tc-ink-3)' }}>After this, a game between colleagues is cancelled and counts for nothing.</div>
          <Field label="Turn by turn, in days"><Input type="number" min={0.1} max={30} step={0.5} value={days} disabled={!loaded} onChange={e => setDays(e.target.value)} /></Field>
          <Field label="Live, in minutes"><Input type="number" min={1} max={1440} step={1} value={minutes} disabled={!loaded} onChange={e => setMinutes(e.target.value)} /></Field>
          <div><Button variant="primary" size="md" disabled={busy || !valid} onClick={() => void save()}>Save limits</Button></div>
        </div>
      </div>
      {concept.turns?.results ? (
        <div style={{ ...card, flex: '1 1 420px' }}>
          <div style={cardHead}>Games between colleagues</div>
          {!matches ? <div style={{ padding: 18, color: 'var(--tc-ink-5)' }}>Loading…</div> : null}
          {matches && !matches.length ? <div style={{ padding: 18, color: 'var(--tc-ink-5)' }}>No finished games yet.</div> : null}
          {matches?.map(m => (
            <div key={m.id} style={{ padding: '10px 18px', borderTop: '1px solid var(--tc-line-hair)', fontSize: 13.5 }}>
              {m.a_name} – {m.b_name} · {m.winner === null ? 'a draw' : `${m.winner === 'a' ? m.a_name : m.b_name} won`}
              <span style={{ color: 'var(--tc-ink-5)' }}> · {m.finished_at ? new Date(m.finished_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
