import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT, PASSAGES, RULES, passageOfError, ruleById, totalsOf } from './content';
import { fieldsOf } from './fields';
import { beVat, isValidBeVat } from './vat';

const { invoices: INVOICES, errors: ERRORS } = DEFAULT_CONTENT;

describe('Belgian VAT numbers', () => {
  it('builds numbers whose check digits validate', () => {
    expect(beVat('06893314')).toBe('BE 0689.331.488');
    expect(isValidBeVat('BE 0689.331.488')).toBe(true);
  });
  it('rejects wrong check digits, wrong length and other countries', () => {
    expect(isValidBeVat('BE 0689.331.482')).toBe(false);
    expect(isValidBeVat('BE 0689.331.48')).toBe(false);
    expect(isValidBeVat('NL852147963B01')).toBe(false);
  });
});

describe('game content', () => {
  it('has 12 invoices numbered 1–12 and 7 planted errors', () => {
    expect(INVOICES.map(i => i.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(ERRORS).toHaveLength(7);
    expect(new Set(ERRORS.map(e => e.id)).size).toBe(7);
  });

  it('points every error at a field that exists on its invoice, a known rule and a passage', () => {
    for (const e of ERRORS) {
      const inv = INVOICES.find(i => i.no === e.invoice)!;
      for (const f of e.fields) expect(fieldsOf(inv), `${e.id} field ${f}`).toContain(f);
      expect(() => ruleById(e.rule)).not.toThrow();
      expect(PASSAGES).toContain(passageOfError(e));
    }
  });

  it('gives every rule a passage, and keeps some rules as distractors', () => {
    for (const r of RULES) expect(PASSAGES.map(p => p.id)).toContain(r.passage);
    const used = new Set(ERRORS.map(e => e.rule));
    expect(RULES.filter(r => !used.has(r.id)).length).toBeGreaterThanOrEqual(3);
  });

  it('leaves Belgian supplier VAT numbers valid except where an error is planted', () => {
    for (const inv of INVOICES) {
      const planted = ERRORS.some(e => e.invoice === inv.no && e.fields.includes('supplier.vat'));
      expect(isValidBeVat(inv.supplier.vat ?? ''), `invoice ${inv.no}`).toBe(!planted);
    }
  });

  it('prints correct VAT everywhere except invoice 11', () => {
    for (const inv of INVOICES) {
      for (const r of totalsOf(inv).perRate) {
        if (typeof r.rate !== 'number') continue;
        const right = Math.round(r.taxable * r.rate) / 100;
        expect(r.vat === right, `invoice ${inv.no}`).toBe(inv.no !== 11);
      }
    }
    expect(totalsOf(INVOICES[10]).vat).toBe(541.5);
  });

  it('reuses invoice number MD/2026/113 only on the invoice that carries that error', () => {
    const dupes = INVOICES.filter(i => i.number === 'MD/2026/113').map(i => i.no);
    expect(dupes).toEqual([9, 12]);
  });
});
