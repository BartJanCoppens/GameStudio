import { LinkButton, StatusChip, Tag, type Column } from '../../ds';
import type { GameRow, StudioGame } from '../../data/creator';

/** Games table, shared by Creator · My games and Admin · Overview. Clicking a title opens it in the creator's Studio. */
export function gameColumns(openInStudio: (game: StudioGame | null) => void): Column<GameRow>[] {
  return [
    {
      key: 'title', label: 'Game', width: 'minmax(220px,1.4fr)', strong: true,
      render: r => (
        <LinkButton
          onClick={() => openInStudio(r.id === 'g1' ? null : { title: r.title, domain: r.domain, status: r.st, stage: `${r.stage} · ${r.version}`, structureNote: `${r.type} · ${r.platform}` })}
          style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {r.title}
        </LinkButton>
      ),
    },
    { key: 'type', label: 'Type', width: '110px', muted: true },
    { key: 'platform', label: 'Platform', width: '120px', muted: true },
    { key: 'domain', label: 'Domain', width: '130px', render: r => <Tag tone="bundle">{r.domain}</Tag> },
    { key: 'stage', label: 'Stage', width: '130px', render: r => <StatusChip status={r.st} label={r.stage} size="xs" /> },
    { key: 'version', label: 'Version', width: '110px', muted: true },
    { key: 'players', label: 'Players', width: '80px', align: 'right', numeric: true },
    { key: 'updated', label: 'Updated', width: 'minmax(160px,1fr)', muted: true },
  ];
}
