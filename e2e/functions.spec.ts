import { expect, test } from '@playwright/test';
import { callAs, seedGame, tinyGame } from './games';

// Edge Function behaviour that needs no model call (each request is refused before the AI is asked).

test('game-check fails code that contacts another website', async () => {
  const game = tinyGame();
  game.files['game.js'] += '\nfetch("https://x.y/collect");';
  const key = await seedGame('Leaky quiz', game);
  const { status, body } = await callAs('creator', 'game-check', { game_key: key });
  expect(status).toBe(200);
  expect(body.passed).toBe(false);
  expect((body.reasons as string[]).join(' ')).toContain('contacts another website');
});

test('game-check refuses someone who may not edit the game', async () => {
  const key = await seedGame('Private quiz', tinyGame());
  const { status } = await callAs('player', 'game-check', { game_key: key });
  expect(status).toBe(403);
});
