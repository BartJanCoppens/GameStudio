import type { CSSProperties } from 'react';
import { Button, StatusChip, Tag } from '../../ds';
import { QUESTIONS, RESET_RUN, TIMER } from '../../data/player';
import { useApp } from '../../app/useApp';
import { BackLink, Screen } from '../../shell/ui';
import { eyebrow } from '../../shell/styles';


export function Play() {
  const { s, set } = useApp();
  const q = QUESTIONS[s.qi];
  const answered = s.picked !== null;
  const correctPick = answered && s.picked === q.answer;
  const last = s.qi === QUESTIONS.length - 1;
  const progress = `${Math.round(((s.qi + (answered ? 1 : 0)) / QUESTIONS.length) * 100)}%`;

  const pick = (i: number) => {
    if (answered) return;
    const ok = i === q.answer;
    set({ picked: i, score: s.score + (ok ? q.points : 0), correct: s.correct + (ok ? 1 : 0) });
  };
  const next = () => set(last ? { screen: 'results' } : { qi: s.qi + 1, picked: null });

  const optionStyle = (i: number): CSSProperties => {
    let bg = '#fff', border = '#d5dacf', color = '#1a1d18';
    if (answered && i === q.answer) { bg = '#eef7dc'; border = '#c9e39a'; color = '#3f6a0a'; }
    else if (answered && i === s.picked) { bg = '#fbe9e7'; border = '#d14537'; color = '#9a2b22'; }
    return {
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: 6, border: `1px solid ${border}`,
      background: bg, color, font: 'inherit', fontSize: 13.5, cursor: answered ? 'default' : 'pointer',
    };
  };

  return (
    <Screen label="Player · In game" narrow={860}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <BackLink onClick={() => set(RESET_RUN)}>← Back to your games</BackLink>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#5a6058' }}>
          <span>VAT rates ladder · Level 2 of 4</span>
          <span style={{ color: '#d5dacf' }}>·</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{TIMER[s.qi]}</span>
        </div>
      </div>
      <div role="progressbar" aria-valuenow={parseInt(progress)} aria-valuemin={0} aria-valuemax={100} style={{ height: 4, background: '#eef0ec', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: '#86BC25', width: progress }} />
      </div>
      <div style={{ background: '#fff', border: '1px solid #e1e5dc', borderRadius: 6, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={eyebrow}>Question {s.qi + 1} of {QUESTIONS.length} · {q.points} points</div>
        <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.35, textWrap: 'pretty' }}>{q.prompt}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.options.map((text, i) => (
            <button key={i} type="button" onClick={() => pick(i)} disabled={answered} style={optionStyle(i)}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid #d5dacf', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 600, flex: 'none' }}>
                {'ABCD'[i]}
              </span>
              <span style={{ textAlign: 'left' }}>{text}</span>
            </button>
          ))}
        </div>
        {answered ? (
          <div style={{ borderTop: '1px solid #eef0ea', paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusChip status={correctPick ? 'accepted' : 'clarification'} label={correctPick ? `Correct · +${q.points}` : 'Not quite'} size="sm" />
              <span style={{ color: '#5a6058' }}>{q.explain}</span>
            </div>
            <div style={{ background: '#fafbf8', border: '1px solid #e1e5dc', borderRadius: 6, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#5a6058', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600 }}>Source passage</span>
                <Tag tone="source">{q.sourceDoc}</Tag>
                <span>{q.sourceLoc}</span>
              </div>
              <div style={{ fontSize: 13, color: '#1a1d18', lineHeight: 1.5, borderLeft: '2px solid #86BC25', paddingLeft: 12 }}>“{q.passage}”</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" size="lg" onClick={next}>{last ? 'See results →' : 'Next question →'}</Button>
            </div>
          </div>
        ) : null}
      </div>
    </Screen>
  );
}
