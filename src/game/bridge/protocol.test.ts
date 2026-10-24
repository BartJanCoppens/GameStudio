import { describe, expect, it } from 'vitest';
import { firstNameInitial, parseBridgeRequest } from './protocol';

const msg = (o: object) => ({ source: 'gamestudio', id: 1, ...o });

describe('parseBridgeRequest', () => {
  it.each([
    [{ type: 'ready' }], [{ type: 'getData' }], [{ type: 'getPlayer' }], [{ type: 'getLeaderboard' }], [{ type: 'getGoal' }], [{ type: 'getSources' }], [{ type: 'finish' }],
    [{ type: 'submitScore', score: 42, details: { a: 1 } }],
    [{ type: 'contribute', amount: 5, note: 'a clue' }],
    [{ type: 'askAI', messages: [{ role: 'player', text: 'hi' }], state: { level: 2 } }],
  ])('accepts %o', o => expect(parseBridgeRequest(msg(o))).toMatchObject({ id: 1, ...o }));

  it('rejects a forged source', () => expect(parseBridgeRequest({ source: 'other', id: 1, type: 'ready' })).toBeNull());
  it('rejects an unknown type', () => expect(parseBridgeRequest(msg({ type: 'navigate' }))).toBeNull());
  it('rejects a non-integer id', () => expect(parseBridgeRequest({ source: 'gamestudio', id: 1.5, type: 'ready' })).toBeNull());
  it.each([[NaN], [Infinity], ['10'], [1e9], [-1e9]])('rejects the score %s', score => expect(parseBridgeRequest(msg({ type: 'submitScore', score, details: {} }))).toBeNull());
  it.each([[0], [1001], [-1], ['5']])('rejects the amount %s', amount => expect(parseBridgeRequest(msg({ type: 'contribute', amount, note: '' }))).toBeNull());
  it('rejects a note over 140 characters', () => expect(parseBridgeRequest(msg({ type: 'contribute', amount: 1, note: 'x'.repeat(141) }))).toBeNull());
  it('rejects 21 messages', () => expect(parseBridgeRequest(msg({ type: 'askAI', messages: Array.from({ length: 21 }, () => ({ role: 'player', text: 'x' })), state: {} }))).toBeNull());
  it('rejects a message over 1000 characters', () => expect(parseBridgeRequest(msg({ type: 'askAI', messages: [{ role: 'player', text: 'x'.repeat(1001) }], state: {} }))).toBeNull());
  it('rejects an unknown message role', () => expect(parseBridgeRequest(msg({ type: 'askAI', messages: [{ role: 'system', text: 'x' }], state: {} }))).toBeNull());
  it('rejects a 5 KB state', () => expect(parseBridgeRequest(msg({ type: 'askAI', messages: [{ role: 'player', text: 'x' }], state: { s: 'x'.repeat(5000) } }))).toBeNull());
  it('rejects 17 KB of score details', () => expect(parseBridgeRequest(msg({ type: 'submitScore', score: 1, details: { s: 'x'.repeat(17000) } }))).toBeNull());
});

describe('firstNameInitial', () => {
  it('keeps the first name and the last initial', () => expect(firstNameInitial('Bart Jan Coppens')).toBe('Bart C.'));
  it('keeps a single name', () => expect(firstNameInitial('Madonna')).toBe('Madonna'));
  it('falls back to Player', () => expect(firstNameInitial('  ')).toBe('Player'));
});
