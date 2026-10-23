import { useState, type CSSProperties, type ReactNode } from 'react';

export function BrandMark({ size = 28, style }: { size?: number; style?: CSSProperties }) {
  const g = Math.round((size * 16) / 28);
  return (
    <span
      style={{
        width: size, height: size, borderRadius: Math.round((size * 6) / 28), background: 'var(--tc-green)', display: 'inline-grid',
        placeItems: 'center', flex: 'none', ...style,
      }}
    >
      <svg width={g} height={g} viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 8.5l3 3 6-7" style={{ fill: 'none', stroke: 'var(--tc-green-ink)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
      </svg>
    </span>
  );
}

interface NavItemProps {
  label: ReactNode;
  active?: boolean;
  badge?: number;
  count?: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
}

export function NavItem({ label, active = false, badge, count, onClick, style }: NavItemProps) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', padding: '9px 12px 9px 11px', border: 0,
        borderLeft: `3px solid ${active ? 'var(--tc-green)' : 'transparent'}`, borderRadius: 4,
        background: active ? 'var(--tc-shell-active)' : hover ? 'var(--tc-shell-fill-2)' : 'transparent', color: active ? '#fff' : 'var(--tc-shell-nav)',
        fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500, textAlign: 'left', cursor: 'pointer', ...style,
      }}
    >
      <span>{label}</span>
      {badge != null && badge !== 0 ? (
        <span
          style={{
            minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, background: 'var(--tc-orange)', color: '#fff', fontSize: 11,
            fontWeight: 600, display: 'grid', placeItems: 'center',
          }}
        >
          {badge}
        </span>
      ) : null}
      {count ? <span style={{ fontSize: 11.5, color: 'var(--tc-shell-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{count}</span> : null}
    </button>
  );
}
