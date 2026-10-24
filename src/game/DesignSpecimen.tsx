import { ProgressRing, StatusChip } from '../ds';
import type { DesignTokens } from '../../supabase/functions/_shared/design.ts';
import { ThemeScope } from './theme';
import { headingFont } from './themeVars';

/** A small piece of a game screen in a design: what players will see. */
export function DesignSpecimen({ tokens, title, compact = false }: { tokens?: DesignTokens; title: string; compact?: boolean }) {
  return (
    <ThemeScope tokens={tokens} style={{ background: tokens?.page ?? 'var(--tc-surface-sunken)', padding: compact ? 10 : 16, borderRadius: 8 }}>
      <div style={{ background: 'var(--tc-surface)', border: '1px solid var(--tc-line-soft)', borderRadius: 'var(--game-radius, 6px)', padding: compact ? 12 : 16, display: 'flex', gap: 14, alignItems: 'center' }}>
        {compact ? null : <ProgressRing value={0.7} size={48} stroke={6} />}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: compact ? 13.5 : 16, fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...headingFont }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--tc-ink-3)' }}>Invoice 3 of 8 · 12:40 left</div>
          {compact ? null : <div style={{ marginTop: 4 }}><StatusChip status="accepted" label="Correct · +10 points" size="xs" /></div>}
        </div>
        {/* Looks like the primary button but isn't one: the specimen sits inside clickable cards. */}
        <span aria-hidden="true" style={{ height: compact ? 30 : 34, padding: compact ? '0 12px' : '0 16px', display: 'inline-flex', alignItems: 'center', borderRadius: 'var(--game-radius, 6px)', background: 'var(--tc-green)', color: 'var(--tc-green-ink)', fontWeight: 600, fontSize: compact ? 12.5 : 13 }}>{compact ? 'Play' : 'Submit'}</span>
      </div>
    </ThemeScope>
  );
}
