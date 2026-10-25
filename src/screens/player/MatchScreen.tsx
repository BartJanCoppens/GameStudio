import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '../../ds';
import { useApp } from '../../app/useApp';
import type { MakeMove, Side } from '../../game/bridge/protocol';
import type { GameContent } from '../../game/content';
import { GameFrame } from '../../game/GameFrame';
import { callMatch, otherName, viewOf, type MatchRow } from '../../game/matches';
import { ThemeScope } from '../../game/theme';
import { errorMessage, supabase } from '../../lib/supabase';
import { BackLink, Screen } from '../../shell/ui';

interface Loaded { match: MatchRow; you: Side; mine: unknown; content: GameContent }

/** Seconds left on the live turn, ticking. */
function useSecondsLeft(until: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [until]);
  return until ? Math.max(0, Math.ceil((new Date(until).getTime() - now) / 1000)) : null;
}

/** One turn-taking game with a colleague: the game in its frame, kept in step with the other player. */
export function MatchScreen() {
  const { s, go } = useApp();
  const id = s.matchId;
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try { setData(await callMatch<Loaded>('get', { match_id: id })); setError(null); } catch (e) { setError(errorMessage(e)); }
  }, [id]);

  // Open: a live game counts this player as present; then follow the match as it changes.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const first = await callMatch<Loaded>('get', { match_id: id }).catch(e => { setError(errorMessage(e)); return null; });
      if (!first || cancelled) return;
      if (first.match.way === 'live' && first.match.status === 'waiting') await callMatch('ready', { match_id: id }).catch(() => null);
      if (!cancelled) await load();
    })();
    const channel = supabase.channel(`match-${id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` }, () => { void load(); })
      .subscribe();
    // A safety net when a change notice goes missing.
    const poll = setInterval(() => { void load(); }, 10_000);
    return () => { cancelled = true; void supabase.removeChannel(channel); clearInterval(poll); };
  }, [id, load]);

  const m = data?.match;
  const secondsLeft = useSecondsLeft(m?.way === 'live' && m.status === 'active' ? m.turn_ends_at : null);

  // The other player's live turn ran out: pass it on (the server checks the time).
  const passed = useRef<number | null>(null);
  useEffect(() => {
    if (!m || !data || secondsLeft !== 0 || m.turn === data.you || passed.current === m.move_no) return;
    passed.current = m.move_no;
    void callMatch('pass', { match_id: m.id }).then(load, () => null);
  }, [secondsLeft, m, data, load]);

  const match = useMemo(() => (data ? {
    view: viewOf(data.match, data.you, data.mine),
    move: async (mv: MakeMove) => {
      try { await callMatch('move', { match_id: data.match.id, move_no: data.match.move_no, ...mv }); } finally { await load(); }
    },
  } : undefined), [data, load]);

  if (!id) return <Screen label="Player · Game with a colleague"><Banner tone="info">This game isn’t available.</Banner></Screen>;
  const header = (
    <BackLink onClick={() => go('library')}>← Back to your games</BackLink>
  );
  if (!data || !m) return <Screen label="Player · Game with a colleague">{header}<Banner tone={error ? 'warning' : 'info'}>{error ?? 'Loading…'}</Banner></Screen>;

  const other = otherName(m, data.you);
  const line = m.status === 'invited' ? `Waiting for ${other} to accept`
    : m.status === 'waiting' ? `Waiting for ${other}`
      : m.status === 'active' ? `${m.turn === data.you ? 'Your turn' : `${other}’s turn`}${secondsLeft !== null ? ` · ${secondsLeft} s left` : ''}`
        : m.status === 'finished' ? (m.winner === null ? 'Finished · a draw' : m.winner === data.you ? 'Finished · you won' : `Finished · ${other} won`)
          : m.status === 'cancelled' ? 'Cancelled · no move for too long' : 'This game is closed';
  const playable = m.status === 'active' || m.status === 'finished';

  return (
    <ThemeScope tokens={data.content.concept?.look.tokens} page>
      <Screen label="Player · Game with a colleague" gap={12}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          {header}
          <span style={{ fontSize: 13, color: 'var(--tc-ink-3)' }}>{data.content.concept?.title} · with {other}</span>
        </div>
        <div aria-live="polite" style={{ fontWeight: 600 }}>{line}</div>
        {error ? <Banner tone="warning">{error}</Banner> : null}
        {playable ? <GameFrame key={m.id} gameKey={m.game_key} content={data.content} runId={null} test={false} match={match} /> : null}
      </Screen>
    </ThemeScope>
  );
}
