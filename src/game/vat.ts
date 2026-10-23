// Belgian VAT numbers: "BE" + the 10-digit enterprise number, whose last two digits are a check:
// 97 − (first eight digits mod 97).

const digitsOf = (vat: string) => vat.replace(/\D/g, '');

export function isValidBeVat(vat: string): boolean {
  if (!/^BE/i.test(vat.trim())) return false;
  const d = digitsOf(vat);
  if (d.length !== 10 || !/^[01]/.test(d)) return false;
  return 97 - (Number(d.slice(0, 8)) % 97) === Number(d.slice(8));
}

/** "BE 0412.345.6xx" with the check digits filled in from the first eight digits. */
export function beVat(first8: string): string {
  if (!/^[01]\d{7}$/.test(first8)) throw new Error(`beVat needs 8 digits starting with 0 or 1, got ${first8}`);
  const check = String(97 - (Number(first8) % 97)).padStart(2, '0');
  const d = first8 + check;
  return `BE ${d.slice(0, 4)}.${d.slice(4, 7)}.${d.slice(7)}`;
}
