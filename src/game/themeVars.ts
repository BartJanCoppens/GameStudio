import type { CSSProperties } from 'react';
import { FONTS, contrast, type DesignTokens, type FontId } from '../../supabase/functions/_shared/design.ts';

// A design system as CSS: its colours, radius and fonts become the TaxConnect variables, so the
// design-system components inside a ThemeScope pick them up.

const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/** a blended towards b by t (0–1). */
export function mix(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => hex(v + (y[i] - v) * t)).join('')}`;
}

/** The accent, darkened (or lightened on a dark card) until it reads as text on the card. */
function readableOn(color: string, background: string): string {
  const towards = contrast('#000000', background) > contrast('#FFFFFF', background) ? '#000000' : '#FFFFFF';
  let c = color;
  for (let i = 0; i < 20 && contrast(c, background) < 4.5; i++) c = mix(c, towards, 0.12);
  return c;
}

export const fontFamily = (id: FontId) => `'${FONTS.find(f => f.id === id)?.family ?? 'IBM Plex Sans'}', system-ui, sans-serif`;

const loaded = new Set<string>(['ibm-plex-sans']);
export function loadFont(id: FontId) {
  if (loaded.has(id)) return;
  const font = FONTS.find(f => f.id === id);
  if (!font) return;
  loaded.add(id);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${font.css}&display=swap`;
  document.head.appendChild(link);
}

/** Status colours (warnings, errors, info) keep their hue but are tinted from the design's cards, so they work on dark designs too. */
const HUES = { amber: '#E0A100', orange: '#E2672A', red: '#D14537', blue: '#2F7FC1' } as const;

function statusVars(t: DesignTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, hue] of Object.entries(HUES)) {
    vars[`--tc-${name}-bg-soft`] = mix(t.surface, hue, 0.12);
    vars[`--tc-${name}-bg`] = mix(t.surface, hue, 0.2);
    vars[`--tc-${name}-line`] = mix(t.surface, hue, 0.45);
    vars[`--tc-${name}-text`] = readableOn(hue, mix(t.surface, hue, 0.2));
  }
  return vars;
}

export function themeVars(t: DesignTokens): CSSProperties {
  const link = readableOn(t.accent, t.surface);
  return {
    ...statusVars(t),
    '--tc-green-50': mix(t.surface, t.accent, 0.04),
    '--tc-green-400': mix(t.surface, t.accent, 0.55),
    '--tc-green-mid': link,
    '--tc-ink-hover': mix(t.ink, t.surface, 0.15),
    '--tc-line-faint': mix(t.line, t.surface, 0.6),
    '--tc-line-strong': mix(t.line, t.ink, 0.3),
    '--tc-surface-chip': mix(t.line, t.surface, 0.3),
    '--tc-surface-footer': mix(t.surface, t.page, 0.6),
    '--tc-dot-neutral': mix(t.muted, t.surface, 0.3),
    '--tc-dot-na': mix(t.muted, t.surface, 0.5),
    '--tc-green': t.accent,
    '--tc-green-hover': mix(t.accent, t.ink, 0.12),
    '--tc-green-ink': t.accentInk,
    '--tc-green-deep': link,
    '--tc-green-text': link,
    '--tc-green-100': mix(t.surface, t.accent, 0.08),
    '--tc-green-200': mix(t.surface, t.accent, 0.18),
    '--tc-green-300': mix(t.surface, t.accent, 0.4),
    '--tc-ink': t.ink,
    '--tc-ink-2': t.muted,
    '--tc-ink-3': t.muted,
    '--tc-ink-4': t.muted,
    '--tc-ink-5': t.muted,
    '--tc-line': mix(t.line, t.ink, 0.1),
    '--tc-line-soft': t.line,
    '--tc-line-hair': mix(t.line, t.surface, 0.5),
    '--tc-surface': t.surface,
    '--tc-surface-raised': mix(t.surface, t.page, 0.5),
    '--tc-surface-sunken': t.page,
    '--tc-surface-muted': mix(t.line, t.surface, 0.5),
    '--game-radius': `${t.radius}px`,
    '--game-heading-font': fontFamily(t.headingFont),
    fontFamily: fontFamily(t.bodyFont),
    color: t.ink,
  } as CSSProperties;
}

/** Headings in the design's heading font. */
export const headingFont: CSSProperties = { fontFamily: 'var(--game-heading-font, inherit)' };
