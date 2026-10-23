import { useState, type CSSProperties, type ReactNode } from 'react';
import { euro, lineTotal, longDate, rateLabel, totalsOf, type Invoice } from './content';
import { fieldName } from './fields';

/** How a field is drawn: while playing (flagged, being chosen), after submitting, or in the answer key. */
export type FieldMark = 'flagged' | 'choosing' | 'found' | 'wrong-rule' | 'missed' | 'false' | 'answer';

const MARK_STYLE: Record<FieldMark, CSSProperties> = {
  flagged: { background: 'var(--tc-amber-bg-soft)', boxShadow: 'inset 0 0 0 1.5px var(--tc-amber)' },
  choosing: { background: 'var(--tc-amber-bg-soft)', boxShadow: 'inset 0 0 0 2px var(--tc-ink)' },
  found: { background: 'var(--tc-green-200)', boxShadow: 'inset 0 0 0 1.5px var(--tc-green)' },
  'wrong-rule': { background: 'var(--tc-orange-bg)', boxShadow: 'inset 0 0 0 1.5px var(--tc-orange)' },
  missed: { background: 'var(--tc-red-bg-soft)', boxShadow: 'inset 0 0 0 1.5px var(--tc-red)' },
  false: { background: 'var(--tc-line-faint)', boxShadow: 'inset 0 0 0 1.5px var(--tc-dot-neutral)' },
  answer: { background: 'var(--tc-amber-bg-soft)', boxShadow: 'inset 0 0 0 1.5px var(--tc-amber)' },
};

const MARK_WORD: Record<FieldMark, string> = {
  flagged: 'flagged', choosing: 'choosing a rule', found: 'error found', 'wrong-rule': 'right place, wrong rule', missed: 'missed error', false: 'not an error', answer: 'planted error',
};

