import { LinkButton, StatusChip, Tag, type Column, type Status } from '../../ds';
import { GAME } from '../../game/content';
import type { GameMeta } from '../../game/games';
import type { RunRow } from '../../game/runs';

export interface GameRow {
  id: string;
  title: string;
  type: string;
  platform: string;
  domain: string;
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
      id: g.key, title: g.title, type: GAME.type, platform: 'Browser', domain: GAME.domain,
      stage: g.liveVersion === null ? 'Draft' : 'Published', st: g.liveVersion === null ? 'in-progress' : 'accepted',
      version: g.liveVersion === null ? 'not published' : g.liveVersion ? `v${g.liveVersion} live` : 'built-in',
      players: new Set(played.map(r => r.user_id)).size, runs: played.length,
    };
  });
}

/** Games table, shared by Creator · My games and Admin · Overview. Clicking the title opens the game in the Studio. */
export function gameColumns(openInStudio?: (key: string) => void): Column<GameRow>[] {
  return [
    {
      key: 'title', label: 'Game', width: 'minmax(220px,1.4fr)', strong: true,
      render: r => (openInStudio ? <LinkButton onClick={() => openInStudio(r.id)}>{r.title}</LinkButton> : r.title),
    },
    { key: 'type', label: 'Type', width: '90px', muted: true },
    { key: 'platform', label: 'Platform', width: '90px', muted: true },
    { key: 'domain', label: 'Domain', width: '130px', render: r => <Tag tone="bundle">{r.domain}</Tag> },
    { key: 'stage', label: 'Stage', width: '120px', render: r => <StatusChip status={r.st} label={r.stage} size="xs" /> },
    { key: 'version', label: 'Version', width: '120px', muted: true },
    { key: 'players', label: 'Players', width: '80px', align: 'right', numeric: true },
    { key: 'runs', label: 'Runs', width: '70px', align: 'right', numeric: true },
  ];
}
