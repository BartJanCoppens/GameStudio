import { Banner, Button, LinkButton, StatCard, StatusChip, Table, Tabs, Tag, type Column } from '../../ds';
import { DRAFT_QUESTIONS } from '../../data/creator';
import { GENERATED_ADDITIONS, PLAYER_ROWS, type PlayerRow } from '../../data/admin';
import { leaderboard } from '../../data/shared';
import { useApp } from '../../app/useApp';
import { PageHead, Screen } from '../../shell/ui';
import { card, cardHead, flush } from '../../shell/styles';
import { CohortChips } from '../creator/Workflow';
import { leaderboardColumns } from '../player/leaderboardColumns';

interface ContentRow {
  id: string;
  text: string;
  level: string;
  source: string;
  origin: string;
  live: boolean;
}

const contentColumns: Column<ContentRow>[] = [
  { key: 'id', label: '#', width: '56px', muted: true },
  { key: 'text', label: 'Question', width: 'minmax(260px,1.6fr)', wrap: true },
  { key: 'level', label: 'Level', width: '90px', muted: true },
  { key: 'source', label: 'Source passage', width: 'minmax(160px,1fr)', render: r => (r.source ? <Tag tone="source">{r.source}</Tag> : <Tag tone="amber">Ungrounded</Tag>) },
  { key: 'origin', label: 'Origin', width: '190px', render: r => <StatusChip status={r.live ? 'accepted' : 'in-progress'} label={r.origin} size="xs" /> },
];

const playerColumns: Column<PlayerRow>[] = [
  { key: 'name', label: 'Player', width: 'minmax(160px,1fr)', strong: true },
  { key: 'cohort', label: 'Cohort', width: 'minmax(140px,1fr)', muted: true },
  { key: 'progress', label: 'Progress', width: '140px' },
  { key: 'score', label: 'Score', width: '80px', align: 'right', numeric: true },
  { key: 'status', label: 'Status', width: '130px', render: r => <StatusChip status={r.st} label={r.status} size="xs" /> },
];

/** The live template (v3) carries only grounded questions. */
const TEMPLATE_ROWS: ContentRow[] = Object.values(DRAFT_QUESTIONS)
  .filter(q => q.grounded)
  .map(q => ({ id: q.id, text: q.text, level: `Level ${q.id[0]}`, source: q.sourceLoc, origin: 'Template v3', live: true }));

export function Console() {
  const { s, set, toast, toastProto } = useApp();
  const added: ContentRow[] = GENERATED_ADDITIONS.slice(0, s.pending).map((a, i) => ({ id: `A.${i + 1}`, text: a.text, level: 'Level 3', source: a.source, origin: 'Added by admin · pending', live: false }));
  const rows = [...added, ...TEMPLATE_ROWS];

  const generate = () => {
    set({ pending: GENERATED_ADDITIONS.length, consoleTab: 'content' });
    toast('5 questions generated from Belgian VAT · review, then publish additions');
  };
  const publish = () => {
    set({ pending: 0 });
    toast('5 additions live for 142 players · logged 23 Oct · Thomas Vermeulen');
  };

  return (
    <Screen label="Game admin · Console">
      <PageHead
        eyebrow="Game administration"
        title="VAT rates ladder · v3 live"
        lead="Additions you make here go live directly · logged with your name and time · the template stays at v3"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" size="lg" onClick={toastProto}>+ Add by hand</Button>
            <Button variant="dark" size="lg" onClick={generate}>Generate 5 from Belgian VAT</Button>
          </div>
        }
      />
      {s.pending > 0 ? (
        <Banner tone="warning" title={`${s.pending} additions ready.`} actions={<Button variant="dark" size="sm" onClick={publish}>Publish additions</Button>}>
          Grounded in Belgian VAT · each links to a passage · not yet visible to players.
        </Banner>
      ) : null}
      <Tabs
        tabs={[{ value: 'content', label: `Content · ${rows.length}` }, { value: 'players', label: 'Players & cohorts · 142' }, { value: 'results', label: 'Results' }]}
        value={s.consoleTab}
        onChange={consoleTab => set({ consoleTab })}
      />
      {s.consoleTab === 'content' ? (
        <div style={card}><Table columns={contentColumns} rows={rows} rowKey="id" compact style={flush} /></div>
      ) : null}
      {s.consoleTab === 'players' ? (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <CohortChips />
            <LinkButton size={12} onClick={toastProto} style={{ alignSelf: 'center', marginLeft: 6 }}>+ Add players or a cohort</LinkButton>
          </div>
          <div style={card}><Table columns={playerColumns} rows={PLAYER_ROWS} rowKey="name" compact style={flush} /></div>
        </>
      ) : null}
      {s.consoleTab === 'results' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
            <StatCard label="Players reached" value={142} unit="of 160" />
            <StatCard label="Completed level 4" value={58} unit="· 41%" />
            <StatCard label="Average score" value={74} unit="%" sub="Q2.3 most missed · 38% correct" />
            <StatCard label="Badges issued" value={61} sub="Rates badge · certificate at level 4" />
          </div>
          <div style={card}>
            <div style={cardHead}>Leaderboard · all cohorts</div>
            <Table columns={leaderboardColumns} rows={leaderboard(s.score)} rowKey="rank" compact style={flush} />
          </div>
        </>
      ) : null}
    </Screen>
  );
}