/** A clickable part of the invoice. */
function Field({ id, mark, onField, children, block, align }: { id: string; mark?: FieldMark; onField?: (field: string) => void; children: ReactNode; block?: boolean; align?: 'right' }) {
  const [hover, setHover] = useState(false);
  const base: CSSProperties = {
    display: block ? 'block' : 'inline-block', width: block ? '100%' : undefined, textAlign: align ?? 'left', font: 'inherit', color: 'inherit',
    background: 'transparent', border: 0, borderRadius: 3, padding: '1px 4px', margin: '-1px -4px', cursor: onField ? 'pointer' : 'default',
    boxShadow: hover && onField && !mark ? 'inset 0 0 0 1px var(--tc-green)' : undefined, ...(mark ? MARK_STYLE[mark] : null),
  };
  if (!onField) return <span style={base} title={mark ? `${fieldName(id)} · ${MARK_WORD[mark]}` : undefined}>{children}</span>;
  return (
    <button
      type="button"
      onClick={() => onField(id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={`${fieldName(id)}${mark ? ` · ${MARK_WORD[mark]}` : ''}`}
      style={base}
    >
      {children}
    </button>
  );
}

interface Props {
  invoice: Invoice;
  marks?: Record<string, FieldMark>;
  /** Without it the invoice is read-only. */
  onField?: (field: string) => void;
  style?: CSSProperties;
}

export function InvoicePaper({ invoice: inv, marks = {}, onField, style }: Props) {
  const t = totalsOf(inv);
  const single = t.perRate.length === 1 ? t.perRate[0].rate : null;

  const f = (id: string) => ({ id, mark: marks[id], onField });

  const label: CSSProperties = { fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--tc-ink-5)', marginBottom: 4 };
  const cell: CSSProperties = { padding: '8px 6px', borderBottom: '1px solid var(--tc-line-hair)', verticalAlign: 'top' };
  const num: CSSProperties = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

  return (
    <article
      aria-label={`Invoice ${inv.number} from ${inv.supplier.name}`}
      style={{ background: '#fff', border: '1px solid var(--tc-line-soft)', borderRadius: 4, padding: '32px 36px', boxShadow: '0 1px 2px rgba(0,0,0,.04)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--tc-ink)', ...style }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 220 }}>
          <Field {...f('supplier.name')}><span style={{ fontSize: 15, fontWeight: 600 }}>{inv.supplier.name}</span></Field>
          <Field {...f('supplier.address')}>{inv.supplier.address.map(l => <span key={l} style={{ display: 'block' }}>{l}</span>)}</Field>
          <Field {...f('supplier.vat')}>VAT {inv.supplier.vat ?? '—'}</Field>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '.04em', color: 'var(--tc-ink-3)' }}>INVOICE</div>
          <table style={{ marginLeft: 'auto', borderCollapse: 'collapse', marginTop: 6 }}>
            <tbody>
              <tr><td style={{ color: 'var(--tc-ink-5)', paddingRight: 12 }}>Number</td><td><Field {...f('number')} align="right"><strong>{inv.number}</strong></Field></td></tr>
              <tr><td style={{ color: 'var(--tc-ink-5)', paddingRight: 12 }}>Date of issue</td><td><Field {...f('issueDate')} align="right">{longDate(inv.issueDate)}</Field></td></tr>
              <tr><td style={{ color: 'var(--tc-ink-5)', paddingRight: 12 }}>Date of supply</td><td><Field {...f('supplyDate')} align="right">{inv.supplyDate ? longDate(inv.supplyDate) : 'Same as issue'}</Field></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 26, padding: '12px 14px', background: 'var(--tc-surface-raised)', borderRadius: 4, maxWidth: 340 }}>
        <div style={label}>Bill to</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Field {...f('customer.name')}><strong>{inv.customer.name}</strong></Field>
          <Field {...f('customer.address')}>{inv.customer.address.map(l => <span key={l} style={{ display: 'block' }}>{l}</span>)}</Field>
          <Field {...f('customer.vat')}>VAT {inv.customer.vat ?? <span style={{ color: 'var(--tc-ink-5)' }}>—</span>}</Field>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 24 }}>
        <thead>
          <tr style={{ ...label, fontSize: 10.5 }}>
            {['Description', 'Qty', 'Unit price', 'VAT', 'Amount'].map((h, i) => (
              <th key={h} style={{ ...cell, ...label, textAlign: i ? 'right' : 'left', borderBottom: '1px solid var(--tc-line)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l, i) => (
            <tr key={i}>
              <td style={cell}><Field {...f(`line.${i}`)} block>{l.description}</Field></td>
              <td style={num}>{l.qty} {l.unit}</td>
              <td style={num}>{euro(l.unitPrice)}</td>
              <td style={num}><Field {...f(`line.${i}.rate`)} align="right">{rateLabel(l.rate)}</Field></td>
              <td style={num}>{euro(lineTotal(l))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ marginLeft: 'auto', marginTop: 14, borderCollapse: 'collapse', minWidth: 280 }}>
        <tbody>
          <tr><td style={{ padding: '3px 12px 3px 0', color: 'var(--tc-ink-3)' }}>Taxable amount</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><Field {...f('totals.taxable')} align="right">{euro(t.taxable)}</Field></td></tr>
          <tr><td style={{ padding: '3px 12px 3px 0', color: 'var(--tc-ink-3)' }}>VAT{typeof single === 'number' ? ` ${single}%` : ''}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><Field {...f('totals.vat')} align="right">{euro(t.vat)}</Field></td></tr>
          <tr><td style={{ padding: '8px 12px 3px 0', fontWeight: 600, borderTop: '1px solid var(--tc-line)' }}>Total due</td><td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', paddingTop: 8, borderTop: '1px solid var(--tc-line)' }}><Field {...f('totals.total')} align="right">{euro(t.total)}</Field></td></tr>
        </tbody>
      </table>

      <div style={{ marginTop: 24, paddingTop: 12, borderTop: '1px solid var(--tc-line-hair)' }}>
        <Field {...f('mentions')} block>
          {inv.mentions.map(m => <span key={m} style={{ display: 'block', fontSize: 11.5, color: 'var(--tc-ink-3)' }}>{m}</span>)}
        </Field>
      </div>
    </article>
  );
}
