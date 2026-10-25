import { useCallback, useEffect, useState } from 'react';
import { callFunction, supabase } from '../lib/supabase';
import { firstNameInitial, type MatchView, type Side } from './bridge/protocol';

// Turn-taking games between two colleagues (see supabase/migrations/*_turn_taking.sql and functions/game-match).

export interface MatchRow {
  id: string;
  game_key: string;
  version: number;
  way: 'live' | 'async';
  status: 'invited' | 'waiting' | 'active' | 'finished' | 'declined' | 'withdrawn' | 'expired' | 'cancelled';
  player_a: string;
  player_b: string;
  a_name: string;
  b_name: string;
  turn: Side;
  move_no: number;
  state: unknown;
  last_move: unknown;
  a_ready: boolean;
  b_ready: boolean;
  turn_ends_at: string | null;
  last_activity_at: string;
  created_at: string;
  finished_at: string | null;
  winner: Side | null;
}

/** Every write to a match goes through the game-match function. */
export const callMatch = <T = unknown>(action: string, body: Record<string, unknown>) => callFunction<T>('game-match', { action, ...body });

export const sideOf = (m: MatchRow, userId: string): Side | null => (m.player_a === userId ? 'a' : m.player_b === userId ? 'b' : null);
export const otherName = (m: MatchRow, you: Side) => (you === 'a' ? m.b_name : m.a_name);

/** What the game sees: first names with an initial, and only the viewer's own secrets. */
export function viewOf(m: MatchRow, you: Side, mine: unknown): MatchView {
  return {
    you, players: { a: { name: firstNameInitial(m.a_name) }, b: { name: firstNameInitial(m.b_name) } }, turn: m.turn, moveNo: m.move_no,
    state: m.state, lastMove: m.last_move, mine, way: m.way, turnEndsAt: m.turn_ends_at, status: m.status,
    over: m.status === 'finished' ? { winner: m.winner } : null,
  };
}

/** How a row reads in the player's list, and what they can do with it. */
export function statusOf(m: MatchRow, you: Side): { text: string; actions: ('play' | 'accept' | 'decline' | 'withdraw')[] } {
  switch (m.status) {
    case 'invited': return you === 'a' ? { text: 'Invited · waiting for an answer', actions: ['withdraw'] } : { text: 'Invites you', actions: ['accept', 'decline'] };
    case 'waiting': return { text: 'Starting · waiting for both players', actions: ['play'] };
    case 'active': return { text: m.turn === you ? 'Your turn' : 'Their turn', actions: ['play'] };
    case 'finished': return { text: m.winner === null ? 'Finished · a draw' : m.winner === you ? 'Finished · you won' : 'Finished · you lost', actions: ['play'] };
    case 'declined': return { text: 'Declined', actions: [] };
    case 'withdrawn': return { text: 'Withdrawn', actions: [] };
    case 'expired': return { text: 'Expired · no answer in time', actions: [] };
    case 'cancelled': return { text: 'Cancelled · no move for too long', actions: [] };
  }
}

async function fetchMatches(userId: string): Promise<MatchRow[]> {
  const { data } = await supabase.from('matches').select('*').or(`player_a.eq.${userId},player_b.eq.${userId}`)
    .order('last_activity_at', { ascending: false }).limit(30).returns<MatchRow[]>();
  return data ?? [];
}

/** The signed-in player's invitations and games, kept up to date while the page is open. */
export function useMyMatches(userId: string): { rows: MatchRow[] | null; reload: () => Promise<void> } {
  const [rows, setRows] = useState<MatchRow[] | null>(null);
  const reload = useCallback(async () => { setRows(await fetchMatches(userId)); }, [userId]);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => fetchMatches(userId).then(r => { if (!cancelled) setRows(r); });
    void refresh();
    // Row level security limits the changes to the player's own matches (and games they look after).
    const channel = supabase.channel(`matches-${userId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => { void refresh(); })
      .subscribe();
    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [userId]);
  return { rows, reload };
}
