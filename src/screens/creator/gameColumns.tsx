import type { ReactNode } from 'react';
import { LinkButton, StatusChip, type Column, type Status } from '../../ds';
import type { GameMeta } from '../../game/games';
import type { RunRow } from '../../game/runs';

export interface GameRow {
  id: string;
  title: string;
  stage: string;
  st: Status;
  version: string;
  players: number;
  runs: number;
}

/** One row per game, with player numbers from its finished runs. */
export function gameRows(games: GameMeta[], runs: RunRow[] | null): GameRow[] {
  return games.map(g => {
    const played = (runs ?? []).filter(r => r.game_key === g.key);
    return {
      id: g.key, title: g.title,
      stage: g.archived_at ? 'Archived' : g.liveVersion === null ? 'Draft' : 'Published', st: g.archived_at ? 'not-started' : g.liveVersion === null ? 'in-progress' : 'accepted',
      version: g.liveVersion === null ? 'not published' : `v${g.liveVersion} live`,
      players: new Set(played.map(r => r.user_id)).size, runs: played.length,
    };
  });
}

/** Games table, shared by Creator · My games and Admin · Overview. Clicking the title opens the game in the Studio. */
export function gameColumns({ openInStudio, actions }: { openInStudio?: (key: string) => void; actions?: (row: GameRow) => ReactNode } = {}): Column<GameRow>[] {
  return [
    {
      key: 'title', label: 'Game', width: 'minmax(200px,1.6fr)', strong: true,
      render: r => (openInStudio ? <LinkButton onClick={() => openInStudio(r.id)}>{r.title}</LinkButton> : r.title),
    },
    { key: 'stage', label: 'Stage', width: '110px', render: r => <StatusChip status={r.st} label={r.stage} size="xs" /> },
    { key: 'version', label: 'Version', width: '110px', muted: true },
    { key: 'players', label: 'Players', width: '70px', align: 'right', numeric: true },
    { key: 'runs', label: 'Runs', width: '60px', align: 'right', numeric: true },
    ...(actions ? [{ key: 'actions', label: '', width: 'minmax(220px,auto)', render: actions } as Column<GameRow>] : []),
  ];
}
