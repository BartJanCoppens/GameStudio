import { useState } from 'react';
import { Button } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import { callMatch, otherName, sideOf, statusOf, useMyMatches, type MatchRow } from '../../game/matches';
import { errorMessage } from '../../lib/supabase';

const OPEN = ['invited', 'waiting', 'active'];

/** On a turn-taking game's own page: its open invitations and games, to answer or play right there. */
export function GameMatches({ gameKey }: { gameKey: string }) {
  const { set, toast } = useApp();
  const { profile } = useSignedIn();
  const { rows, reload } = useMyMatches(profile.id);
  const [busy, setBusy] = useState<string | null>(null);
  const open = (rows ?? []).filter(m => m.game_key === gameKey && OPEN.includes(m.status));
  if (!open.length) return null;

  const act = async (m: MatchRow, action: 'accept' | 'decline' | 'withdraw') => {
    setBusy(m.id);
    try {
      await callMatch(action, { match_id: m.id });
      // Accepting starts the game: straight into it.
      if (action === 'accept') set({ screen: 'match', matchId: m.id });
      else await reload();
    } catch (e) { toast(errorMessage(e)); } finally { setBusy(null); }
  };

  return (
    <section aria-label="Your games with colleagues in this game" style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--tc-line-hair)', paddingTop: 14 }}>
      {open.map(m => {
        const you = sideOf(m, profile.id)!;
        const other = otherName(m, you);
        const text = m.status === 'invited' ? (you === 'b' ? `${other} invites you` : `Waiting for ${other} to answer`) : `${statusOf(m, you).text} · with ${other}`;
        return (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, flex: '1 1 240px' }}>{text}<span style={{ color: 'var(--tc-ink-4)', fontWeight: 400 }}> · {m.way === 'live' ? 'live' : 'turn by turn'}</span></span>
            {m.status === 'invited' && you === 'b' ? (
              <>
                <Button variant="primary" size="md" disabled={busy === m.id} onClick={() => void act(m, 'accept')}>Accept</Button>
                <Button variant="secondary" size="md" disabled={busy === m.id} onClick={() => void act(m, 'decline')}>Decline</Button>
              </>
            ) : null}
            {m.status === 'invited' && you === 'a' ? <Button variant="secondary" size="md" disabled={busy === m.id} onClick={() => void act(m, 'withdraw')}>Withdraw</Button> : null}
            {m.status !== 'invited' ? <Button variant="primary" size="md" onClick={() => set({ screen: 'match', matchId: m.id })}>Play</Button> : null}
          </div>
        );
      })}
    </section>
  );
}
