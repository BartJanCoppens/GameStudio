import { describe, expect, it } from 'vitest';
import type { GameMeta } from '../../game/games';
import { consoleTabs, gamesToLookAfter, shownTab } from './consoleTabs';

const game = (key: string, extra: Partial<GameMeta> = {}): GameMeta =>
  ({ key, title: key, description: '', created_by: null, created_at: '', liveVersion: 1, archived_at: null, game_admin: 'me', ...extra });

describe('gamesToLookAfter', () => {
  const games = [game('mine'), game('theirs', { game_admin: 'other' }), game('draft', { liveVersion: null }), game('old', { archived_at: 'x' })];
  it('a game admin gets the published games assigned to them', () =>
    expect(gamesToLookAfter(games, 'me', new Set(['live.edit'])).map(g => g.key)).toEqual(['mine']));
  it('a platform admin gets every published game', () =>
    expect(gamesToLookAfter(games, 'me', new Set(['users.manage'])).map(g => g.key)).toEqual(['mine', 'theirs']));
  it('without the game admin permission, an assignment gives nothing', () =>
    expect(gamesToLookAfter(games, 'me', new Set(['games.play']))).toEqual([]));
});

describe('console tabs', () => {
  it('shows only the tabs the permissions allow', () =>
    expect(consoleTabs(new Set(['results.view']))).toEqual(['players']));
  it('falls back to the first available tab', () => expect(shownTab('access', ['players', 'ai'])).toBe('players'));
  it('keeps a tab that is available', () => expect(shownTab('ai', ['players', 'ai'])).toBe('ai'));
});
