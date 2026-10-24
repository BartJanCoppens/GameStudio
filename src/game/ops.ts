// The only changes the Studio AI can make: add/replace/remove an invoice, add/replace/remove a planted error.
// The studio-chat function returns them in this shape (snake_case, as the model writes them); they are
// checked here before they touch the draft, and anything that doesn't fit the game is skipped with a reason.
import { RULES, type GameContent, type Invoice, type Line, type PlantedError } from './content';
import { fieldsOf } from './fields';
import { designUsable, tokenProblems } from '../../supabase/functions/_shared/design.ts';

export interface ModelParty {
  name: string;
  address: string[];
  vat: string | null;
}

export interface ModelLine {
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  rate_kind: 'percent' | 'exempt' | 'reverse';
  rate_percent: number | null;
}

export interface ModelInvoice {
  no: number;
  supplier: ModelParty;
  customer: ModelParty;
  number: string;
  issue_date: string;
  supply_date: string | null;
  lines: ModelLine[];
  vat_printed: number | null;
  mentions: string[];
}

export interface ModelError {
  id: string;
  invoice: number;
  fields: string[];
  rule: string;
  title: string;
  explanation: string;
}

export interface Operation {
  op: 'upsert_invoice' | 'remove_invoice' | 'upsert_error' | 'remove_error';
  invoice: ModelInvoice | null;
  invoice_no: number | null;
  error: ModelError | null;
  error_id: string | null;
}

/** Belgian VAT rates; anything else on an invoice is a mistake the AI didn't mean to plant via a rule. */
export const BE_RATES = [0, 6, 12, 21];
export const LIMITS = { invoices: 30, linesPerInvoice: 10, errors: 40, text: 400 };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const tooLong = (s: string) => s.length > LIMITS.text;

function toInvoice(m: ModelInvoice): Invoice {
  const lines: Line[] = m.lines.map(l => ({
    description: l.description, qty: l.qty, unit: l.unit, unitPrice: l.unit_price,
    rate: l.rate_kind === 'percent' ? (l.rate_percent ?? 0) : l.rate_kind,
  }));
  const percentRates = [...new Set(lines.map(l => l.rate).filter((r): r is number => typeof r === 'number'))];
  return {
    no: m.no,
    supplier: { name: m.supplier.name, address: m.supplier.address, vat: m.supplier.vat },
    customer: { name: m.customer.name, address: m.customer.address, vat: m.customer.vat },
    number: m.number,
    issueDate: m.issue_date,
    ...(m.supply_date ? { supplyDate: m.supply_date } : {}),
    lines,
    ...(m.vat_printed != null && percentRates.length === 1 ? { vatPrinted: { [percentRates[0]]: m.vat_printed } } : {}),
    mentions: m.mentions,
  };
}

/** Problems with one invoice, in words a creator can act on. */
export function invoiceProblems(inv: Invoice): string[] {
  const p: string[] = [];
  const label = `Invoice ${inv.no}`;
  if (!Number.isInteger(inv.no) || inv.no < 1) p.push(`${label}: number must be a positive whole number`);
  if (!inv.lines.length || inv.lines.length > LIMITS.linesPerInvoice) p.push(`${label}: needs 1–${LIMITS.linesPerInvoice} lines`);
  if (!DATE.test(inv.issueDate) || (inv.supplyDate && !DATE.test(inv.supplyDate))) p.push(`${label}: dates must be YYYY-MM-DD`);
  for (const l of inv.lines) {
    if (!(l.qty > 0) || !(l.unitPrice >= 0)) p.push(`${label}: quantities must be positive and prices not negative`);
    if (typeof l.rate === 'number' && !BE_RATES.includes(l.rate)) p.push(`${label}: ${l.rate}% is not a Belgian VAT rate`);
  }
  const texts = [inv.supplier.name, inv.customer.name, inv.number, ...inv.supplier.address, ...inv.customer.address, ...inv.mentions, ...inv.lines.map(l => l.description)];
  if (texts.some(tooLong)) p.push(`${label}: a text is longer than ${LIMITS.text} characters`);
  if (!inv.supplier.name.trim() || !inv.customer.name.trim() || !inv.number.trim()) p.push(`${label}: supplier, customer and invoice number are required`);
  return p;
}

export function errorProblems(e: PlantedError, invoices: Invoice[]): string[] {
  const inv = invoices.find(i => i.no === e.invoice);
  if (!inv) return [`Error ${e.id}: invoice ${e.invoice} doesn’t exist`];
  const p: string[] = [];
  if (!RULES.some(r => r.id === e.rule)) p.push(`Error ${e.id}: unknown rule “${e.rule}”`);
  const fields = fieldsOf(inv);
  if (!e.fields.length || e.fields.some(f => !fields.includes(f))) p.push(`Error ${e.id}: points at a part of invoice ${e.invoice} that doesn’t exist`);
  if (!e.title.trim() || !e.explanation.trim() || tooLong(e.title) || tooLong(e.explanation)) p.push(`Error ${e.id}: needs a title and an explanation under ${LIMITS.text} characters`);
  return p;
}

