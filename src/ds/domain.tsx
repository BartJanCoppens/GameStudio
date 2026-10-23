import { useState, type CSSProperties, type ReactNode } from 'react';

export function ChatBubble({ role = 'assistant', children, sources, style }: { role?: 'user' | 'assistant'; children?: ReactNode; sources?: string[]; style?: CSSProperties }) {
  const user = role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: user ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '86%', padding: '10px 12px', borderRadius: 6, background: user ? 'var(--tc-ink)' : 'var(--tc-surface-sunken)',
          color: user ? '#fff' : 'var(--tc-ink)', fontSize: 13, lineHeight: 1.45, textWrap: 'pretty', ...style,
        }}
      >
        {children}
        {sources && sources.length ? (
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {sources.map((s, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, height: 22, padding: '0 8px', borderRadius: 999, background: '#fff',
                  border: '1px solid var(--tc-line-soft)', fontSize: 11.5, color: 'var(--tc-ink-3)',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--tc-green)' }} />
                {s}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const NODE_BG: Record<string, string> = { profile: 'var(--tc-surface-sunken)', outcome: 'var(--tc-surface-muted)', base: '#f7f7f5' };

export type FlowNodeKind = 'profile' | 'screening' | 'base' | 'followup' | 'outcome' | 'client' | 'clientOutcome' | 'add';
export type FlowNodeState = 'default' | 'selected' | 'related' | 'dimmed';

interface FlowNodeProps {
  title: ReactNode;
  sub?: ReactNode;
  kind?: FlowNodeKind;
  state?: FlowNodeState;
  recent?: boolean;
  width?: number;
  onClick?: () => void;
  style?: CSSProperties;
}

export function FlowNode({ title, sub, kind = 'screening', state = 'default', recent = false, width = 198, onClick, style }: FlowNodeProps) {
  const [hover, setHover] = useState(false);
  const sel = state === 'selected', rel = state === 'related', dim = state === 'dimmed';
  const client = kind === 'client' || kind === 'clientOutcome' || kind === 'add';
  const bd = sel ? 'var(--tc-ink)' : rel ? 'var(--tc-green-deep)' : hover ? 'var(--tc-green)' : client ? 'var(--tc-green)' : kind === 'profile' ? 'var(--tc-canvas-profile)' : 'var(--tc-canvas-node)';
  const { opacity: styleOpacity, ...rest } = style || {};
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', width, height: 38, border: `${sel ? 2 : rel ? 1.5 : 1}px ${kind === 'add' ? 'dashed' : 'solid'} ${bd}`, borderRadius: 5,
        background: NODE_BG[kind] || '#fff', padding: '3px 9px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'flex-start', textAlign: 'left', cursor: 'pointer', color: 'var(--tc-ink)', overflow: 'hidden', fontFamily: 'inherit',
        boxShadow: sel ? '0 0 0 3px rgba(134,188,37,.45)' : 'none', transition: 'opacity .15s', ...rest,
        opacity: dim ? 0.3 : styleOpacity != null ? styleOpacity : 1,
      }}
    >
      <span style={{ fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{title}</span>
      {sub ? <span style={{ fontSize: 10.5, color: 'var(--tc-ink-5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{sub}</span> : null}
      {recent && !client ? <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: 'var(--tc-amber)' }} /> : null}
    </button>
  );
}

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  sub?: ReactNode;
  size?: 'md' | 'lg';
  style?: CSSProperties;
}

export function StatCard({ label, value, unit, sub, size = 'lg', style }: StatCardProps) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--tc-line-soft)', borderRadius: 6, padding: '14px 18px', ...style }}>
      <div style={{ fontSize: 12, color: 'var(--tc-ink-5)' }}>{label}</div>
      <div style={{ fontSize: size === 'md' ? 16 : 22, fontWeight: 600, lineHeight: 1.2, marginTop: size === 'md' ? 2 : 0 }}>
        {value} {unit ? <span style={{ fontSize: 13, color: 'var(--tc-ink-5)', fontWeight: 500 }}>{unit}</span> : null}
      </div>
      {sub ? <div style={{ fontSize: 12, color: 'var(--tc-ink-5)' }}>{sub}</div> : null}
    </div>
  );
}
