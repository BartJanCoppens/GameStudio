import { describe, expect, it } from 'vitest';
import { leaderboardOf, type RunRow } from './runs';

const run = (user: string, score: number, duration: number): RunRow => ({
  id: `${user}-${score}-${duration}`, user_id: user, game_key: 'g', player_name: user, player_cohort: '',
  started_at: '2026-10-24T10:00:00Z', finished_at: '2026-10-24T10:05:00Z', duration_seconds: duration,
  score, details: {}, test: false, content_version: 1,
});

describe('leaderboardOf', () => {
  it("keeps each player's best score", () => {
    const board = leaderboardOf([run('ann', 40, 60), run('ann', 70, 90), run('bob', 50, 30)]);
    expect(board.map(e => [e.rank, e.userId, e.score, e.runs])).toEqual([[1, 'ann', 70, 2], [2, 'bob', 50, 1]]);
  });
  it('breaks ties by duration', () => {
    const board = leaderboardOf([run('slow', 50, 30), run('fast', 50, 20)]);
    expect(board.map(e => e.userId)).toEqual(['fast', 'slow']);
  });
});
