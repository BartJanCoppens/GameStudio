import { LinkButton, StatusChip, Tag, type Column, type Status } from '../../ds';
import { GAME } from '../../game/content';
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

/** The one game, with player numbers from its finished runs. */
export function gameRows(runs: RunRow[] | null): GameRow[] {
  return [{
    id: GAME.key, title: GAME.title, type: GAME.type, platform: 'Browser', domain: GAME.domain, stage: 'Published', st: 'accepted',
    version: `${GAME.version} · v4 in dev`, players: new Set((runs ?? []).map(r => r.user_id)).size, runs: runs?.length ?? 0,
  }];
}

/** Games table, shared by Creator · My games and Admin · Overview. Clicking the title opens the Studio. */
export function gameColumns(openInStudio?: () => void): Column<GameRow>[] {
  return [
    {
      key: 'title', label: 'Game', width: 'minmax(220px,1.4fr)', strong: true,
      render: r => (openInStudio ? <LinkButton onClick={openInStudio}>{r.title}</LinkButton> : r.title),
    },
    { key: 'type', label: 'Type', width: '90px', muted: true },
    { key: 'platform', label: 'Platform', width: '90px', muted: true },
    { key: 'domain', label: 'Domain', width: '130px', render: r => <Tag tone="bundle">{r.domain}</Tag> },
    { key: 'stage', label: 'Stage', width: '120px', render: r => <StatusChip status={r.st} label={r.stage} size="xs" /> },
    { key: 'version', label: 'Version', width: '130px', muted: true },
    { key: 'players', label: 'Players', width: '80px', align: 'right', numeric: true },
    { key: 'runs', label: 'Runs', width: '70px', align: 'right', numeric: true },
  ];
}
