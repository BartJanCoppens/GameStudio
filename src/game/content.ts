// Spot the invoice errors: the content of the one demo game.
//
// Twelve invoices, seven planted errors, each tied to a rule and to the passage of
// "Invoice mandatory mentions.md" that it breaks. Proof of concept: written from the
// document, not reviewed by a VAT specialist. All companies and people are fictional.
import { PASSAGES, RULES, SOURCE_DOCUMENT, type Passage, type Rule } from '../../supabase/functions/_shared/source.ts';
import { beVat } from './vat';

export const GAME = {
  key: 'invoice-errors',
  title: 'Spot the invoice errors',
  type: 'Audit',
  domain: 'Belgian VAT',
  source: SOURCE_DOCUMENT,
  version: 'v3',
  minutes: 15,
} as const;

export const TIME_LIMIT_SECONDS = GAME.minutes * 60;
export const POINTS_PER_ERROR = 10;
export const POINTS_PER_FALSE_FLAG = -5;

// ---- Source document and rules (shared with the studio-chat function) ----

export { PASSAGES, RULES, type Passage, type Rule };

export const passageById = (id: string): Passage => {
  const p = PASSAGES.find(x => x.id === id);
  if (!p) throw new Error(`Unknown passage ${id}`);
  return p;
};

export const ruleById = (id: string): Rule => {
  const r = RULES.find(x => x.id === id);
  if (!r) throw new Error(`Unknown rule ${id}`);
  return r;
};

// ---- Invoices ----

export interface Party {
  name: string;
  address: string[];
  /** null: not on the invoice. */
  vat: string | null;
}

/** A VAT rate in percent, or a line on which no Belgian VAT is charged. */
export type LineRate = number | 'exempt' | 'reverse';

export interface Line {
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  rate: LineRate;
}

export interface Invoice {
  /** 1–12, the order the player meets them in. */
  no: number;
  supplier: Party;
  customer: Party;
  number: string;
  issueDate: string;
  supplyDate?: string;
  lines: Line[];
  /** Printed VAT per rate when it differs from the correct amount (a planted error). */
  vatPrinted?: Record<number, number>;
  mentions: string[];
}

const LUMEN: Party = { name: 'Lumen Office Supplies NV', address: ['Meir 112', '2000 Antwerpen'], vat: beVat('04711235') };
const VERHULST: Party = { name: 'Atelier Verhulst BV', address: ['Kortrijksesteenweg 58', '9000 Gent'], vat: beVat('06893314') };
const BRABO: Party = { name: 'Brabo Logistics BV', address: ['Noorderlaan 401', '2030 Antwerpen'], vat: beVat('07254408') };
const DELCOURT: Party = { name: 'Maison Delcourt SRL', address: ['Rue Féronstrée 21', '4000 Liège'], vat: beVat('05510872') };
const DELCROIX: Party = { name: 'Delcroix Trading BV', address: ['Industrieweg 14', '9032 Wondelgem'], vat: beVat('08127763') };
const MAES: Party = { name: 'Bouwgroep Maes NV', address: ['Brusselsesteenweg 220', '9090 Melle'], vat: beVat('04336650') };

