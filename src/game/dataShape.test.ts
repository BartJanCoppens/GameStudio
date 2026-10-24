import { describe, expect, it } from 'vitest';
import { dataShapeProblems } from '../../supabase/functions/_shared/gameModel.ts';

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
