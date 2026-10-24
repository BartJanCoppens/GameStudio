import { POINTS_PER_ERROR, POINTS_PER_FALSE_FLAG, errorsOn, type GameContent, type PlantedError } from './content';

/** The player's verdict on one field: "this is wrong, because of this rule". */
export interface Flag {
  field: string;
  rule: string;
}

/** What the player submitted for one invoice. No flags means "No errors". */
export interface InvoiceAnswer {
  invoice: number;
  flags: Flag[];
}

export type ErrorOutcome = 'found' | 'wrong-rule' | 'missed';

export interface InvoiceResult {
  invoice: number;
  correct: boolean;
  errors: { error: PlantedError; outcome: ErrorOutcome; flag?: Flag }[];
  /** Flags on fields that hold no planted error. */
  falseFlags: Flag[];
  points: number;
}

export function scoreInvoice(content: GameContent, answer: InvoiceAnswer): InvoiceResult {
  const planted = errorsOn(content, answer.invoice);
  const used = new Set<Flag>();
  const errors = planted.map(error => {
    const onField = answer.flags.filter(f => error.fields.includes(f.field));
    onField.forEach(f => used.add(f));
    const right = onField.find(f => f.rule === error.rule);
    if (right) return { error, outcome: 'found' as const, flag: right };
    if (onField.length) return { error, outcome: 'wrong-rule' as const, flag: onField[0] };
    return { error, outcome: 'missed' as const };
  });
  const falseFlags = answer.flags.filter(f => !used.has(f));
  const found = errors.filter(e => e.outcome === 'found').length;
  return {
    invoice: answer.invoice,
    // Right only when every error is named with its rule and nothing else is flagged.
    correct: errors.every(e => e.outcome === 'found') && falseFlags.length === 0,
    errors,
    falseFlags,
    points: found * POINTS_PER_ERROR + falseFlags.length * POINTS_PER_FALSE_FLAG,
  };
}

export interface RunScore {
  invoicesCorrect: number;
  errorsFound: number;
  falseFlags: number;
  points: number;
  results: InvoiceResult[];
}

/** Invoices without an answer (time ran out) count as judged wrong and their errors as missed. */
export function scoreRun(content: GameContent, answers: InvoiceAnswer[]): RunScore {
  const byInvoice = new Map(answers.map(a => [a.invoice, a]));
  const results = content.invoices.map(inv => {
    const answer = byInvoice.get(inv.no);
    if (answer) return scoreInvoice(content, answer);
    const missed = scoreInvoice(content, { invoice: inv.no, flags: [] });
    return { ...missed, correct: false };
  });
  return {
    invoicesCorrect: results.filter(r => r.correct).length,
    errorsFound: results.reduce((a, r) => a + r.errors.filter(e => e.outcome === 'found').length, 0),
    falseFlags: results.reduce((a, r) => a + r.falseFlags.length, 0),
    points: results.reduce((a, r) => a + r.points, 0),
    results,
  };
}
