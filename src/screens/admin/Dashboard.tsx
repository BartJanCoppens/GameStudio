import { StatCard, Table } from '../../ds';
import { GAMES } from '../../data/creator';
import { ACTIVITY } from '../../data/admin';
import { useApp } from '../../app/useApp';
import { PageHead, Screen } from '../../shell/ui';
import { card, cardHead, flush } from '../../shell/styles';
import { gameColumns } from '../creator/gameColumns';

export function Dashboard() {
  const { set } = useApp();
  return (
    <Screen label="Admin · Overview">
      <PageHead title="Overview" lead="Platform · 214 users · 6 games · 3 content domains" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
        <StatCard label="Active players · 30 days" value={163} unit="of 196" />
        <StatCard label="Games live" value={2} unit="· 1 in review · 3 in dev" />
        <StatCard label="Grounding coverage" value={96} unit="%" sub="2 ungrounded questions in dev" />
        <StatCard label="Awaiting review" value={1} sub="Form a judgement · since 20 Oct" />
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ ...card, flex: '1 1 600px', minWidth: 0 }}>
          <div style={cardHead}>Games by stage</div>
          <Table columns={gameColumns(studioGame => set({ role: 'creator', screen: 'studio', studioGame }))} rows={GAMES} rowKey="id" compact style={flush} />
        </div>
        <div style={{ ...card, flex: '0 1 320px' }}>
          <div style={cardHead}>Recent activity</div>
          {ACTIVITY.map((a, i) => (
            <div key={a.text} style={{ padding: '10px 18px', borderTop: i ? '1px solid #eef0ea' : 0 }}>
              <div style={{ fontSize: 12.5 }}>{a.text}</div>
              <div style={{ fontSize: 11.5, color: '#8b918a' }}>{a.meta}</div>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}
