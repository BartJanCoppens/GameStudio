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

describe('turn-taking concepts', () => {
  const turns = { ways: ['live', 'async'], turnSeconds: 60, notify: ['push'], results: true };
  const duel = { ...concept, mode: 'turns', turns };
  it('accepts a turn-taking concept', () => expect(conceptProblems(duel)).toEqual([]));
  it('refuses a turn-taking concept with an AI role', () =>
    expect(conceptProblems({ ...duel, aiRole: { kind: 'game_master', description: 'Narrates', actions: [] } }).join(' ')).toContain('Turn-taking games can’t have an AI role yet'));
  it('refuses turns without ways or notify, or turnSeconds outside 15–600', () => {
    for (const bad of [{ ...turns, ways: [] }, { ...turns, notify: [] }, { ...turns, turnSeconds: 5 }, { ...turns, turnSeconds: 900 }, { ...turns, ways: ['live', 'teams'] }, null]) {
      expect(conceptProblems({ ...duel, turns: bad }).join(' ')).toContain('turn-taking settings');
    }
  });
  it('normalizes turns to null for solo games', async () => {
    const { normalizeConcept } = await import('../../supabase/functions/_shared/gameModel.ts');
    expect(normalizeConcept({ ...concept, turns })).toMatchObject({ turns: null });
    expect(normalizeConcept(duel)).toMatchObject({ turns });
  });
});

describe('normalizeConcept', () => {
  it('trims over-long AI text to the limits, so the concept passes', async () => {
    const { normalizeConcept } = await import('../../supabase/functions/_shared/gameModel.ts');
    const long = {
      ...concept, title: 'T'.repeat(200), pitch: 'P'.repeat(900), howToPlay: Array.from({ length: 12 }, (_, i) => `step ${i} ${'x'.repeat(400)}`),
      aiRole: { kind: 'opponent', description: 'D'.repeat(1200), actions: Array.from({ length: 20 }, (_, i) => `move ${i} ${'y'.repeat(60)}`) },
      look: { name: 'N'.repeat(100), tokens: DEFAULT_TOKENS },
    };
    expect(conceptProblems(long).length).toBeGreaterThan(0);
    expect(conceptProblems(normalizeConcept(long))).toEqual([]);
  });
});

describe('turnsLabel', () => {
  it('says how a turn-taking game is played and notified', async () => {
    const { turnsLabel } = await import('./turns');
    expect(turnsLabel({ ways: ['live', 'async'], turnSeconds: 60, notify: ['push', 'email'], results: true })).toBe('Turn-taking · live (60 s a turn) or turn by turn · notified by phone and email');
  });
});
