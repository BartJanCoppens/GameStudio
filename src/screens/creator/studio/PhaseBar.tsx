import type { GameContent } from '../../../game/content';

const PHASES: { id: GameContent['phase']; label: string }[] = [
  { id: 'questions', label: 'Questions' },
  { id: 'design', label: 'Design' },
  { id: 'code', label: 'Code' },
  { id: 'ready', label: 'Test & publish' },
];

/** Where the game is: Questions · Design · Code · Test & publish. */
export function PhaseBar({ phase }: { phase: GameContent['phase'] }) {
  const at = PHASES.findIndex(p => p.id === phase);
  return (
    <ol aria-label="Phases" style={{ display: 'flex', gap: 6, listStyle: 'none', margin: 0, padding: 0, flexWrap: 'wrap' }}>
      {PHASES.map((p, i) => {
        const state = i < at ? 'done' : i === at ? 'current' : 'next';
        return (
          <li key={p.id} aria-current={state === 'current' ? 'step' : undefined} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
            background: state === 'current' ? 'var(--tc-ink)' : state === 'done' ? 'var(--tc-green-200)' : 'var(--tc-surface-muted)',
            color: state === 'current' ? '#fff' : state === 'done' ? 'var(--tc-green-text)' : 'var(--tc-ink-4)',
          }}>
            <span aria-hidden="true">{state === 'done' ? '✓' : i + 1}</span>{p.label}
          </li>
        );
      })}
    </ol>
  );
}
