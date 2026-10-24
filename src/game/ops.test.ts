import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT } from './content';
import { applyOperations, contentProblems, type ModelInvoice, type Operation } from './ops';

const NONE = { invoice: null, invoice_no: null, error: null, error_id: null };

const newInvoice = (no: number, overrides: Partial<ModelInvoice> = {}): ModelInvoice => ({
  no,
  supplier: { name: 'Test Supplier BV', address: ['Straat 1', '1000 Brussel'], vat: 'BE 0471.123.555' },
  customer: { name: 'Test Customer NV', address: ['Laan 2', '2000 Antwerpen'], vat: null },
  number: 'T-2026-001', issue_date: '2026-03-20', supply_date: null,
  lines: [{ description: 'Consulting', qty: 2, unit: 'h', unit_price: 100, rate_kind: 'percent', rate_percent: 21 }],
  vat_printed: null, mentions: ['Payment within 30 days.'],
  ...overrides,
});

describe('the built-in game', () => {
  it('has no problems', () => expect(contentProblems(DEFAULT_CONTENT)).toEqual([]));
});

describe('applyOperations', () => {
  it('adds an invoice and plants an error on it', () => {
    const ops: Operation[] = [
      { ...NONE, op: 'upsert_invoice', invoice: newInvoice(13, { vat_printed: 50 }) },
      { ...NONE, op: 'upsert_error', error: { id: 'e8', invoice: 13, fields: ['totals.vat'], rule: 'vat-amount', title: 'VAT amount is wrong', explanation: '21% of € 200.00 is € 42.00.' } },
    ];
    const r = applyOperations(DEFAULT_CONTENT, ops);
    expect(r.skipped).toEqual([]);
    expect(r.content.invoices).toHaveLength(13);
    expect(r.content.errors).toHaveLength(8);
    expect(r.content.invoices[12].vatPrinted).toEqual({ 21: 50 });
    expect(r.touched).toEqual([13]);
    expect(contentProblems(r.content)).toEqual([]);
  });

  it('skips an error against an unknown rule or a field that does not exist', () => {
    const r = applyOperations(DEFAULT_CONTENT, [
      { ...NONE, op: 'upsert_error', error: { id: 'x1', invoice: 1, fields: ['number'], rule: 'make-coffee', title: 't', explanation: 'e' } },
      { ...NONE, op: 'upsert_error', error: { id: 'x2', invoice: 1, fields: ['line.5'], rule: 'rate', title: 't', explanation: 'e' } },
    ]);
    expect(r.changes).toEqual([]);
    expect(r.skipped.join(' ')).toMatch(/unknown rule/);
    expect(r.skipped.join(' ')).toMatch(/doesn’t exist/);
    expect(r.content).toEqual(DEFAULT_CONTENT);
  });

  it('refuses rates that are not Belgian VAT rates', () => {
    const r = applyOperations(DEFAULT_CONTENT, [{ ...NONE, op: 'upsert_invoice', invoice: newInvoice(13, { lines: [{ description: 'x', qty: 1, unit: 'pc', unit_price: 1, rate_kind: 'percent', rate_percent: 19 }] }) }]);
    expect(r.skipped.join(' ')).toMatch(/19% is not a Belgian VAT rate/);
  });

  it('removes an invoice with its errors and renumbers the rest', () => {
    const r = applyOperations(DEFAULT_CONTENT, [{ ...NONE, op: 'remove_invoice', invoice_no: 3 }]);
    expect(r.content.invoices.map(i => i.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(r.content.errors).toHaveLength(6);
    // The old invoice 5 error now sits on invoice 4.
    expect(r.content.errors.find(e => e.id === 'e2')?.invoice).toBe(4);
    expect(contentProblems(r.content)).toEqual([]);
  });

  it('drops errors that no longer fit a changed invoice', () => {
    // Invoice 10's error points at line.0.rate; replace the invoice with no lines' rate change but keep one line.
    const r = applyOperations(DEFAULT_CONTENT, [{ ...NONE, op: 'upsert_invoice', invoice: newInvoice(10) }]);
    expect(r.content.errors.find(e => e.id === 'e5')).toBeDefined(); // line.0.rate still exists
    const two = applyOperations(DEFAULT_CONTENT, [{ ...NONE, op: 'upsert_invoice', invoice: newInvoice(10, { lines: [] }) }]);
    expect(two.skipped.join(' ')).toMatch(/needs 1–10 lines/);
  });
});
