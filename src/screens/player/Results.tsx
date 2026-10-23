import { ProgressRing, Table } from '../../ds';
import { MAX_SCORE, QUESTIONS, RESET_RUN } from '../../data/player';
import { leaderboard } from '../../data/shared';
import { useApp } from '../../app/useApp';
import { BackLink, Screen } from '../../shell/ui';
import { card, cardHead, dot, eyebrow, flush } from '../../shell/styles';
import { leaderboardColumns } from './leaderboardColumns';

export function Results() {
  const { s, set } = useApp();
  const answered = s.picked !== null;
  return (
    <Screen label="Player · Results" narrow={860}>
      <BackLink onClick={() => set(RESET_RUN)}>← Back to your games</BackLink>
      <div style={{ background: '#fff', border: '1px solid #e1e5dc', borderRadius: 6, padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <ProgressRing value={s.score / MAX_SCORE} size={72} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={eyebrow}>Level 2 complete</div>
          <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2, marginTop: 4 }}>{s.score} of {MAX_SCORE} points</div>
          <div style={{ color: '#5a6058', marginTop: 4 }}>{s.correct} of {QUESTIONS.length} correct · Level 3 unlocks tomorrow · answers feed your “Rates” badge</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#eef7dc', border: '1px solid #c9e39a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#3f6a0a' }}>R</div>
          <div>
            <div style={{ fontWeight: 600 }}>Rates badge · 2 of 4 levels</div>
            <div style={{ fontSize: 12, color: '#8b918a' }}>Certificate at level 4</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: '1 1 400px' }}>
          <div style={cardHead}>Leaderboard · Analysts · Brussels</div>
          <Table columns={leaderboardColumns} rows={leaderboard(s.score)} rowKey="rank" compact style={flush} />
        </div>
        <div style={{ flex: '0 1 300px', background: '#fff', border: '1px solid #e1e5dc', borderRadius: 6, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 600 }}>Review your answers</div>
          {QUESTIONS.map((q, i) => (
            <div key={q.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid #eef0ea' }}>
              <span style={{ ...dot(i < s.qi || (i === s.qi && answered) ? '#86BC25' : '#a0a69d'), marginTop: 6 }} />
              <div>
                <div style={{ fontWeight: 500 }}>Q{i + 1} · {q.explain}</div>
                <div style={{ fontSize: 12, color: '#5a6058' }}>{q.sourceDoc} · {q.sourceLoc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}
