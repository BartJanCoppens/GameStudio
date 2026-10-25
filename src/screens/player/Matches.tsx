import { useEffect, useRef, useState } from 'react';
import { Button } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import { callMatch, otherName, sideOf, statusOf, useMyMatches, type MatchRow } from '../../game/matches';
import { useGameContent } from '../../game/useGameContent';
import { errorMessage } from '../../lib/supabase';
import { card, cardHead } from '../../shell/styles';
import { notificationText } from '../../../supabase/functions/_shared/notifyText.ts';

const ago = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return min < 1 ? 'just now' : min < 60 ? `${min} min ago` : min < 1440 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} d ago`;
};

/** "Your games with colleagues": invitations and turn-taking games, with their status and what to do next. */
export function Matches() {
  const { set, toast } = useApp();
  const { profile } = useSignedIn();
  const { games } = useGameContent();
  const { rows, reload } = useMyMatches(profile.id);
  const [busy, setBusy] = useState<string | null>(null);
  const titleOf = (key: string) => games.find(g => g.key === key)?.title ?? 'A game';

  const act = async (m: MatchRow, action: 'accept' | 'decline' | 'withdraw') => {
    setBusy(m.id);
    try { await callMatch(action, { match_id: m.id }); await reload(); } catch (e) { toast(errorMessage(e)); } finally { setBusy(null); }
  };

  if (!rows?.length) return null;
  return (
    <div style={{ ...card, marginBottom: 18 }}>
      <div style={cardHead}>Your games with colleagues</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <tbody>
          {rows.map(m => {
            const you = sideOf(m, profile.id)!;
            const st = statusOf(m, you);
            return (
              <tr key={m.id} style={{ borderTop: '1px solid var(--tc-line-hair)' }}>
                <td style={{ padding: '10px 18px', fontWeight: 600 }}>{titleOf(m.game_key)}</td>
                <td style={{ padding: '10px 8px', color: 'var(--tc-ink-3)' }}>with {otherName(m, you)} · {m.way === 'live' ? 'live' : 'turn by turn'}</td>
                <td style={{ padding: '10px 8px', fontWeight: st.text === 'Your turn' || st.text === 'Invites you' ? 600 : 400, color: st.text === 'Your turn' ? 'var(--tc-green-text)' : undefined }}>
                  {st.text}<span style={{ color: 'var(--tc-ink-5)', fontWeight: 400 }}> · {ago(m.last_activity_at)}</span>
                </td>
                <td style={{ padding: '10px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {st.actions.includes('accept') ? <Button variant="primary" size="sm" disabled={busy === m.id} onClick={() => void act(m, 'accept')}>Accept</Button> : null}{' '}
                  {st.actions.includes('decline') ? <Button variant="secondary" size="sm" disabled={busy === m.id} onClick={() => void act(m, 'decline')}>Decline</Button> : null}
                  {st.actions.includes('withdraw') ? <Button variant="secondary" size="sm" disabled={busy === m.id} onClick={() => void act(m, 'withdraw')}>Withdraw</Button> : null}
                  {st.actions.includes('play') ? <Button variant="primary" size="sm" onClick={() => set({ screen: 'match', matchId: m.id })}>Play</Button> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** In-app notices while the app is open: an invitation, an answer, your turn. */
export function MatchNotifier() {
  const { toast } = useApp();
  const { profile } = useSignedIn();
  const { games } = useGameContent();
  const { rows } = useMyMatches(profile.id);
  const seen = useRef<Map<string, MatchRow> | null>(null);
  useEffect(() => {
    if (!rows) return;
    const before = seen.current;
    seen.current = new Map(rows.map(r => [r.id, r]));
    if (!before) return;
    const title = (key: string) => games.find(g => g.key === key)?.title ?? 'a game';
    for (const m of rows) {
      const was = before.get(m.id);
      const you = sideOf(m, profile.id);
      if (!you) continue;
      const other = otherName(m, you);
      if (!was && m.status === 'invited' && you === 'b') toast(notificationText('invite', other, title(m.game_key)));
      else if (was?.status === 'invited' && you === 'a' && (m.status === 'active' || m.status === 'waiting')) toast(notificationText('accepted', other, title(m.game_key)));
      else if (was?.status === 'invited' && you === 'a' && m.status === 'declined') toast(notificationText('declined', other, title(m.game_key)));
      else if (was && m.status === 'active' && m.move_no > was.move_no && m.turn === you) toast(notificationText('turn', other, title(m.game_key)));
    }
  }, [rows, games, profile.id, toast]);
  return null;
}
