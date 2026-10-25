import type { AppState } from '../../app/useApp';
import type { GameMeta } from '../../game/games';

export type ConsoleTab = AppState['consoleTab'];

/** A game admin looks after the published games assigned to them (while they hold the permission); platform admins after all. */
export function gamesToLookAfter(games: GameMeta[], profileId: string, permissions: Set<string>): GameMeta[] {
  const platformAdmin = permissions.has('users.manage');
  return games.filter(g => g.liveVersion !== null && !g.archived_at && (platformAdmin || (g.game_admin === profileId && permissions.has('live.edit'))));
}

/** The console's tabs the permissions allow, in order. */
export function consoleTabs(permissions: Set<string>): ConsoleTab[] {
  return [
    ...(permissions.has('allocation.manage') ? ['access' as const] : []),
    ...(permissions.has('live.edit') || permissions.has('users.manage') ? ['content' as const] : []),
    'players' as const,
    ...(permissions.has('ai.game') ? ['ai' as const] : []),
  ];
}

/** The tab to show: the one asked for when available, else the first (a custom role may lack the default). */
export function shownTab(wanted: ConsoleTab, tabs: ConsoleTab[]): ConsoleTab {
  return tabs.includes(wanted) ? wanted : tabs[0];
}
