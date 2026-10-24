import type { CSSProperties } from 'react';

// Inline style fragments the prototype repeats on every screen.

export const card: CSSProperties = { background: 'var(--tc-surface)', border: '1px solid var(--tc-line-soft)', borderRadius: 'var(--game-radius, 6px)', overflow: 'hidden' };
export const cardHead: CSSProperties = { padding: '14px 18px', borderBottom: '1px solid var(--tc-line-hair)', fontWeight: 600 };
export const eyebrow: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--tc-ink-3)' };
/** A Table sitting inside a card: the card supplies the border. */
export const flush: CSSProperties = { border: 0, borderRadius: 0 };
export const dot = (background: string, size = 7): CSSProperties => ({ width: size, height: size, borderRadius: '50%', background, flex: 'none' });
