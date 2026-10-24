import { useState } from 'react';
import { Button, FilterChip } from '../../../ds';
import type { BriefTurn } from '../../../game/content';

/** The AI's current question: click a choice (or several, then send), or type your own answer below. */
export function QuestionCard({ turn, disabled, onAnswer }: { turn: BriefTurn; disabled: boolean; onAnswer: (text: string) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <div role="group" aria-label="Question" style={{ border: '1px solid var(--tc-line-soft)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, background: '#fff' }}>
      <div style={{ fontWeight: 600, lineHeight: 1.4 }}>{turn.text}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(turn.choices ?? []).map(choice => (
          <FilterChip
            key={choice}
            selected={picked.includes(choice)}
            onClick={() => {
              if (disabled) return;
              if (!turn.multi) onAnswer(choice);
              else setPicked(p => (p.includes(choice) ? p.filter(x => x !== choice) : [...p, choice]));
            }}
          >
            {choice}
          </FilterChip>
        ))}
      </div>
      {turn.multi ? <Button variant="primary" size="sm" onClick={() => onAnswer(picked.join(', '))} disabled={disabled || !picked.length} style={{ alignSelf: 'flex-start' }}>Send answer</Button> : null}
      <div style={{ fontSize: 11.5, color: 'var(--tc-ink-5)' }}>Or type your own answer below.</div>
    </div>
  );
}
