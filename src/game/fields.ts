import type { Invoice } from './content';

// Every part of an invoice the player can click to flag, with a name for the feedback.

export function fieldsOf(inv: Invoice): string[] {
  return [
    'supplier.name', 'supplier.address', 'supplier.vat',
    'customer.name', 'customer.address', 'customer.vat',
    'number', 'issueDate', 'supplyDate',
    ...inv.lines.flatMap((_, i) => [`line.${i}`, `line.${i}.rate`]),
    'totals.taxable', 'totals.vat', 'totals.total',
    'mentions',
  ];
}

const NAMES: Record<string, string> = {
  'supplier.name': 'Supplier name', 'supplier.address': 'Supplier address', 'supplier.vat': 'Supplier VAT number',
  'customer.name': 'Customer name', 'customer.address': 'Customer address', 'customer.vat': 'Customer VAT number',
  number: 'Invoice number', issueDate: 'Date of issue', supplyDate: 'Date of supply',
  'totals.taxable': 'Taxable amount', 'totals.vat': 'VAT amount', 'totals.total': 'Total',
  mentions: 'Legal mentions',
};

export function fieldName(field: string): string {
  const line = /^line\.(\d+)(\.rate)?$/.exec(field);
  if (line) return line[2] ? `VAT rate, line ${Number(line[1]) + 1}` : `Description, line ${Number(line[1]) + 1}`;
  return NAMES[field] ?? field;
}
