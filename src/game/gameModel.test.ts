import { describe, expect, it } from 'vitest';
import { DEFAULT_TOKENS } from '../../supabase/functions/_shared/design.ts';
import { conceptProblems } from '../../supabase/functions/_shared/gameModel.ts';

const concept = {
  title: 'Audit escape', pitch: 'Escape the audit room.', howToPlay: ['Find clues'], winCondition: 'Open the door', scoring: '10 per clue',
  mode: 'solo', goal: null, leaderboard: true, aiRole: null, sources: ['p-number'], look: { name: 'TaxConnect', tokens: DEFAULT_TOKENS },
};

describe('conceptProblems', () => {
  it('accepts a valid concept', () => expect(conceptProblems(concept)).toEqual([]));
  it('rejects an unknown source', () => expect(conceptProblems({ ...concept, sources: ['p-made-up'] }).join(' ')).toContain('p-made-up'));
  it('needs a goal for a common-goal game', () => expect(conceptProblems({ ...concept, mode: 'common_goal' }).join(' ')).toContain('goal'));
  it('rejects an unreadable look', () => expect(conceptProblems({ ...concept, look: { name: 'x', tokens: { ...DEFAULT_TOKENS, ink: '#FFFFFF' } } }).join(' ')).toContain('look'));
  it('caps opponent moves at 12', () => {
    const aiRole = { kind: 'opponent', description: 'A rival', actions: Array.from({ length: 13 }, (_, i) => `m${i}`) };
    expect(conceptProblems({ ...concept, aiRole }).join(' ')).toContain('moves');
  });
  it('rejects a missing title', () => expect(conceptProblems({ ...concept, title: '' }).join(' ')).toContain('title'));
});
