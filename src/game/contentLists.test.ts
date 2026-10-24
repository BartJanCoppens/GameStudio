import { describe, expect, it } from 'vitest';
import { contentLists } from './contentLists';

describe('contentLists', () => {
  it('lists top-level and one-level-down lists with their sizes', () =>
    expect(contentLists({ title: 'x', questions: [1, 2, 3], meta: { levels: [1], name: 'y' } })).toEqual([{ name: 'questions', count: 3 }, { name: 'meta.levels', count: 1 }]));
  it('handles content that is a list or nothing', () => {
    expect(contentLists([1, 2])).toEqual([{ name: 'items', count: 2 }]);
    expect(contentLists(null)).toEqual([]);
  });
});