/** Everything wrong with a whole game; empty means it can be saved and played. */
export function contentProblems(c: GameContent): string[] {
  const p: string[] = [];
  if (!c.invoices.length) p.push('The game needs at least one invoice');
  if (c.invoices.length > LIMITS.invoices) p.push(`At most ${LIMITS.invoices} invoices`);
  if (c.errors.length > LIMITS.errors) p.push(`At most ${LIMITS.errors} errors`);
  if (new Set(c.invoices.map(i => i.no)).size !== c.invoices.length) p.push('Two invoices share a number');
  if (new Set(c.errors.map(e => e.id)).size !== c.errors.length) p.push('Two errors share an id');
  for (const inv of c.invoices) p.push(...invoiceProblems(inv));
  for (const e of c.errors) p.push(...errorProblems(e, c.invoices));
  if (c.design) {
    p.push(...tokenProblems(c.design.tokens).map(x => `Design: ${x}`));
    if (!tokenProblems(c.design.tokens).length && !designUsable(c.design.tokens)) p.push('Design: fails the contrast checks');
  }
  return p;
}

/** Invoices numbered 1…n in order, errors following their invoice. Everything else (the design) is kept. */
export function normalize(c: GameContent): GameContent {
  const sorted = [...c.invoices].sort((a, b) => a.no - b.no);
  const renumber = new Map(sorted.map((inv, i) => [inv.no, i + 1]));
  return {
    ...c,
    invoices: sorted.map(inv => ({ ...inv, no: renumber.get(inv.no)! })),
    errors: c.errors.filter(e => renumber.has(e.invoice)).map(e => ({ ...e, invoice: renumber.get(e.invoice)! })),
  };
}

export interface Applied {
  content: GameContent;
  /** One line per change made. */
  changes: string[];
  /** One line per proposed change that was skipped. */
  skipped: string[];
  /** Invoice numbers (after renumbering) that are new or changed. */
  touched: number[];
}

export function applyOperations(start: GameContent, ops: Operation[]): Applied {
  let invoices = [...start.invoices];
  let errors = [...start.errors];
  const changes: string[] = [];
  const skipped: string[] = [];
  const touched = new Set<number>();

  for (const op of ops) {
    if (op.op === 'upsert_invoice' && op.invoice) {
      const inv = toInvoice(op.invoice);
      const problems = invoiceProblems(inv);
      if (problems.length) { skipped.push(...problems); continue; }
      const exists = invoices.some(i => i.no === inv.no);
      if (!exists && invoices.length >= LIMITS.invoices) { skipped.push(`Invoice ${inv.no}: the game already has ${LIMITS.invoices} invoices`); continue; }
      invoices = exists ? invoices.map(i => (i.no === inv.no ? inv : i)) : [...invoices, inv];
      // A changed invoice may no longer have the fields its errors point at.
      const orphaned = errors.filter(e => e.invoice === inv.no && errorProblems(e, invoices).length);
      if (orphaned.length) { errors = errors.filter(e => !orphaned.includes(e)); changes.push(`Removed ${orphaned.length} error(s) that no longer fit invoice ${inv.no}`); }
      touched.add(inv.no);
      changes.push(`${exists ? 'Changed' : 'Added'} invoice ${inv.no} (${inv.supplier.name}, ${inv.number})`);
    } else if (op.op === 'remove_invoice' && op.invoice_no != null) {
      if (!invoices.some(i => i.no === op.invoice_no)) { skipped.push(`Invoice ${op.invoice_no} doesn’t exist`); continue; }
      if (invoices.length === 1) { skipped.push('The game needs at least one invoice'); continue; }
      invoices = invoices.filter(i => i.no !== op.invoice_no);
      const dropped = errors.filter(e => e.invoice === op.invoice_no).length;
      errors = errors.filter(e => e.invoice !== op.invoice_no);
      changes.push(`Removed invoice ${op.invoice_no}${dropped ? ` and its ${dropped} error(s)` : ''}`);
    } else if (op.op === 'upsert_error' && op.error) {
      const e: PlantedError = { ...op.error };
      const problems = errorProblems(e, invoices);
      if (problems.length) { skipped.push(...problems); continue; }
      const exists = errors.some(x => x.id === e.id);
      if (!exists && errors.length >= LIMITS.errors) { skipped.push(`Error ${e.id}: the game already has ${LIMITS.errors} errors`); continue; }
      errors = exists ? errors.map(x => (x.id === e.id ? e : x)) : [...errors, e];
      touched.add(e.invoice);
      changes.push(`${exists ? 'Changed' : 'Planted'} error “${e.title}” on invoice ${e.invoice}`);
    } else if (op.op === 'remove_error' && op.error_id) {
      const e = errors.find(x => x.id === op.error_id);
      if (!e) { skipped.push(`Error ${op.error_id} doesn’t exist`); continue; }
      errors = errors.filter(x => x.id !== op.error_id);
      touched.add(e.invoice);
      changes.push(`Removed error “${e.title}” from invoice ${e.invoice}`);
    } else {
      skipped.push(`A change of type “${op.op}” was missing its details`);
    }
  }

  // Renumber, and carry the touched invoice numbers across.
  const sorted = [...invoices].sort((a, b) => a.no - b.no);
  const renumber = new Map(sorted.map((inv, i) => [inv.no, i + 1]));
  return {
    // The design rides along untouched: the Studio chat can't change it.
    content: normalize({ ...start, invoices, errors }),
    changes,
    skipped,
    touched: [...touched].map(n => renumber.get(n)).filter((n): n is number => n != null),
  };
}