const DEFAULT_INVOICES: Invoice[] = [
  {
    no: 1, supplier: LUMEN, customer: DELCROIX, number: '2026-0141', issueDate: '2026-03-02',
    lines: [{ description: 'Ergonomic office chair, model Rhea', qty: 4, unit: 'pcs', unitPrice: 180, rate: 21 }],
    mentions: ['Payment within 30 days to BE71 0961 2345 6769.'],
  },
  {
    no: 2, supplier: LUMEN, customer: BRABO, number: '2026-0142', issueDate: '2026-03-03', supplyDate: '2026-02-27',
    lines: [{ description: 'Toner cartridge, black, LX-500', qty: 10, unit: 'pcs', unitPrice: 45, rate: 21 }],
    mentions: ['Payment within 30 days to BE71 0961 2345 6769.'],
  },
  {
    no: 3, supplier: { ...VERHULST, vat: 'BE 0689.331.482' }, customer: { name: 'Mr and Mrs Jacobs', address: ['Coupure Links 9', '9000 Gent'], vat: null },
    number: 'V-2026-031', issueDate: '2026-03-04', supplyDate: '2026-02-26',
    lines: [{ description: 'Kitchen renovation: removal, tiling and fitting, dwelling first occupied in 2009', qty: 1, unit: 'job', unitPrice: 8400, rate: 6 }],
    mentions: ['6% rate: renovation of a private dwelling first occupied more than ten years ago. Customer’s statement attached.'],
  },
  {
    no: 4, supplier: VERHULST, customer: MAES, number: 'V-2026-032', issueDate: '2026-03-05', supplyDate: '2026-02-28',
    lines: [{ description: 'Subcontracted carpentry works, site Melle, phase 2', qty: 1, unit: 'job', unitPrice: 12000, rate: 'reverse' }],
    mentions: ['Reverse charge: VAT due by the customer (Royal Decree No. 1, Art. 20). Verlegging van heffing.'],
  },
  {
    no: 5, supplier: BRABO, customer: { name: 'Kranz Handels GmbH', address: ['Hansaring 77', '50670 Köln', 'Germany'], vat: null },
    number: 'BL-26-0077', issueDate: '2026-03-05',
    lines: [{ description: 'Euro pallets with packaging film, delivered to Köln', qty: 40, unit: 'pallets', unitPrice: 50, rate: 'exempt' }],
    mentions: ['Exempt intra-Community supply, Art. 39bis VAT Code.'],
  },
  {
    no: 6, supplier: BRABO, customer: { name: 'Van Dijk Retail BV', address: ['Coolsingel 40', '3011 AD Rotterdam', 'Netherlands'], vat: 'NL852147963B01' },
    number: 'BL-26-0078', issueDate: '2026-03-06',
    lines: [{ description: 'Shelving units, flat-packed, delivered to Rotterdam', qty: 35, unit: 'units', unitPrice: 90, rate: 'exempt' }],
    mentions: ['Exempt intra-Community supply, Art. 39bis VAT Code.'],
  },
  {
    no: 7, supplier: DELCOURT, customer: { name: 'Lyon Tissus SAS', address: ['12 rue de la République', '69002 Lyon', 'France'], vat: 'FR47852314906' },
    number: 'MD/2026/112', issueDate: '2026-03-09',
    lines: [{ description: 'Upholstery fabric, linen blend, 140 cm', qty: 400, unit: 'm', unitPrice: 14, rate: 'exempt' }],
    mentions: ['Payment within 30 days.'],
  },
  {
    no: 8, supplier: VERHULST, customer: MAES, number: 'V-2026-033', issueDate: '2026-03-10', supplyDate: '2026-03-06',
    lines: [{ description: 'Subcontracted carpentry works, site Melle, phase 3', qty: 1, unit: 'job', unitPrice: 6500, rate: 'reverse' }],
    mentions: ['Payment within 30 days.'],
  },
  {
    no: 9, supplier: DELCOURT, customer: DELCROIX, number: 'MD/2026/113', issueDate: '2026-03-10',
    lines: [{ description: 'Showroom styling advice, 2 days on site', qty: 16, unit: 'h', unitPrice: 75, rate: 21 }],
    mentions: ['Payment within 30 days.'],
  },
  {
    no: 10, supplier: VERHULST, customer: { name: 'Mr Peeters', address: ['Dorpstraat 3', '9830 Sint-Martens-Latem'], vat: null },
    number: 'V-2026-034', issueDate: '2026-03-11', supplyDate: '2026-03-09',
    lines: [{ description: 'Construction of a new detached garden shed, 12 m², timber frame', qty: 1, unit: 'job', unitPrice: 4800, rate: 6 }],
    mentions: ['6% rate: renovation of a private dwelling.'],
  },
  {
    no: 11, supplier: LUMEN, customer: DELCROIX, number: '2026-0143', issueDate: '2026-03-12',
    lines: [{ description: 'Sit-stand desk, 160 × 80 cm', qty: 5, unit: 'pcs', unitPrice: 490, rate: 21 }],
    vatPrinted: { 21: 541.5 },
    mentions: ['Payment within 30 days to BE71 0961 2345 6769.'],
  },
  {
    no: 12, supplier: DELCOURT, customer: BRABO, number: 'MD/2026/113', issueDate: '2026-03-13',
    lines: [{ description: 'Translation of warehouse safety manual, FR to NL', qty: 1, unit: 'job', unitPrice: 900, rate: 21 }],
    mentions: ['Payment within 30 days.'],
  },
];

