// Design systems: the look players see in a game. Shared by the app and the design-ai Edge Function.
// Plain TypeScript, no imports: Deno and Vite both load it.

export const FONTS = [
  { id: 'ibm-plex-sans', family: 'IBM Plex Sans', css: 'IBM+Plex+Sans:wght@400;500;600' },
  { id: 'inter', family: 'Inter', css: 'Inter:wght@400;500;600' },
  { id: 'source-sans-3', family: 'Source Sans 3', css: 'Source+Sans+3:wght@400;500;600' },
  { id: 'lato', family: 'Lato', css: 'Lato:wght@400;700' },
  { id: 'nunito-sans', family: 'Nunito Sans', css: 'Nunito+Sans:wght@400;600' },
  { id: 'work-sans', family: 'Work Sans', css: 'Work+Sans:wght@400;500;600' },
  { id: 'dm-sans', family: 'DM Sans', css: 'DM+Sans:wght@400;500;600' },
  { id: 'libre-franklin', family: 'Libre Franklin', css: 'Libre+Franklin:wght@400;500;600' },
  { id: 'space-grotesk', family: 'Space Grotesk', css: 'Space+Grotesk:wght@400;500;600' },
  { id: 'merriweather', family: 'Merriweather', css: 'Merriweather:wght@400;700' },
  { id: 'source-serif-4', family: 'Source Serif 4', css: 'Source+Serif+4:wght@400;600' },
  { id: 'roboto-slab', family: 'Roboto Slab', css: 'Roboto+Slab:wght@400;500;600' },
] as const;

export type FontId = (typeof FONTS)[number]['id'];

export interface DesignTokens {
  /** Primary buttons, progress, highlights. */
  accent: string;
  /** Text on the accent colour. */
  accentInk: string;
  /** Body text. */
  ink: string;
  /** Secondary text. */
  muted: string;
  /** Page background. */
  page: string;
  /** Cards and panels. */
  surface: string;
  /** Borders. */
  line: string;
  /** Corner radius in px, 0–16. */
  radius: number;
  bodyFont: FontId;
  headingFont: FontId;
}

export const COLOR_KEYS = ['accent', 'accentInk', 'ink', 'muted', 'page', 'surface', 'line'] as const;

/** TaxConnect: the look a game has when no design system is chosen. */
export const DEFAULT_TOKENS: DesignTokens = {
  accent: '#86BC25', accentInk: '#10180A', ink: '#1A1D18', muted: '#5A6058', page: '#F3F5F0', surface: '#FFFFFF', line: '#E1E5DC',
  radius: 6, bodyFont: 'ibm-plex-sans', headingFont: 'ibm-plex-sans',
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** What is wrong with a set of tokens, structurally (contrast is checked separately). */
export function tokenProblems(t: unknown): string[] {
  const p: string[] = [];
  const o = (t ?? {}) as Record<string, unknown>;
  for (const k of COLOR_KEYS) if (typeof o[k] !== 'string' || !HEX.test(o[k] as string)) p.push(`${k} must be a colour like #1A2B3C`);
  if (typeof o.radius !== 'number' || !Number.isInteger(o.radius) || o.radius < 0 || o.radius > 16) p.push('radius must be a whole number from 0 to 16');
  for (const k of ['bodyFont', 'headingFont']) if (!FONTS.some(f => f.id === o[k])) p.push(`${k} must be one of the offered fonts`);
  return p;
}

const channel = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};

/** WCAG 2 contrast ratio, 1–21. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}

export interface ContrastCheck {
  label: string;
  ratio: number;
  min: number;
  ok: boolean;
  /** Blocking checks must pass before a design can be saved; advisory ones are shown as a warning. */
  blocking: boolean;
}

/**
 * WCAG AA: 4.5 for text (blocking). The accent against cards (3) is advisory: buttons carry their own
 * readable text, but a faint accent makes progress bars and highlights harder to see.
 */
export function contrastChecks(t: DesignTokens): ContrastCheck[] {
  const check = (label: string, a: string, b: string, min: number, blocking = true) => { const ratio = contrast(a, b); return { label, ratio, min, ok: ratio >= min, blocking }; };
  return [
    check('Text on cards', t.ink, t.surface, 4.5),
    check('Text on the page', t.ink, t.page, 4.5),
    check('Secondary text on cards', t.muted, t.surface, 4.5),
    check('Text on the accent', t.accentInk, t.accent, 4.5),
    check('Accent against cards', t.accent, t.surface, 3, false),
  ];
}

/** A design players may get: valid tokens that pass every blocking check. */
export const designUsable = (t: DesignTokens) => tokenProblems(t).length === 0 && contrastChecks(t).every(c => c.ok || !c.blocking);
