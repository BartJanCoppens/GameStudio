import { describe, expect, it } from 'vitest';
import { DEFAULT_TOKENS } from '../../supabase/functions/_shared/design.ts';
import { safeTokens } from './themeVars';

describe('safeTokens', () => {
  it('passes valid tokens through', () => {
    expect(safeTokens(DEFAULT_TOKENS)).toEqual(DEFAULT_TOKENS);
  });
  it('drops tokens that could inject CSS', () => {
    expect(safeTokens({ ...DEFAULT_TOKENS, surface: 'url(https://evil.example/x)' })).toBeUndefined();
    expect(safeTokens({ ...DEFAULT_TOKENS, radius: '6px; background: red' })).toBeUndefined();
    expect(safeTokens({ ...DEFAULT_TOKENS, bodyFont: "x'; } body { display:none" })).toBeUndefined();
  });
  it('drops missing tokens', () => {
    expect(safeTokens(null)).toBeUndefined();
    expect(safeTokens(undefined)).toBeUndefined();
  });
});
