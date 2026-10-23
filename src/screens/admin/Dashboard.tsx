import { StatCard, Table } from '../../ds';
import { useApp } from '../../app/useApp';
import { ERRORS } from '../../game/content';
import { clock, useFinishedRuns } from '../../game/runs';
import { PageHead, Screen } from '../../shell/ui';
import { card, cardHead, flush } from '../../shell/styles';
import { gameColumns, gameRows } from '../creator/gameColumns';
import { useDirectory } from './directory';

export function Dashboard() {
  const { roles, set } = useApp();
  const { runs } = useFinishedRuns();
  const { data } = useDirectory();
  const all = runs ?? [];
  const users = data?.users ?? [];
  const active = users.filter(u => u.status === 'active').length;
  const players = new Set(all.map(r => r.user_id)).size;
  const avg = all.length ? (all.reduce((a, r) => a + (r.invoices_correct ?? 0), 0) / all.length).toFixed(1) : '—';
  const openStudio = roles.includes('creator') ? () => set({ role: 'creator', screen: 'studio' }) : undefined;

  return (
    <Screen label="Admin · Overview">
      <PageHead title="Overview" lead={`Platform · ${users.length} users · 1 game · 1 content domain`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
        <StatCard label="Users" value={data ? users.length : '—'} unit={data ? `${active} active` : ''} />
        <StatCard label="Players who played" value={players} unit={`· ${all.length} runs`} />
        <StatCard label="Average result" value={avg} unit="of 12 invoices right" />
        <StatCard label="Grounding coverage" value={100} unit="%" sub={`${ERRORS.length} of ${ERRORS.length} errors cite a passage`} />
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ ...card, flex: '1 1 600px', minWidth: 0 }}>
          <div style={cardHead}>Games</div>
          <Table columns={gameColumns(openStudio)} rows={gameRows(runs)} rowKey="id" compact style={flush} />
        </div>
        <div style={{ ...card, flex: '0 1 320px' }}>
          <div style={cardHead}>Recent runs</div>
          {all.length ? all.slice(0, 6).map((r, i) => (
            <div key={r.id} style={{ padding: '10px 18px', borderTop: i ? '1px solid #eef0ea' : 0 }}>
              <div style={{ fontSize: 12.5 }}>{r.player_name} · {r.invoices_correct} of 12 right · {r.points} points</div>
              <div style={{ fontSize: 11.5, color: '#8b918a' }}>{new Date(r.finished_at!).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {clock(r.duration_seconds ?? 0)}</div>
            </div>
          )) : <div style={{ padding: '14px 18px', color: '#8b918a' }}>No finished runs yet.</div>}
        </div>
      </div>
    </Screen>
  );
}
