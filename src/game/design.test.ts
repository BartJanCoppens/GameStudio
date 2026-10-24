import { describe, expect, it } from 'vitest';
import { DEFAULT_TOKENS, contrast, contrastChecks, designUsable, tokenProblems } from '../../supabase/functions/_shared/design.ts';

describe('design tokens', () => {
  it('computes WCAG contrast', () => {
    expect(contrast('#000000', '#FFFFFF')).toBe(21);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBe(1);
  });
  it('passes the built-in TaxConnect look, with the green accent only as a warning', () => {
    expect(tokenProblems(DEFAULT_TOKENS)).toEqual([]);
    expect(designUsable(DEFAULT_TOKENS)).toBe(true);
    expect(contrastChecks(DEFAULT_TOKENS).filter(c => !c.ok).map(c => c.label)).toEqual(['Accent against cards']);
  });
  it('rejects unknown fonts, bad colours and radii', () => {
    expect(tokenProblems({ ...DEFAULT_TOKENS, accent: 'green', radius: 40, bodyFont: 'comic-sans' })).toHaveLength(3);
  });
});
