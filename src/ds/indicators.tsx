import type { CSSProperties, ReactNode } from 'react';

export type Status = 'not-started' | 'in-progress' | 'submitted' | 'clarification' | 'accepted' | 'na';

const STATUS_LABELS: Record<Status, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  submitted: 'Submitted',
  clarification: 'Clarification required',
  accepted: 'Accepted',
  na: 'Not applicable',
};

const Check = ({ color }: { color: string }) => (
  <svg width="12" height="12" viewBox="0 0 16 16">
    <path d="M3.5 8.5l3 3 6-7" style={{ fill: 'none', stroke: color, strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
  </svg>
);

const Lock = ({ color }: { color: string }) => (
  <svg width="12" height="12" viewBox="0 0 16 16">
    <rect x="3" y="7" width="10" height="7" rx="1.5" style={{ fill: 'none', stroke: color, strokeWidth: 1.6 }} />
    <path d="M5.5 7V5a2.5 2.5 0 015 0v2" style={{ fill: 'none', stroke: color, strokeWidth: 1.6 }} />
  </svg>
);

interface StatusChipProps {
  status?: Status;
  label?: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: 'dot' | 'check' | 'lock' | 'none';
  style?: CSSProperties;
}

export function StatusChip({ status = 'not-started', label, size = 'sm', icon = 'dot', style }: StatusChipProps) {
  const s = STATUS_LABELS[status] ? status : 'not-started';
  const h = size === 'md' ? 30 : size === 'lg' ? 32 : size === 'xs' ? 22 : 24;
  const fg = `var(--status-${s}-fg)`;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: h >= 30 ? 8 : 7, height: h, padding: `0 ${h >= 30 ? 12 : h <= 22 ? 8 : 10}px`,
        borderRadius: 999, fontSize: h >= 30 ? (h === 32 ? 13 : 12.5) : h <= 22 ? 11.5 : 12, fontWeight: 600, background: `var(--status-${s}-bg)`,
        color: fg, whiteSpace: 'nowrap', lineHeight: 1, ...style,
      }}
    >
      {icon === 'check' ? <Check color={fg} /> : icon === 'lock' ? <Lock color={fg} /> : icon === 'none' ? null : (
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: `var(--status-${s}-dot)`, flex: 'none' }} />
      )}
      {label || STATUS_LABELS[s]}
    </span>
  );
}

const TAG_TONES = {
  neutral: { bg: 'var(--tc-surface-muted)', fg: 'var(--tc-ink-2)' },
  amber: { bg: 'var(--tc-amber-bg)', fg: 'var(--tc-amber-text)' },
  green: { bg: 'var(--tc-green-200)', fg: 'var(--tc-green-text)' },
  orange: { bg: 'var(--tc-orange-bg)', fg: 'var(--tc-orange-text)' },
  blue: { bg: 'var(--tc-blue-bg)', fg: 'var(--tc-blue-text)' },
  muted: { bg: 'var(--tc-line-faint)', fg: 'var(--tc-ink-4)' },
  source: { bg: 'var(--tc-surface-raised)', fg: 'var(--tc-ink-3)', border: '1px solid var(--tc-line-soft)', radius: 4, weight: 400 },
  bundle: { bg: 'var(--tc-surface-sunken)', fg: 'var(--tc-ink-3)', weight: 400, dot: 'var(--tc-green)' },
} satisfies Record<string, { bg: string; fg: string; border?: string; radius?: number; weight?: number; dot?: string }>;

export type TagTone = keyof typeof TAG_TONES;

export function Tag({ tone = 'neutral', children, style }: { tone?: TagTone; children?: ReactNode; style?: CSSProperties }) {
  const t: { bg: string; fg: string; border?: string; radius?: number; weight?: number; dot?: string } = TAG_TONES[tone] ?? TAG_TONES.neutral;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 22, padding: '0 8px', borderRadius: t.radius || 999, border: t.border || 0,
        fontSize: 11.5, fontWeight: t.weight || 600, background: t.bg, color: t.fg, whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden',
        textOverflow: 'ellipsis', ...style,
      }}
    >
      {t.dot ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.dot, flex: 'none' }} /> : null}
      {children}
    </span>
  );
}

export function Avatar({ initials = '', tone = 'dark', size = 28, style }: { initials?: string; tone?: 'dark' | 'green' | 'white'; size?: number; style?: CSSProperties }) {
  const bg = tone === 'green' ? 'var(--tc-green)' : tone === 'white' ? '#fff' : 'var(--tc-ink)';
  const fg = tone === 'dark' ? '#fff' : 'var(--tc-green-ink)';
  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%', background: bg, color: fg, fontSize: size >= 32 ? 12 : 11, fontWeight: 600,
        display: 'inline-grid', placeItems: 'center', flex: 'none', lineHeight: 1, ...style,
      }}
    >
      {initials}
    </span>
  );
}

interface ProgressRingProps {
  value?: number;
  size?: number;
  stroke?: number;
  track?: string;
  color?: string;
  style?: CSSProperties;
}

export function ProgressRing({ value = 0, size = 64, stroke = 7, track = 'var(--tc-surface-muted)', color = 'var(--tc-green)', style }: ProgressRingProps) {
  const r = (size / 64) * 26, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value)), half = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: 'none', ...style }} role="img" aria-label={`${Math.round(v * 100)}%`}>
      <circle cx={half} cy={half} r={r} style={{ fill: 'none', stroke: track, strokeWidth: stroke }} />
      <circle
        cx={half} cy={half} r={r} transform={`rotate(-90 ${half} ${half})`}
        style={{ fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeDasharray: `${v * c} ${c}` }}
      />
    </svg>
  );
}

export function Stepper({ steps = [], current = 0, style }: { steps?: string[]; current?: number; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, overflow: 'hidden', ...style }}>
      {steps.map((label, i) => {
        const done = i < current, now = i === current;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            <span
              style={{
                width: 22, height: 22, borderRadius: '50%', background: done ? 'var(--tc-green)' : now ? 'var(--tc-ink)' : '#fff',
                color: done ? 'var(--tc-green-ink)' : now ? '#fff' : 'var(--tc-ink-5)',
                border: `1px solid ${done ? 'var(--tc-green)' : now ? 'var(--tc-ink)' : 'var(--tc-line)'}`, fontSize: 11.5, fontWeight: 600,
                display: 'grid', placeItems: 'center',
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: i <= current ? 'var(--tc-ink)' : 'var(--tc-ink-5)' }}>{label}</span>
            {i < steps.length - 1 ? <span style={{ width: 28, height: 1, background: 'var(--tc-line)', marginLeft: 6 }} /> : null}
          </div>
        );
      })}
    </div>
  );
}
