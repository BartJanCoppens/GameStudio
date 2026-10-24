import { Banner, Button, LinkButton, StatCard, Table, Tabs, Tag, type Column } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import { GAME, errorsOn, passageOfError, ruleById, type GameContent, type Invoice, type PlantedError } from '../../game/content';
import { useGameContent } from '../../game/useGameContent';
import { Leaderboard } from '../../game/Leaderboard';
import { leaderboardOf, useFinishedRuns, type RunRow } from '../../game/runs';
import { scoreRun } from '../../game/scoring';
import { PageHead, Screen } from '../../shell/ui';
import { card, cardHead, flush } from '../../shell/styles';
import { CohortChips } from '../creator/Workflow';
import { AiServicesPanel } from '../admin/AiServices';

const invoiceColumns = (content: GameContent): Column<Invoice>[] => [
  { key: 'no', label: '#', width: '44px', muted: true },
  { key: 'supplier', label: 'Supplier', width: 'minmax(170px,1fr)', strong: true, render: r => r.supplier.name },
  { key: 'number', label: 'Number', width: '120px', muted: true },
  { key: 'customer', label: 'Customer', width: 'minmax(150px,1fr)', muted: true, render: r => r.customer.name },
  {
    key: 'errors', label: 'Planted error', width: 'minmax(220px,1.4fr)', wrap: true,
    render: r => { const e = errorsOn(content, r.no); return e.length ? e.map(x => <Tag key={x.id} tone="amber">{x.title}</Tag>) : <Tag tone="muted">Clean</Tag>; },
  },
  { key: 'source', label: 'Source passage', width: '220px', render: r => { const e = errorsOn(content, r.no)[0]; if (!e) return '—'; const p = passageOfError(e); return <Tag tone="source">{p.loc.split(' · ')[0]} · {p.heading}</Tag>; } },
];

interface PlayerRow {
  userId: string;
  name: string;
  cohort: string;
  runs: number;
  best: number;
  bestPoints: number;
  last: string;
}

const playerColumns: Column<PlayerRow>[] = [
  { key: 'name', label: 'Player', width: 'minmax(160px,1fr)', strong: true },
  { key: 'cohort', label: 'Cohort', width: 'minmax(160px,1fr)', muted: true, render: r => r.cohort || '—' },
  { key: 'runs', label: 'Runs', width: '70px', align: 'right', numeric: true },
  { key: 'best', label: 'Best', width: '100px', align: 'right', numeric: true, render: r => `${r.best} right` },
  { key: 'bestPoints', label: 'Points', width: '80px', align: 'right', numeric: true },
  { key: 'last', label: 'Last played', width: '130px', muted: true },
];

/** One row per player; runs arrive newest first. */
function playersOf(runs: RunRow[]): PlayerRow[] {
  const by = new Map<string, RunRow[]>();
  for (const r of runs) by.set(r.user_id, [...(by.get(r.user_id) ?? []), r]);
  return [...by.values()].map(rs => ({
    userId: rs[0].user_id, name: rs[0].player_name, cohort: rs[0].player_cohort, runs: rs.length,
    best: Math.max(...rs.map(r => r.invoices_correct ?? 0)), bestPoints: Math.max(...rs.map(r => r.points ?? 0)),
    last: new Date(rs[0].finished_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  })).sort((a, b) => b.best - a.best || b.bestPoints - a.bestPoints);
}

interface ErrorStat {
  id: string;
  error: PlantedError;
  found: number;
  wrongRule: number;
  missed: number;
}

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '—');

/** Only runs played on this version: answers to an older game don't line up with its errors. */
function errorStats(content: GameContent, runs: RunRow[]): ErrorStat[] {
  const stats = new Map(content.errors.map(e => [e.id, { id: e.id, error: e, found: 0, wrongRule: 0, missed: 0 }]));
  for (const run of runs) {
    for (const r of scoreRun(content, run.answers).results) {
      for (const e of r.errors) {
        const st = stats.get(e.error.id)!;
        if (e.outcome === 'found') st.found++;
        else if (e.outcome === 'wrong-rule') st.wrongRule++;
        else st.missed++;
      }
    }
  }
  return [...stats.values()];
}

