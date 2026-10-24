import { useState, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

/** group: the children are several controls (e.g. a SegmentedControl), so it is a labelled group, not a <label>. */
export function Field({ label, hint, size = 'md', group = false, children, style }: { label: ReactNode; hint?: ReactNode; size?: 'sm' | 'md'; group?: boolean; children: ReactNode; style?: CSSProperties }) {
  const sm = size === 'sm';
  const Tag = group ? 'div' : 'label';
  return (
    <Tag role={group ? 'group' : undefined} aria-label={group && typeof label === 'string' ? label : undefined} style={{ display: 'flex', flexDirection: 'column', gap: sm ? 4 : 6, fontSize: sm ? 12.5 : 13, fontWeight: 500, minWidth: 0, ...style }}>
      {label}
      {children}
      {hint ? <span style={{ fontSize: 12, color: 'var(--tc-ink-5)', fontWeight: 400 }}>{hint}</span> : null}
    </Tag>
  );
}

const INPUT_HEIGHTS = { md: 30, lg: 34, '3xl': 42 };

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'style'> {
  size?: keyof typeof INPUT_HEIGHTS;
  invalid?: boolean;
  style?: CSSProperties;
}

export function Input({ size = 'lg', invalid = false, style, onFocus, onBlur, ...rest }: InputProps) {
  const [focus, setFocus] = useState(false);
  const h = INPUT_HEIGHTS[size] ?? 34;
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      onFocus={e => { setFocus(true); onFocus?.(e); }}
      onBlur={e => { setFocus(false); onBlur?.(e); }}
      style={{
        height: h, padding: `0 ${h >= 42 ? 12 : h >= 34 ? 10 : 8}px`, border: `1px solid ${invalid ? 'var(--tc-red)' : 'var(--tc-line)'}`, borderRadius: 6,
        background: '#fff', fontFamily: 'inherit', fontSize: h >= 42 ? 14 : h >= 34 ? 13 : 12, fontWeight: 400, color: 'var(--tc-ink)', width: '100%',
        minWidth: 0, boxSizing: 'border-box', outline: focus ? '2px solid var(--tc-green)' : 'none', outlineOffset: -1, ...style,
      }}
    />
  );
}

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'style'> {
  style?: CSSProperties;
}

export function Textarea({ style, onFocus, onBlur, rows = 3, ...rest }: TextareaProps) {
  const [focus, setFocus] = useState(false);
  return (
    <textarea
      {...rest}
      rows={rows}
      onFocus={e => { setFocus(true); onFocus?.(e); }}
      onBlur={e => { setFocus(false); onBlur?.(e); }}
      style={{
        padding: '8px 10px', border: '1px solid var(--tc-line)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.45,
        color: 'var(--tc-ink)', width: '100%', minWidth: 0, boxSizing: 'border-box', resize: 'vertical', outline: focus ? '2px solid var(--tc-green)' : 'none', outlineOffset: -1, ...style,
      }}
    />
  );
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'style'> {
  options: { value: string; label: string }[];
  size?: 'md' | 'lg';
  style?: CSSProperties;
}

export function Select({ options, size = 'lg', style, ...rest }: SelectProps) {
  const h = size === 'md' ? 30 : 34;
  return (
    <select
      {...rest}
      style={{
        height: h, padding: `0 ${h === 30 ? 6 : 8}px`, border: '1px solid var(--tc-line)', borderRadius: 6, background: '#fff', fontFamily: 'inherit',
        fontSize: h === 30 ? 12 : 13, fontWeight: 400, color: 'var(--tc-ink)', minWidth: 0, ...style,
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Checkbox({ checked = false, onChange, disabled, children, style }: { checked?: boolean; onChange?: (checked: boolean) => void; disabled?: boolean; children?: ReactNode; style?: CSSProperties }) {
  return (
    <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 13.5, cursor: disabled ? 'default' : 'pointer', textWrap: 'pretty', opacity: disabled ? 0.5 : 1, ...style }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange?.(e.target.checked)} style={{ width: 16, height: 16, margin: '2px 0 0', flex: 'none', accentColor: 'var(--tc-green)' }} />
      <span>{children}</span>
    </label>
  );
}
