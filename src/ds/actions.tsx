import { useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';

export interface Option<V extends string = string> {
  value: V;
  label: ReactNode;
}

const BUTTON_VARIANTS = {
  primary: { bg: 'var(--tc-green)', hover: 'var(--tc-green-hover)', fg: 'var(--tc-green-ink)', border: '0', weight: 600 },
  dark: { bg: 'var(--tc-ink)', hover: 'var(--tc-ink-hover)', fg: '#fff', border: '0', weight: 600 },
  secondary: { bg: '#fff', hover: 'var(--tc-surface-sunken)', fg: 'var(--tc-ink)', border: '1px solid var(--tc-line)', weight: 500 },
  accent: { bg: 'var(--tc-green-100)', hover: 'var(--tc-green-200)', fg: 'var(--tc-ink)', border: '1px solid var(--tc-green)', weight: 600 },
  onDark: { bg: 'transparent', hover: 'var(--tc-shell-fill-2)', fg: '#fff', border: '1px solid var(--tc-shell-line-4)', weight: 500 },
};
const BUTTON_HEIGHTS = { sm: 30, md: 32, lg: 34, xl: 36, '2xl': 40, '3xl': 42 };

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: ButtonVariant;
  size?: keyof typeof BUTTON_HEIGHTS;
  fullWidth?: boolean;
  leading?: ReactNode;
  style?: CSSProperties;
}

export function Button({ variant = 'primary', size = 'md', disabled = false, fullWidth = false, leading, children, style, type = 'button', ...rest }: ButtonProps) {
  const [hover, setHover] = useState(false);
  const v = BUTTON_VARIANTS[variant] ?? BUTTON_VARIANTS.primary;
  const h = BUTTON_HEIGHTS[size] ?? 32;
  const padX = h >= 40 ? 18 : h >= 34 ? 14 : 12;
  const fs = h >= 40 ? 14 : h <= 30 ? 12.5 : 13;
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: h, padding: `0 ${padX}px`,
        border: v.border, borderRadius: 6, background: hover && !disabled ? v.hover : v.bg, color: v.fg, fontFamily: 'inherit',
        fontSize: fs, fontWeight: v.weight, lineHeight: 1, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap', width: fullWidth ? '100%' : undefined, ...style,
      }}
    >
      {leading}
      {children}
    </button>
  );
}

const LINK_TONES = {
  link: { fg: 'var(--tc-green-deep)', hoverFg: 'var(--tc-green-deep)', underline: false },
  onTint: { fg: 'var(--tc-green-text)', hoverFg: 'var(--tc-green-text)', underline: true },
  muted: { fg: 'var(--tc-ink-4)', hoverFg: 'var(--tc-ink)', underline: false },
  onDark: { fg: 'var(--tc-shell-muted)', hoverFg: '#fff', underline: false },
};

interface LinkButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  tone?: keyof typeof LINK_TONES;
  strong?: boolean;
  size?: number;
  style?: CSSProperties;
}

/** Text link rendered as a button: the prototype's `<a href="#">` affordances, without the page jump. */
export function LinkButton({ tone = 'link', strong = false, size = 13, children, style, ...rest }: LinkButtonProps) {
  const [hover, setHover] = useState(false);
  const t = LINK_TONES[tone] ?? LINK_TONES.link;
  return (
    <button
      type="button"
      {...rest}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'none', border: 0, padding: 0, color: hover ? t.hoverFg : t.fg, fontFamily: 'inherit', fontSize: size,
        fontWeight: strong ? 600 : 500, cursor: 'pointer', textAlign: 'left', textDecoration: hover || t.underline ? 'underline' : 'none',
        whiteSpace: 'nowrap', ...style,
      }}
    >
      {children}
    </button>
  );
}

interface FilterChipProps {
  selected?: boolean;
  tone?: 'default' | 'amber' | 'static';
  children?: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
}

export function FilterChip({ selected = false, tone = 'default', children, onClick, style }: FilterChipProps) {
  const amber = tone === 'amber', isStatic = tone === 'static';
  const bg = selected ? 'var(--tc-ink)' : amber ? 'var(--tc-amber-bg-soft)' : isStatic ? 'var(--tc-surface-muted)' : '#fff';
  const fg = selected ? '#fff' : amber ? 'var(--tc-amber-text)' : isStatic ? 'var(--tc-ink)' : 'var(--tc-ink-3)';
  const bd = selected ? 'var(--tc-ink)' : amber ? 'var(--tc-amber-line)' : isStatic ? 'transparent' : 'var(--tc-line)';
  return (
    <button
      type="button"
      aria-pressed={isStatic ? undefined : selected}
      onClick={isStatic ? undefined : onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, height: 30, padding: '0 12px', border: `1px solid ${bd}`, borderRadius: 999,
        background: bg, color: fg, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: isStatic ? 'default' : 'pointer',
        whiteSpace: 'nowrap', ...style,
      }}
    >
      {children}
    </button>
  );
}

interface PillToggleProps<V extends string> {
  options: Option<V>[];
  value: V;
  onChange?: (v: V) => void;
  onDark?: boolean;
  size?: 'xs' | 'sm';
  stretch?: boolean;
  style?: CSSProperties;
}

export function PillToggle<V extends string>({ options, value, onChange, onDark = false, size = 'sm', stretch = false, style }: PillToggleProps<V>) {
  const h = size === 'xs' ? 24 : 26;
  return (
    <div style={{ display: stretch ? 'flex' : 'inline-flex', gap: 2, padding: 3, borderRadius: 6, background: onDark ? 'var(--tc-shell-line-1)' : 'var(--tc-surface-chip)', ...style }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange?.(o.value)}
            style={{
              flex: stretch ? 1 : undefined, height: h, padding: `0 ${h === 24 ? 9 : 10}px`, border: 0, borderRadius: 4,
              background: on ? 'var(--tc-green)' : 'transparent', color: on ? 'var(--tc-green-ink)' : onDark ? 'var(--tc-shell-text)' : 'var(--tc-ink)',
              fontFamily: 'inherit', fontSize: h === 24 ? 11.5 : 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const SEGMENT_HEIGHTS = { xs: 26, sm: 28, md: 30, base: 32, lg: 34 };

interface SegmentedControlProps<V extends string> {
  options: Option<V>[];
  value: V;
  onChange?: (v: V) => void;
  size?: keyof typeof SEGMENT_HEIGHTS;
  style?: CSSProperties;
}

export function SegmentedControl<V extends string>({ options, value, onChange, size = 'lg', style }: SegmentedControlProps<V>) {
  const h = SEGMENT_HEIGHTS[size] ?? 34;
  const padX = h >= 34 ? 18 : h >= 30 ? 12 : 10;
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--tc-line)', borderRadius: 6, overflow: 'hidden', flex: 'none', ...style }}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange?.(o.value)}
            style={{
              height: h, padding: `0 ${padX}px`, border: 0, borderLeft: i ? '1px solid var(--tc-line)' : 0, background: on ? 'var(--tc-ink)' : '#fff',
              color: on ? '#fff' : 'var(--tc-ink-3)', fontFamily: 'inherit', fontSize: h >= 32 ? 13 : 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
