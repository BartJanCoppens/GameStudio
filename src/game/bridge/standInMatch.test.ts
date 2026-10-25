import { describe, expect, it } from 'vitest';
import { standInMatch } from './standInMatch';

describe('standInMatch (one person plays both sides in the Studio)', () => {
  it('starts with b and alternates', () => {
    const m = standInMatch();
    expect(m.view()).toMatchObject({ you: 'b', turn: 'b', moveNo: 0, state: null, over: null });
    expect(m.move({ move: { p: 1 }, state: { n: 1 } })).toMatchObject({ you: 'a', turn: 'a', moveNo: 1, state: { n: 1 }, lastMove: { p: 1 } });
    expect(m.move({ move: { p: 2 }, state: { n: 2 } })).toMatchObject({ you: 'b', turn: 'b', moveNo: 2 });
  });
  it('keeps each side’s secrets apart', () => {
    const m = standInMatch();
    m.move({ move: {}, state: {}, mine: { ships: 'B5' } });
    const a = m.view();
    expect(a.you).toBe('a');
    expect(JSON.stringify(a)).not.toContain('B5');
    m.move({ move: {}, state: {}, mine: { ships: 'C3' } });
    expect(m.view().mine).toEqual({ ships: 'B5' });
    expect(JSON.stringify(m.view())).not.toContain('C3');
  });
  it('ends on over', () => {
    const m = standInMatch();
    const v = m.move({ move: {}, state: {}, over: { winner: 'b' } });
    expect(v.over).toEqual({ winner: 'b' });
    expect(v.status).toBe('finished');
    expect(() => m.move({ move: {}, state: {} })).toThrow('This game is over');
  });
});
