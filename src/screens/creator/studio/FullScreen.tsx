import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../../../ds';

/**
 * A preview that can fill the screen. The same element is restyled rather than moved, so a running game in
 * an iframe keeps its state when it goes full screen and back.
 */
export function FullScreen({ label, children }: { label: string; children: (full: boolean) => ReactNode }) {
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);
  return (
    <div
      role={full ? 'dialog' : undefined}
      aria-label={full ? `${label} · full screen` : undefined}
      style={full
        ? { position: 'fixed', inset: 0, zIndex: 50, background: '#14171a', display: 'flex', flexDirection: 'column' }
        : { display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...(full ? { padding: '10px 16px', color: '#fff' } : {}) }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: full ? '#c9cec5' : 'var(--tc-ink-4)', flex: 1 }}>{label}</span>
        <Button variant="secondary" size="sm" onClick={() => setFull(f => !f)}>{full ? 'Exit full screen' : 'Full screen'}</Button>
      </div>
      <div style={full ? { flex: 1, minHeight: 0, padding: '0 16px 16px' } : undefined}>{children(full)}</div>
    </div>
  );
}
