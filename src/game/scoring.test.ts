import { describe, expect, it } from 'vitest';
import { ERRORS, INVOICES } from './content';
import { MAX_POINTS, scoreInvoice, scoreRun, type InvoiceAnswer } from './scoring';

const perfect: InvoiceAnswer[] = INVOICES.map(inv => ({
  invoice: inv.no,
  flags: ERRORS.filter(e => e.invoice === inv.no).map(e => ({ field: e.fields[0], rule: e.rule })),
}));

describe('scoreInvoice', () => {
  it('counts "No errors" on a clean invoice as correct', () => {
    expect(scoreInvoice({ invoice: 1, flags: [] })).toMatchObject({ correct: true, points: 0 });
  });

  it('marks a found error, with the right rule, as correct', () => {
    const r = scoreInvoice({ invoice: 3, flags: [{ field: 'supplier.vat', rule: 'supplier-id' }] });
    expect(r).toMatchObject({ correct: true, points: 10 });
    expect(r.errors[0].outcome).toBe('found');
  });

  it('accepts any field of the error’s group', () => {
    expect(scoreInvoice({ invoice: 7, flags: [{ field: 'line.0.rate', rule: 'exemption-mention' }] }).correct).toBe(true);
  });

  it('gives no points for the right field with the wrong rule', () => {
    const r = scoreInvoice({ invoice: 10, flags: [{ field: 'line.0.rate', rule: 'vat-amount' }] });
    expect(r).toMatchObject({ correct: false, points: 0 });
    expect(r.errors[0].outcome).toBe('wrong-rule');
    expect(r.falseFlags).toEqual([]);
  });

  it('costs 5 points per flag on a field without an error', () => {
    const r = scoreInvoice({ invoice: 3, flags: [{ field: 'supplier.vat', rule: 'supplier-id' }, { field: 'number', rule: 'numbering' }] });
    expect(r).toMatchObject({ correct: false, points: 5 });
    expect(r.falseFlags).toHaveLength(1);
  });

  it('marks a missed error', () => {
    const r = scoreInvoice({ invoice: 12, flags: [] });
    expect(r.correct).toBe(false);
    expect(r.errors[0].outcome).toBe('missed');
  });
});

describe('scoreRun', () => {
  it('scores a perfect run 12 of 12, 7 of 7, 70 points', () => {
    expect(scoreRun(perfect)).toMatchObject({ invoicesCorrect: 12, errorsFound: 7, falseFlags: 0, points: MAX_POINTS });
    expect(MAX_POINTS).toBe(70);
  });

  it('counts invoices left unanswered when time runs out as wrong, even clean ones', () => {
    const s = scoreRun(perfect.slice(0, 2));
    expect(s.invoicesCorrect).toBe(2);
    expect(s.results[0].correct).toBe(true);
    expect(s.results.slice(2).every(r => !r.correct)).toBe(true);
    expect(s.errorsFound).toBe(0);
  });
});
