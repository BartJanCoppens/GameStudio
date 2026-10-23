import type { CSSProperties, ReactNode } from 'react';

export interface Column<R> {
  key: string;
  label: ReactNode;
  width?: string;
  align?: 'left' | 'right' | 'center';
  numeric?: boolean;
  muted?: boolean;
  strong?: boolean;
  wrap?: boolean;
  render?: (row: R) => ReactNode;
}

interface TableProps<R> {
  columns: Column<R>[];
  rows: R[];
  rowKey?: keyof R;
  minWidth?: number;
  compact?: boolean;
  rowStyle?: (row: R) => CSSProperties;
  style?: CSSProperties;
}

export function Table<R>({ columns, rows, rowKey, minWidth, compact = false, rowStyle, style }: TableProps<R>) {
  const cols = columns.map(c => c.width || 'minmax(0,1fr)').join(' ');
  const pad = compact ? '9px 12px' : '10px 10px';
  return (
    <div role="table" style={{ background: '#fff', border: '1px solid var(--tc-line-soft)', borderRadius: 6, overflowX: 'auto', ...style }}>
      <div style={{ minWidth }}>
        <div
          role="row"
          style={{
            display: 'grid', gridTemplateColumns: cols, fontSize: 11.5, fontWeight: 600, color: 'var(--tc-ink-3)', textTransform: 'uppercase',
            letterSpacing: '.04em', borderBottom: '1px solid var(--tc-line-soft)', background: 'var(--tc-surface-raised)',
          }}
        >
          {columns.map(c => (
            <div key={c.key} role="columnheader" style={{ padding: pad, textAlign: c.align || 'left', whiteSpace: 'nowrap' }}>{c.label}</div>
          ))}
        </div>
        {rows.map((row, ri) => (
          <div
            key={rowKey ? String(row[rowKey]) : ri}
            role="row"
            style={{ display: 'grid', gridTemplateColumns: cols, fontSize: 13, alignItems: 'center', borderBottom: '1px solid var(--tc-line-hair)', ...(rowStyle ? rowStyle(row) : null) }}
          >
            {columns.map(c => (
              <div
                key={c.key}
                role="cell"
                style={{
                  padding: pad, textAlign: c.align || 'left', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: c.wrap ? 'normal' : 'nowrap',
                  fontVariantNumeric: c.align === 'right' || c.numeric ? 'tabular-nums' : undefined, color: c.muted ? 'var(--tc-ink-3)' : undefined,
                  fontWeight: c.strong ? 500 : undefined,
                }}
              >
                {c.render ? c.render(row) : (row[c.key as keyof R] as ReactNode)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface TabsProps<V extends string> {
  tabs: { value: V; label: ReactNode }[];
  value: V;
  onChange?: (v: V) => void;
  style?: CSSProperties;
}

export function Tabs<V extends string>({ tabs, value, onChange, style }: TabsProps<V>) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--tc-line-soft)', ...style }}>
      {tabs.map(t => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange?.(t.value)}
            style={{
              height: 40, padding: '0 14px', border: 0, borderBottom: `2px solid ${on ? 'var(--tc-green)' : 'transparent'}`, marginBottom: -1,
              background: 'none', color: on ? 'var(--tc-ink)' : 'var(--tc-ink-3)', fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

const BANNER_TONES = {
  success: { bg: 'var(--tc-green-200)', border: '1px solid var(--tc-green-300)', fg: 'var(--tc-green-text)', dot: null },
  info: { bg: 'var(--tc-blue-bg)', border: '1px solid var(--tc-blue-line)', fg: 'var(--tc-blue-text)', dot: 'var(--tc-blue)' },
  warning: { bg: 'var(--tc-amber-bg-soft)', border: '1px solid var(--tc-amber-line)', fg: 'var(--tc-amber-text)', dot: null },
  dark: { bg: 'var(--tc-ink)', border: '0', fg: '#fff', dot: 'var(--tc-green)' },
};

interface BannerProps {
  tone?: keyof typeof BANNER_TONES;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  onDismiss?: () => void;
  icon?: ReactNode;
  style?: CSSProperties;
}

export function Banner({ tone = 'success', title, children, actions, onDismiss, icon, style }: BannerProps) {
  const t = BANNER_TONES[tone] ?? BANNER_TONES.success;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: tone === 'dark' ? '16px 20px' : '14px 18px', borderRadius: 6,
        background: t.bg, border: t.border, color: t.fg, fontSize: 13, ...style,
      }}
    >
      {icon ? icon : t.dot ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.dot, flex: 'none' }} /> : null}
      <span style={{ flex: '1 1 320px', minWidth: 0, textWrap: 'pretty', color: tone === 'dark' ? 'var(--tc-shell-text)' : undefined }}>
        {title ? <strong style={{ color: t.fg }}>{title} </strong> : null}
        {children}
      </span>
      {actions ? <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{actions}</span> : null}
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" style={{ background: 'none', border: 0, padding: '0 2px', color: t.fg, fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>
          ×
        </button>
      ) : null}
    </div>
  );
}

export function Toast({ children, bottom = 72, style }: { children?: ReactNode; bottom?: number; style?: CSSProperties }) {
  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: '50%', bottom, transform: 'translateX(-50%)', background: 'var(--tc-ink)', color: '#fff', padding: '10px 16px',
        borderRadius: 6, fontSize: 13, boxShadow: 'var(--shadow-toast)', zIndex: 50, animation: 'tc-toast .18s ease', whiteSpace: 'nowrap',
        maxWidth: 'calc(100vw - 48px)', overflow: 'hidden', textOverflow: 'ellipsis', ...style,
      }}
    >
      {children}
    </div>
  );
}
