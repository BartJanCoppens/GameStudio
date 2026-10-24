import { Banner, Select, Table, Tabs, type Column } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import { useGoal } from '../../game/goal';
import { Leaderboard } from '../../game/Leaderboard';
import { clock, leaderboardOf, useFinishedRuns, type RunRow } from '../../game/runs';
import { useGameContent } from '../../game/useGameContent';
import { PageHead, Screen } from '../../shell/ui';
import { card, cardHead, flush } from '../../shell/styles';
import { AiServicesPanel } from '../admin/AiServices';
import { AccessTab } from './AccessTab';
import { ContentTab } from './ContentTab';
import { useEffect } from 'react';

interface PlayerRow {
  userId: string;
  name: string;
  cohort: string;
  runs: number;
  best: number;
  last: string;
}

function playersOf(runs: RunRow[]): PlayerRow[] {
  const by = new Map<string, PlayerRow>();
  for (const r of runs) {
    const p = by.get(r.user_id) ?? { userId: r.user_id, name: r.player_name, cohort: r.player_cohort, runs: 0, best: -Infinity, last: r.finished_at! };
    p.runs += 1;
    p.best = Math.max(p.best, r.score ?? 0);
    if (r.finished_at! > p.last) p.last = r.finished_at!;
    by.set(r.user_id, p);
  }
  return [...by.values()].sort((a, b) => b.best - a.best);
}

const playerColumns: Column<PlayerRow>[] = [
  { key: 'name', label: 'Player', width: 'minmax(180px,1.4fr)', strong: true },
  { key: 'cohort', label: 'Cohort', width: 'minmax(160px,1fr)', muted: true, render: r => r.cohort || '—' },
  { key: 'runs', label: 'Games played', width: '120px', align: 'right', numeric: true },
  { key: 'best', label: 'Best score', width: '110px', align: 'right', numeric: true },
  { key: 'last', label: 'Last played', width: '150px', muted: true, render: r => new Date(r.last).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) },
];

/** Per published game: who plays it, how they do, and the game's own AI keys. */
export function Console() {
  const { s, set, openGame } = useApp();
  const { permissions } = useSignedIn();
  const { game, games, live } = useGameContent();
  const published = games.filter(g => g.liveVersion !== null && !g.archived_at);
  const current = game && published.includes(game) ? game : published[0] ?? null;
  const { runs, error } = useFinishedRuns(current?.key);
  const concept = current?.key === game?.key ? live?.content.concept : null;
  // The selected game drives the live content the tabs show.
  useEffect(() => { if (current && current.key !== game?.key) set({ gameKey: current.key }); }, [current, game?.key, set]);
  const { total } = useGoal(concept?.mode === 'common_goal' ? current?.key : undefined);
  const all = runs ?? [];

  if (!current) return <Screen label="Game administration"><PageHead eyebrow="Game administration" title="Games" lead="No published games yet. They appear here once a creator publishes one." /></Screen>;

  return (
    <Screen label="Game administration">
      <PageHead
        eyebrow="Game administration"
        title={current.title}
        lead={`${current.liveVersion ? `Version ${current.liveVersion} live` : 'Live'} · ${all.length} ${all.length === 1 ? 'game played' : 'games played'}`}
        actions={
          <Select aria-label="Game" value={current.key} onChange={e => openGame(e.target.value, 'console')} options={published.map(g => ({ value: g.key, label: g.title }))} style={{ minWidth: 240 }} />
        }
      />
      {error ? <Banner tone="warning" title="Could not load the results.">{error}</Banner> : null}
      <Tabs
        tabs={[
          ...(permissions.has('allocation.manage') ? [{ value: 'access' as const, label: current.access === 'restricted' ? 'Access · restricted' : 'Access · everyone' }] : []),
          ...(permissions.has('live.edit') ? [{ value: 'content' as const, label: 'Content' }] : []),
          { value: 'players', label: `Players & results · ${playersOf(all).length}` },
          ...(permissions.has('ai.game') ? [{ value: 'ai' as const, label: 'AI services' }] : []),
        ]}
        value={s.consoleTab}
        onChange={consoleTab => set({ consoleTab })}
      />
      {s.consoleTab === 'access' && permissions.has('allocation.manage') ? <AccessTab key={current.key} game={current} /> : null}
      {s.consoleTab === 'content' && permissions.has('live.edit') && live && current.key === game?.key ? <ContentTab key={current.key} game={current} live={live} /> : null}
      {s.consoleTab === 'players' ? (
        <div style={card}>
          <div style={cardHead}>Players</div>
          {all.length ? <Table columns={playerColumns} rows={playersOf(all)} rowKey="userId" compact style={flush} /> : <div style={{ padding: 18, color: 'var(--tc-ink-5)' }}>Nobody has finished this game yet.</div>}
        </div>
      ) : null}
      {s.consoleTab === 'players' ? (
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ ...card, flex: '1 1 420px' }}>
            <div style={cardHead}>Leaderboard · best game per player</div>
            <Leaderboard entries={leaderboardOf(all)} />
          </div>
          <div style={{ ...card, flex: '0 1 320px', padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 600 }}>At a glance</div>
            <div style={{ fontSize: 13, color: 'var(--tc-ink-3)' }}>Average score {all.length ? Math.round(all.reduce((a, r) => a + (r.score ?? 0), 0) / all.length) : '—'}</div>
            <div style={{ fontSize: 13, color: 'var(--tc-ink-3)' }}>Average time {all.length ? clock(Math.round(all.reduce((a, r) => a + (r.duration_seconds ?? 0), 0) / all.length)) : '—'}</div>
            {concept?.mode === 'common_goal' && concept.goal ? <div style={{ fontSize: 13, color: 'var(--tc-ink-3)' }}>Common goal: {total ?? 0} of {concept.goal.target} {concept.goal.unit}</div> : null}
          </div>
        </div>
      ) : null}
      {s.consoleTab === 'ai' && permissions.has('ai.game') ? <AiServicesPanel scope="game" gameKey={current.key} /> : null}
    </Screen>
  );
}
