import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { card, cardHead } from '../../shell/styles';

interface Row { name: string; wins: number; draws: number; losses: number }

/** A turn-taking game's leaderboard: finished games between colleagues, ranked by wins. */
export function TurnLeaderboard({ gameKey }: { gameKey: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.rpc('turn_leaderboard', { p_game_key: gameKey }).then(({ data }) => { if (!cancelled) setRows((data ?? []) as Row[]); });
    return () => { cancelled = true; };
  }, [gameKey]);
  return (
    <div style={card}>
      <div style={cardHead}>Leaderboard · games between colleagues</div>
      {!rows ? <div style={{ padding: 18, color: 'var(--tc-ink-5)' }}>Loading…</div> : null}
      {rows && !rows.length ? <div style={{ padding: 18, color: 'var(--tc-ink-5)' }}>No finished games yet.</div> : null}
      {rows?.length ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.name}-${i}`} style={{ borderTop: '1px solid var(--tc-line-hair)' }}>
                <td style={{ padding: '10px 18px', width: 40, color: 'var(--tc-ink-4)' }}>{i + 1}</td>
                <td style={{ padding: '10px 8px', fontWeight: 600 }}>{r.name}</td>
                <td style={{ padding: '10px 18px', textAlign: 'right' }}>{r.wins} won · {r.draws} drawn · {r.losses} lost</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
