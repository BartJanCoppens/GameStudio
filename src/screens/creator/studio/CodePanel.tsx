import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../ds';
import type { BuildStep } from '../../../game/studio/useBuilder';
import { card } from '../../../shell/styles';

function StepTimer({ step }: { step: BuildStep }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (step.status !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [step.status]);
  const s = step.status === 'running' ? Math.max(0, Math.floor((now - step.started) / 1000)) : step.seconds;
  return <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--tc-ink-4)', fontSize: 12 }}>{step.status === 'waiting' ? '' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`}</span>;
}

const ICON: Record<BuildStep['status'], string> = { waiting: '○', running: '◐', done: '✓', failed: '✕' };

/** The build as it happens: the steps with their timers, and the code of the running step as it is written. */
export function CodePanel({ steps, live, onRetry }: { steps: BuildStep[]; live: { step: string; text: string } | null; onRetry: (id: BuildStep['id']) => void }) {
  const code = useRef<HTMLPreElement>(null);
  useEffect(() => { if (code.current) code.current.scrollTop = code.current.scrollHeight; }, [live?.text]);
  const tail = live ? live.text.split('\n').slice(-80).join('\n') : '';
  return (
    <section aria-label="Build" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ol aria-label="Build steps" style={{ ...card, listStyle: 'none', margin: 0, padding: '6px 0' }}>
        {steps.map(s => (
          <li key={s.id} aria-label={`${s.label}: ${s.status}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderTop: s.id === 'data' ? 0 : '1px solid var(--tc-line-hair)' }}>
            <span aria-hidden="true" style={{ width: 16, color: s.status === 'done' ? 'var(--tc-green-text)' : s.status === 'failed' ? 'var(--tc-red-text)' : 'var(--tc-ink-4)', fontWeight: 700 }}>{ICON[s.status]}</span>
            <span style={{ flex: 1, fontWeight: s.status === 'running' ? 600 : 400 }}>{s.label}{s.error ? <span style={{ display: 'block', fontSize: 12, color: 'var(--tc-red-text)' }}>{s.error}</span> : null}</span>
            <StepTimer step={s} />
            {s.status === 'failed' ? <Button variant="secondary" size="sm" onClick={() => onRetry(s.id)}>Retry</Button> : null}
          </li>
        ))}
      </ol>
      <pre
        ref={code}
        aria-label="Code being written"
        style={{ margin: 0, height: 'calc(100vh - 420px)', minHeight: 280, overflow: 'auto', background: '#14171a', color: '#d6e2c4', borderRadius: 8, padding: '14px 16px', fontSize: 11.5, lineHeight: 1.5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {tail || (steps.every(s => s.status === 'waiting') ? 'Starting the build…' : steps.some(s => s.status === 'failed') ? 'A step failed. Retry it above.' : '')}
      </pre>
    </section>
  );
}
