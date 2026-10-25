import { describe, expect, it } from 'vitest';
import { dataShapeProblems, echoedSecrets, progressDelta } from '../../supabase/functions/_shared/gameModel.ts';

const before = { title: 'Quiz', questions: [{ q: 1 }, { q: 2 }], meta: { levels: [1, 2], name: 'x' } };

describe('dataShapeProblems', () => {
  it('accepts added items', () => expect(dataShapeProblems(before, { ...before, questions: [...before.questions, { q: 3 }], meta: { ...before.meta, levels: [1, 2, 3] } })).toEqual([]));
  it('refuses a dropped key', () => expect(dataShapeProblems(before, { questions: before.questions, meta: before.meta }).join(' ')).toContain('The new content dropped title'));
  it('refuses a changed type', () => expect(dataShapeProblems(before, { ...before, questions: 'many' }).join(' ')).toContain('questions changed type'));
  it('refuses a shorter list', () => expect(dataShapeProblems(before, { ...before, questions: [{ q: 1 }] }).join(' ')).toContain('questions lost items'));
  it('refuses a shorter nested list', () => expect(dataShapeProblems(before, { ...before, meta: { ...before.meta, levels: [1] } }).join(' ')).toContain('meta.levels lost items'));
  it('refuses rewritten existing items', () => expect(dataShapeProblems(before, { ...before, questions: [{ q: 9 }, { q: 2 }, { q: 3 }] }).join(' ')).toContain('questions changed existing items'));
  it('refuses new top-level keys the game doesn’t read', () => expect(dataShapeProblems(before, { ...before, cases: [1] }).join(' ')).toContain('new part cases'));
  it('refuses content that is not an object', () => expect(dataShapeProblems(before, [1, 2]).join(' ')).toContain('changed type'));
});

describe('echoedSecrets', () => {
  const secret = { culprit: 'The bookkeeper forged invoice 3', motive: 'debts', clues: ['Look at the VAT number on invoice 2'] };
  it('finds hidden knowledge repeated in the content', () =>
    expect(echoedSecrets({ cases: [{ hint: 'Remember: the bookkeeper forged invoice 3!' }] }, secret)).toEqual(['The bookkeeper forged invoice 3']));
  it('finds it in nested lists, ignoring case', () =>
    expect(echoedSecrets({ q: ['look at the vat number on invoice 2'] }, secret)).toHaveLength(1));
  it('ignores short values that would match by chance', () => expect(echoedSecrets({ q: ['debts'] }, secret)).toEqual([]));
  it('finds nothing without hidden knowledge', () => expect(echoedSecrets({ q: ['x'] }, null)).toEqual([]));
  it('sees through changed case, spacing and punctuation', () =>
    expect(echoedSecrets({ q: ['THE  bookkeeper, forged invoice-3'] }, secret)).toHaveLength(1));
  it('checks a reply as well as content', () =>
    expect(echoedSecrets('Added cases. Note: "the bookkeeper forged invoice 3".', secret)).toHaveLength(1));
});

describe('progressDelta', () => {
  const sent: [string, unknown][] = [];
  const send = (event: string, data: unknown) => { sent.push([event, data]); };
  it('sends progress without the model’s text when adding content', () => {
    sent.length = 0;
    progressDelta('extend', send)('{"culprit":"the bookkeeper"}');
    expect(sent).toEqual([['delta', '.'.repeat(28)]]);
  });
  it('streams the text for the creator’s own build steps', () => {
    sent.length = 0;
    progressDelta('logic', send)('let x = 1;');
    expect(sent).toEqual([['delta', 'let x = 1;']]);
  });
});
