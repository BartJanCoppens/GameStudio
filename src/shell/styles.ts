import type { CSSProperties } from 'react';

// Inline style fragments the prototype repeats on every screen.

export const card: CSSProperties = { background: '#fff', border: '1px solid #e1e5dc', borderRadius: 6, overflow: 'hidden' };
export const cardHead: CSSProperties = { padding: '14px 18px', borderBottom: '1px solid #eef0ea', fontWeight: 600 };
export const eyebrow: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#5a6058' };
/** A Table sitting inside a card: the card supplies the border. */
export const flush: CSSProperties = { border: 0, borderRadius: 0 };
export const dot = (background: string, size = 7): CSSProperties => ({ width: size, height: size, borderRadius: '50%', background, flex: 'none' });
