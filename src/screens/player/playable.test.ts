import { describe, expect, it } from 'vitest';
import type { GameMeta } from '../../game/games';
import { playableGames } from './playable';

const game = (key: string, extra: Partial<GameMeta> = {}): GameMeta =>
  ({ key, title: key, description: '', created_by: null, created_at: '', liveVersion: 1, archived_at: null, ...extra });

describe('playableGames', () => {
  const live = new Set(['a', 'b', 'c', 'd']);
  it('lists published games', () => expect(playableGames([game('a'), game('x')], live).map(g => g.key)).toEqual(['a']));
  it('leaves out archived games', () => expect(playableGames([game('b', { archived_at: '2026-10-25' })], live)).toEqual([]));
  it('leaves out offline games, even for those who may still open them', () => expect(playableGames([game('c', { offline_at: '2026-10-25' })], live)).toEqual([]));
});
