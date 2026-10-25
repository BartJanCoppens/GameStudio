import type { MakeMove, MatchView, Side } from './protocol';

/**
 * A turn-taking match kept in memory, for test plays in the Studio and the game admin's content preview: one
 * person plays both sides, so "you" is always the side whose turn it is. Never saved. Each side's secrets stay
 * apart, as in a real match.
 */
export function standInMatch(names: { a: string; b: string } = { a: 'Player A', b: 'Player B' }) {
  let turn: Side = 'b';
  let moveNo = 0;
  let state: unknown = null;
  let lastMove: unknown = null;
  let over: MatchView['over'] = null;
  const mine: Record<Side, unknown> = { a: null, b: null };

  const view = (): MatchView => ({
    you: turn, players: { a: { name: names.a }, b: { name: names.b } }, turn, moveNo, state, lastMove,
    mine: mine[turn], way: 'async', turnEndsAt: null, status: over ? 'finished' : 'active', over,
  });

  return {
    view,
    move(m: MakeMove): MatchView {
      if (over) throw new Error('This game is over');
      if (m.mine !== undefined) mine[turn] = m.mine;
      state = m.state ?? null;
      lastMove = m.move ?? null;
      moveNo += 1;
      if (m.over) over = m.over;
      else turn = turn === 'a' ? 'b' : 'a';
      return view();
    },
  };
}
