// The Content Domain's source document, shared by the app and the Edge Functions: a game that links to
// source material quotes these passages, and the AI only ever sees the real text.
// Plain TypeScript, no imports: Deno and Vite both load it.

// ---- Source document ----

export const SOURCE_DOCUMENT = 'Invoice mandatory mentions.md';

export interface Passage {
  id: string;
  /** Where it sits in the document. */
  loc: string;
  heading: string;
  text: string;
}

export const PASSAGES: Passage[] = [
  { id: 'p-number', loc: '§ 1 · Royal Decree No. 1, Art. 5', heading: 'Invoice number', text: 'Every invoice carries a sequential number that identifies it uniquely within one or more series. The same number may never be used for two invoices.' },
  { id: 'p-dates', loc: '§ 2 · Royal Decree No. 1, Art. 5', heading: 'Dates', text: 'The invoice states its date of issue and, where it differs, the date on which the supply of goods or services took place or was completed.' },
  { id: 'p-supplier', loc: '§ 3 · Royal Decree No. 1, Art. 5', heading: 'Supplier', text: 'The invoice states the supplier’s name, address and VAT identification number. A Belgian VAT number is BE followed by the ten-digit enterprise number; its last two digits are a check equal to 97 minus the first eight digits modulo 97.' },
  { id: 'p-customer', loc: '§ 4 · Royal Decree No. 1, Art. 5', heading: 'Customer', text: 'The invoice states the customer’s name and address. Where the customer receives an exempt intra-Community supply, or pays the VAT under the reverse charge, the customer’s VAT identification number must be stated as well.' },
  { id: 'p-goods', loc: '§ 5 · Royal Decree No. 1, Art. 5', heading: 'Goods and services', text: 'The invoice describes the quantity and nature of the goods supplied or the extent and nature of the services rendered.' },
  { id: 'p-amounts', loc: '§ 6 · Royal Decree No. 1, Art. 5', heading: 'Amounts per rate', text: 'For each rate the invoice shows the taxable amount, the rate applied and the VAT due. The VAT equals the taxable amount multiplied by the rate, rounded to the cent.' },
  { id: 'p-rates', loc: '§ 7 · Royal Decree No. 20, Table A, XXXVIII', heading: 'Reduced rate for renovation', text: 'The standard rate is 21%. The 6% rate applies to renovation work on a private dwelling first occupied at least ten years earlier. It does not apply to new constructions, including new outbuildings detached from the dwelling.' },
  { id: 'p-exempt', loc: '§ 8 · VAT Code, Art. 39bis', heading: 'Exempt supplies', text: 'An invoice for an exempt supply states the legal basis of the exemption, for example “Exempt intra-Community supply, Art. 39bis VAT Code”.' },
  { id: 'p-reverse', loc: '§ 9 · Royal Decree No. 1, Art. 20', heading: 'Reverse charge', text: 'Where the customer pays the VAT, for example on work on immovable property for a registered contractor, the invoice shows no VAT and carries the mention “Reverse charge” (“Verlegging van heffing” / “Autoliquidation”).' },
];