export function Console() {
  const { s, set, toastProto } = useApp();
  const { profile, permissions } = useSignedIn();
  const { runs, error } = useFinishedRuns();
  const { live } = useGameContent();
  const content = live.content;
  const all = runs ?? [];
  const current = all.filter(r => r.content_version === live.version);
  const stats = errorStats(content, current);
  const hardest = [...stats].sort((a, b) => a.found - b.found)[0];
  const avg = all.length ? all.reduce((a, r) => a + (r.invoices_correct ?? 0), 0) / all.length : 0;
  const players = playersOf(all);

  const errorColumns: Column<ErrorStat>[] = [
    { key: 'error', label: 'Error', width: 'minmax(240px,1.6fr)', strong: true, wrap: true, render: r => `Invoice ${r.error.invoice} · ${r.error.title}` },
    { key: 'rule', label: 'Rule', width: 'minmax(160px,1fr)', muted: true, wrap: true, render: r => ruleById(r.error.rule).label },
    { key: 'found', label: 'Found', width: '80px', align: 'right', numeric: true, render: r => pct(r.found, current.length) },
    { key: 'wrongRule', label: 'Wrong rule', width: '100px', align: 'right', numeric: true, render: r => pct(r.wrongRule, current.length) },
    { key: 'missed', label: 'Missed', width: '80px', align: 'right', numeric: true, render: r => pct(r.missed, current.length) },
  ];

  return (
    <Screen label="Game admin · Console">
      <PageHead
        eyebrow="Game administration"
        title={`${GAME.title} · ${live.version ? `version ${live.version}` : GAME.version} live`}
        lead="Additions you make here go live directly · logged with your name and time · the template stays at v3"
        actions={<Button variant="secondary" size="lg" onClick={toastProto}>+ Add invoice</Button>}
      />
      {error ? <Banner tone="warning" title="Could not load runs.">{error}</Banner> : null}
      {!permissions.has('results.view') ? <Banner tone="info">You don’t hold “View results and leaderboards”, so players and results show only what players can see.</Banner> : null}
      <Tabs
        tabs={[{ value: 'invoices', label: `Invoices · ${content.invoices.length}` }, { value: 'players', label: `Players & cohorts · ${players.length}` }, { value: 'results', label: `Results · ${all.length} ${all.length === 1 ? 'run' : 'runs'}` }, ...(permissions.has('ai.game') ? [{ value: 'ai' as const, label: 'AI services' }] : [])]}
        value={s.consoleTab}
        onChange={consoleTab => set({ consoleTab })}
      />
      {s.consoleTab === 'ai' && permissions.has('ai.game') ? <AiServicesPanel scope="game" /> : null}
      {s.consoleTab === 'invoices' ? (
        <div style={card}><Table columns={invoiceColumns(content)} rows={content.invoices} rowKey="no" compact style={flush} /></div>
      ) : null}
      {s.consoleTab === 'players' ? (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <CohortChips />
            <LinkButton size={12} onClick={toastProto} style={{ alignSelf: 'center', marginLeft: 6 }}>+ Add players or a cohort</LinkButton>
          </div>
          <div style={card}>
            {players.length ? <Table columns={playerColumns} rows={players} rowKey="userId" compact style={flush} /> : <div style={{ padding: 18, color: '#8b918a' }}>Nobody has finished a run yet.</div>}
          </div>
        </>
      ) : null}
      {s.consoleTab === 'results' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
            <StatCard label="Players" value={players.length} unit={players.length === 1 ? 'has played' : 'have played'} />
            <StatCard label="Finished runs" value={all.length} />
            <StatCard label="Average" value={all.length ? avg.toFixed(1) : '—'} unit={`of ${content.invoices.length} invoices right`} />
            <StatCard label="Hardest error" value={hardest && current.length ? pct(hardest.found, current.length) : '—'} unit="found" sub={hardest && current.length ? `Invoice ${hardest.error.invoice} · ${hardest.error.title}` : 'No runs on this version yet'} />
          </div>
          <div style={card}>
            <div style={cardHead}>Errors · how often players find them · {current.length} {current.length === 1 ? 'run' : 'runs'} on the live version</div>
            <Table columns={errorColumns} rows={stats} rowKey="id" compact style={flush} />
          </div>
          <div style={card}>
            <div style={cardHead}>Leaderboard · all cohorts</div>
            <Leaderboard entries={leaderboardOf(all)} meId={profile.id} />
          </div>
        </>
      ) : null}
    </Screen>
  );
}
