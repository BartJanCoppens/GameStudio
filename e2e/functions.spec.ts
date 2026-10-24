import { expect, test } from '@playwright/test';
import { callAs, seedGame, tinyGame, userClient } from './games';

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

const opponentGame = () => {
  const game = tinyGame();
  game.concept.aiRole = { kind: 'opponent', description: 'A cautious poker player who bluffs rarely', actions: ['raise', 'fold'] };
  return game;
};

async function testRun(gameKey: string): Promise<string> {
  const { client } = await userClient('creator');
  const { data, error } = await client.from('game_runs').insert({ game_key: gameKey, content_version: 0, test: true }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

test('game-ai refuses a run that is not yours', async () => {
  const key = await seedGame('Poker test', opponentGame(), { secret: { strategy: 'fold on weak hands' } });
  const runId = await testRun(key);
  const { status } = await callAs('player', 'game-ai', { game_key: key, run_id: runId, messages: [{ role: 'player', text: 'Your move' }], state: {} });
  expect(status).toBe(403);
});

test('game-ai refuses a game without an AI role', async () => {
  const key = await seedGame('No AI quiz', tinyGame());
  const runId = await testRun(key);
  const { status, body } = await callAs('creator', 'game-ai', { game_key: key, run_id: runId, messages: [{ role: 'player', text: 'Hi' }], state: {} });
  expect(status).toBe(400);
  expect(body.error).toBe('This game has no AI role');
});

// Live AI: a few cents, only with E2E_LIVE_AI=1.
test('the AI opponent replies in role and only with allowed actions', async () => {
  test.skip(!process.env.E2E_LIVE_AI, 'set E2E_LIVE_AI=1 to call the real model');
  const key = await seedGame('Poker live', opponentGame(), { secret: { strategy: 'fold on weak hands, raise on pairs' } });
  const runId = await testRun(key);
  const { status, body } = await callAs('creator', 'game-ai', { game_key: key, run_id: runId, messages: [{ role: 'player', text: 'I raise. Your move.' }], state: { yourHand: ['2♣', '7♦'], pot: 40 } });
  expect(status).toBe(200);
  expect(typeof body.say).toBe('string');
  expect((body.say as string).length).toBeGreaterThan(0);
  expect([null, 'raise', 'fold']).toContain(body.action);
});
