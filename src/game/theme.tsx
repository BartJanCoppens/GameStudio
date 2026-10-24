import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { DEFAULT_TOKENS, type DesignTokens } from '../../supabase/functions/_shared/design.ts';
import { loadFont, themeVars } from './themeVars';

interface Props {
  tokens?: DesignTokens;
  /** Paint the page background too (full game screens), not just the variables. */
  page?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}

/** Everything inside shows in the design; without tokens, exactly as TaxConnect (no variables overridden). */
export function ThemeScope({ tokens, page = false, style, children }: Props) {
  const t = tokens ?? DEFAULT_TOKENS;
  useEffect(() => { loadFont(t.bodyFont); loadFont(t.headingFont); }, [t.bodyFont, t.headingFont]);
  return (
    <div style={{ ...(tokens ? themeVars(tokens) : null), ...(page ? { background: t.page, margin: '-26px -32px -140px', padding: '26px 32px 140px', minHeight: 'calc(100vh - 60px)' } : null), ...style }}>
      {children}
    </div>
  );
}