// ---- Answer key ----

export interface PlantedError {
  id: string;
  invoice: number;
  /** Fields where a flag counts; the first is where the error is shown. */
  fields: string[];
  rule: string;
  title: string;
  explanation: string;
}

const DEFAULT_ERRORS: PlantedError[] = [
  { id: 'e1', invoice: 3, fields: ['supplier.vat'], rule: 'supplier-id', title: 'Supplier VAT number is not valid', explanation: 'BE 0689.331.482 fails the check digits: 97 − (06893314 mod 97) is 88, so the number must end in 88, not 82.' },
  { id: 'e2', invoice: 5, fields: ['customer.vat'], rule: 'customer-vat', title: 'Customer VAT number missing on an exempt intra-Community supply', explanation: 'Kranz Handels GmbH receives an exempt intra-Community supply, so its German VAT number must be on the invoice.' },
  { id: 'e3', invoice: 7, fields: ['mentions', 'line.0.rate'], rule: 'exemption-mention', title: 'Exemption without its legal basis', explanation: 'No VAT is charged on a supply to France, but the invoice never says why: the Art. 39bis mention is missing.' },
  { id: 'e4', invoice: 8, fields: ['mentions', 'line.0.rate'], rule: 'reverse-charge-mention', title: 'Reverse charge without the mention', explanation: 'Works for a registered contractor go under the reverse charge, but the invoice lacks “Reverse charge / Verlegging van heffing”.' },
  { id: 'e5', invoice: 10, fields: ['line.0.rate'], rule: 'rate', title: '6% on a new detached shed', explanation: 'A new outbuilding detached from the dwelling is new construction, not renovation: 21% applies.' },
  { id: 'e6', invoice: 11, fields: ['totals.vat'], rule: 'vat-amount', title: 'VAT amount is wrong', explanation: '21% of € 2,450.00 is € 514.50; the invoice shows € 541.50.' },
  { id: 'e7', invoice: 12, fields: ['number'], rule: 'numbering', title: 'Invoice number used twice', explanation: 'MD/2026/113 was already used by Maison Delcourt for invoice 9 to Delcroix Trading BV.' },
];

/** What the Studio edits and players play: the invoices and the errors planted in them. Rules and passages are fixed. */
export interface GameContent {
  invoices: Invoice[];
  errors: PlantedError[];
}

/** The built-in version, used until a creator saves a draft or a version is published. */
export const DEFAULT_CONTENT: GameContent = { invoices: DEFAULT_INVOICES, errors: DEFAULT_ERRORS };

export const errorsOn = (content: GameContent, invoiceNo: number) => content.errors.filter(e => e.invoice === invoiceNo);
export const maxPoints = (content: GameContent) => content.errors.length * POINTS_PER_ERROR;
export const passageOfError = (e: PlantedError) => passageById(ruleById(e.rule).passage);

// ---- Amounts ----

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const lineTotal = (l: Line) => round2(l.qty * l.unitPrice);

export interface RateTotal {
  rate: LineRate;
  taxable: number;
  /** As printed on the invoice. */
  vat: number;
}

export function totalsOf(inv: Invoice): { perRate: RateTotal[]; taxable: number; vat: number; total: number } {
  const byRate = new Map<LineRate, number>();
  for (const l of inv.lines) byRate.set(l.rate, round2((byRate.get(l.rate) ?? 0) + lineTotal(l)));
  const perRate = [...byRate].map(([rate, taxable]) => ({
    rate,
    taxable,
    vat: typeof rate === 'number' ? (inv.vatPrinted?.[rate] ?? round2((taxable * rate) / 100)) : 0,
  }));
  const taxable = round2(perRate.reduce((a, r) => a + r.taxable, 0));
  const vat = round2(perRate.reduce((a, r) => a + r.vat, 0));
  return { perRate, taxable, vat, total: round2(taxable + vat) };
}

export const euro = (n: number) => `€ ${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
export const rateLabel = (r: LineRate) => (r === 'exempt' ? 'Exempt' : r === 'reverse' ? 'Reverse charge' : `${r}%`);
