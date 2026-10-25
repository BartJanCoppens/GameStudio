import type { GameMeta } from '../../game/games';

/**
 * The games a library shows: published, not archived, not offline. Offline matters here for those who can still
 * open an offline game (its creator, game admin, platform admins): a counted run started there couldn't finish.
 */
export function playableGames(games: GameMeta[], live: Set<string>): GameMeta[] {
  return games.filter(g => live.has(g.key) && !g.archived_at && !g.offline_at);
}
