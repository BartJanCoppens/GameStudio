import { expect, test, type Page, type Route } from '@playwright/test';
import { emailFor, password } from './accounts';
import { adminClient } from './accounts';
import { seedGame, tinyGame } from './games';

async function signInCreator(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email').fill(emailFor('creator'));
  await page.getByLabel('Password').fill(password());
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('banner').getByRole('button', { name: 'Sign out' })).toBeVisible();
}

const sse = (events: [string, unknown][]) => events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('');

/** A game whose design is approved, so opening it starts the build. */
async function approvedGame(title: string) {
  const tiny = tinyGame();
  return seedGame(title, { ...tiny, phase: 'code', concept: { ...tiny.concept, title }, files: null, data: null });
}

test('a failed build step keeps the previous files and offers Retry', async ({ page }) => {
  const title = `Build failure ${Date.now()}`;
  const key = await approvedGame(title);
  let logicCalls = 0;
  await page.route('**/functions/v1/game-builder', async (route: Route) => {
    const body = route.request().postDataJSON() as { step: string };
    const tiny = tinyGame();
    const events: [string, unknown][] =
      body.step === 'data' ? [['delta', '{"data_json":'], ['done', { data: tiny.data, notes: 'questions[]' }]]
        : body.step === 'screens' ? [['delta', '<main id="app">'], ['done', { file: 'index.html', content: tiny.files['index.html'] }]]
          : (logicCalls++ === 0 ? [['delta', '(async () => {'], ['error', { error: 'The game logic broke a platform rule (game.js contacts another website). Try again.' }]]
            : [['delta', 'GameStudio.ready();'], ['done', { file: 'game.js', content: tiny.files['game.js'] }]]);
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*' }, body: sse(events) });
  });
  await signInCreator(page);
  await page.goto(`/#/studio?game=${key}`);
  await expect(page.getByRole('listitem', { name: 'Writing the game logic: failed' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('contacts another website')).toBeVisible();
  const { data } = await adminClient().from('game_content').select('content').eq('game_key', key).eq('stage', 'draft').single();
  expect(data!.content.files).toBeNull();
  expect(data!.content.phase).toBe('code');

  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('button', { name: 'Play test' })).toBeVisible({ timeout: 30_000 });
  expect(logicCalls).toBe(2);
});

// Live AI: a few minutes and roughly half a dollar, only with E2E_LIVE_AI=1.
test('a creator builds and test-plays a game', async ({ page }) => {
  test.skip(!process.env.E2E_LIVE_AI, 'set E2E_LIVE_AI=1 to call the real model');
  test.setTimeout(420_000);
  const title = `Live build ${Date.now()}`;
  const key = await approvedGame(title);
  await signInCreator(page);
  const t0 = Date.now();
  await page.goto(`/#/studio?game=${key}`);
  await expect(page.getByRole('button', { name: 'Play test' })).toBeVisible({ timeout: 400_000 });
  console.log(`build took ${Math.round((Date.now() - t0) / 1000)} s`);
  await page.getByRole('button', { name: 'Play test' }).click();
  const frame = page.frameLocator('iframe[title="Game"]');
  await expect(frame.locator('body')).not.toBeEmpty();
  await page.screenshot({ path: 'test-results/live-build.png' });
});
