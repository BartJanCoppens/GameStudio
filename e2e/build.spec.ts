import { expect, test, type Page, type Route } from '@playwright/test';
import { emailFor, password } from './accounts';
import { adminClient } from './accounts';
import { seedGame, tinyGame, userClient } from './games';

async function signInCreator(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email').fill(emailFor('creator'));
  await page.getByLabel('Password').fill(password());
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('complementary').getByRole('button', { name: 'Sign out' })).toBeVisible();
}

const sse = (events: [string, unknown][]) => events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('');

/** A game whose design is approved, so opening it starts the build. */
async function approvedGame(title: string) {
  const tiny = tinyGame();
  return seedGame(title, { ...tiny, phase: 'code', concept: { ...tiny.concept, title }, files: null, data: null });
}

test('a long game logic is written in parts', async ({ page }) => {
  const title = `Long logic ${Date.now()}`;
  const key = await approvedGame(title);
  const tiny = tinyGame();
  const js: string = tiny.files['game.js'];
  const cut = Math.floor(js.length / 2);
  const logicBodies: Record<string, unknown>[] = [];
  await page.route('**/functions/v1/game-builder', async (route: Route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const sse = (event: string, data: unknown) => route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*' }, body: `event: ${event}\ndata: ${JSON.stringify(data)}\n\n` });
    if (body.step === 'data') return sse('done', { data: tiny.data, notes: 'questions[]' });
    if (body.step === 'screens') return sse('done', { file: 'index.html', content: tiny.files['index.html'] });
    logicBodies.push(body);
    // The first answer reaches its length limit; the second finishes the file.
    return body.so_far ? sse('done', { file: 'game.js', content: js }) : sse('done', { partial: true, text: js.slice(0, cut) });
  });
  await signInCreator(page);
  await page.goto(`/#/studio?game=${key}`);
  await expect(page.getByRole('button', { name: 'Play test' })).toBeVisible({ timeout: 30_000 });
  expect(logicBodies).toHaveLength(2);
  expect(logicBodies[1].so_far).toBe(js.slice(0, cut));
  expect(logicBodies[1].part).toBe(2);
  const { data } = await adminClient().from('game_content').select('content').eq('game_key', key).eq('stage', 'draft').single();
  expect(data!.content.files['game.js']).toBe(js);
});

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

/** A built game with a passing house-rules check on its current draft. */
async function checkedGame(title: string) {
  const tiny = tinyGame();
  const key = await seedGame(title, { ...tiny, concept: { ...tiny.concept, title } });
  const admin = adminClient();
  const { data: fingerprint } = await admin.rpc('draft_fingerprint', { p_game_key: key });
  await admin.from('game_checks').insert({ game_key: key, fingerprint, passed: true, reasons: [] });
  return key;
}

test('a creator names the game admin at publish and the game starts closed', async ({ page }) => {
  const title = `Publishable ${Date.now()}`;
  const key = await checkedGame(title);
  await signInCreator(page);
  await page.goto(`/#/studio?game=${key}`);
  await expect(page.getByText('Passed the house-rules check')).toBeVisible();
  const publish = page.getByRole('button', { name: 'Publish to players' });
  await expect(publish).toBeDisabled();
  await page.getByRole('combobox', { name: 'Game admin' }).selectOption({ label: 'E2E gameadmin' });
  await publish.click();
  await expect(page.getByText('Published · the game admin decides who may play it')).toBeVisible();
  await expect(page.getByText('Game admin: E2E gameadmin')).toBeVisible();
  const { client } = await userClient('player');
  const { data } = await client.from('games').select('key').eq('key', key);
  expect(data).toHaveLength(0);
});

test('the Studio names the game admin without a wrong name while it loads', async ({ page }) => {
  const title = `Named admin ${Date.now()}`;
  const tiny = tinyGame();
  const key = await seedGame(title, { ...tiny, concept: { ...tiny.concept, title } }, { publish: true });
  await page.route('**/rest/v1/rpc/game_admins_to_choose*', async route => { await new Promise(r => setTimeout(r, 2500)); await route.continue(); });
  await signInCreator(page);
  await page.goto(`/#/studio?game=${key}`);
  await expect(page.getByText('Live: players have this version')).toBeVisible();
  // Counted once, at this moment: an auto-retrying assertion would wait for the list to arrive.
  expect(await page.getByText(/no longer look after games/).count()).toBe(0);
  await expect(page.getByText('Game admin: E2E gameadmin')).toBeVisible();
});

test('the Studio doesn’t show a game admin’s check of added content as the draft’s check', async ({ page }) => {
  const title = `Admin checked ${Date.now()}`;
  const tiny = tinyGame();
  const key = await seedGame(title, { ...tiny, concept: { ...tiny.concept, title } });
  const admin = adminClient();
  // The creator's own check failed; then a game admin's addition passed (game-content's fingerprints start with sha256:).
  await admin.from('game_checks').insert({ game_key: key, fingerprint: 'f'.repeat(32), passed: false, reasons: ['Too violent'] });
  await admin.from('game_checks').insert({ game_key: key, fingerprint: 'sha256:' + '0'.repeat(64), passed: true, reasons: [] });
  await signInCreator(page);
  await page.goto(`/#/studio?game=${key}`);
  await expect(page.getByText('Didn’t pass the house-rules check')).toBeVisible();
  await expect(page.getByText('Passed the house-rules check')).toHaveCount(0);
});

test('publishing is refused after the draft changes', async ({ page }) => {
  const title = `Changed after check ${Date.now()}`;
  const key = await checkedGame(title);
  // The creator's draft changes after the check (here directly, as a change request would).
  const { client } = await (await import('./games')).userClient('creator');
  const { data } = await client.from('game_content').select('content').eq('game_key', key).eq('stage', 'draft').single();
  await client.from('game_content').update({ content: { ...data!.content, data: { questions: [] } } }).eq('game_key', key).eq('stage', 'draft');
  await signInCreator(page);
  await page.goto(`/#/studio?game=${key}`);
  await expect(page.getByText('The game changed since the last check')).toBeVisible();
  await page.getByRole('combobox', { name: 'Game admin' }).selectOption({ label: 'E2E gameadmin' });
  await page.getByRole('button', { name: 'Publish to players' }).click();
  await expect(page.getByText(/The game changed since the house-rules check/)).toBeVisible();
});

test('game logic with a syntax error is refused and can be retried', async ({ page }) => {
  const title = `Syntax ${Date.now()}`;
  const key = await approvedGame(title);
  let logicCalls = 0;
  await page.route('**/functions/v1/game-builder', async (route: Route) => {
    const body = route.request().postDataJSON() as { step: string };
    const tiny = tinyGame();
    const events: [string, unknown][] =
      body.step === 'data' ? [['done', { data: tiny.data, notes: 'questions[]' }]]
        : body.step === 'screens' ? [['done', { file: 'index.html', content: tiny.files['index.html'] }]]
          : [['done', { file: 'game.js', content: logicCalls++ === 0 ? '(async () => { const x = [1, 2,' : tiny.files['game.js'] }]];
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*' }, body: sse(events) });
  });
  await signInCreator(page);
  await page.goto(`/#/studio?game=${key}`);
  await expect(page.getByRole('listitem', { name: 'Writing the game logic: failed' })).toContainText('syntax error');
  const { data } = await adminClient().from('game_content').select('content').eq('game_key', key).eq('stage', 'draft').single();
  expect(data!.content.files).toBeNull();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('button', { name: 'Play test' })).toBeVisible({ timeout: 30_000 });
});

test('a change with broken code changes nothing, and a good change can be undone', async ({ page }) => {
  const title = `Undo ${Date.now()}`;
  const tiny = tinyGame();
  const key = await seedGame(title, { ...tiny, concept: { ...tiny.concept, title } });
  let changeCalls = 0;
  await page.route('**/functions/v1/game-builder', async (route: Route) => {
    const broken = changeCalls++ === 0;
    const files = { 'game.js': broken ? 'function ( {' : `${tiny.files['game.js']}\n// changed` };
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*' }, body: sse([['done', { reply: 'Made it harder.', files }]]) });
  });
  await signInCreator(page);
  await page.goto(`/#/studio?game=${key}`);
  const input = page.getByRole('textbox', { name: 'Message the AI about this game' });
  await input.fill('Make it harder');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText(/syntax error/)).toBeVisible();
  const before = (await adminClient().from('game_content').select('content').eq('game_key', key).eq('stage', 'draft').single()).data!.content;
  expect(before.files['game.js']).toBe(tiny.files['game.js']);

  await input.fill('Make it harder');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo last change' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo last change' }).click();
  await expect(page.getByRole('button', { name: 'Undo last change' })).toHaveCount(0);
  const after = (await adminClient().from('game_content').select('content').eq('game_key', key).eq('stage', 'draft').single()).data!.content;
  expect(after.files['game.js']).toBe(tiny.files['game.js']);
});

test('Try again re-runs a failed design change without repeating the message', async ({ page }) => {
  const title = `Revise ${Date.now()}`;
  const tiny = tinyGame();
  const key = await seedGame(title, { ...tiny, phase: 'design', files: null, data: null, mockup: '<main>mock</main>', concept: { ...tiny.concept, title } });
  let calls = 0;
  await page.route('**/functions/v1/game-architect', async (route: Route) => {
    const body = route.request().postDataJSON() as { mode: string; request: string };
    if (calls++ === 0) return route.fulfill({ status: 502, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'The design wasn’t valid (The AI role needs a description). Try again.' }) });
    expect(body.mode).toBe('revise');
    expect(body.request).toBe('Make it film noir');
    await route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'concept', reply: 'Now in noir.', concept: { ...tiny.concept, title: `${title} noir` }, mockup_html: '<main>noir</main>' }) });
  });
  await signInCreator(page);
  await page.goto(`/#/studio?game=${key}`);
  await page.getByRole('textbox', { name: 'Message the AI about this game' }).fill('Make it film noir');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('The design wasn’t valid')).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('region', { name: 'Concept' }).getByRole('heading')).toHaveText(`${title} noir`);
  const { data } = await adminClient().from('game_content').select('content').eq('game_key', key).eq('stage', 'draft').single();
  expect(data!.content.brief.filter((t: { text: string }) => t.text === 'Make it film noir')).toHaveLength(1);
});

test('Retry while the other step is still running doesn’t start it twice', async ({ page }) => {
  const title = `Inflight ${Date.now()}`;
  const key = await approvedGame(title);
  const calls: Record<string, number> = { data: 0, screens: 0, logic: 0 };
  await page.route('**/functions/v1/game-builder', async (route: Route) => {
    const body = route.request().postDataJSON() as { step: string };
    calls[body.step]++;
    const tiny = tinyGame();
    if (body.step === 'screens') await new Promise(r => setTimeout(r, 4000));
    const events: [string, unknown][] =
      body.step === 'data' ? (calls.data === 1 ? [['error', { error: 'The content wasn’t valid JSON. Try again.' }]] : [['done', { data: tiny.data, notes: 'questions[]' }]])
        : body.step === 'screens' ? [['done', { file: 'index.html', content: tiny.files['index.html'] }]]
          : [['done', { file: 'game.js', content: tiny.files['game.js'] }]];
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*' }, body: sse(events) });
  });
  await signInCreator(page);
  await page.goto(`/#/studio?game=${key}`);
  await expect(page.getByRole('listitem', { name: 'Writing the game’s content: failed' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('listitem', { name: 'Building the screens: running' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('button', { name: 'Play test' })).toBeVisible({ timeout: 30_000 });
  expect(calls).toEqual({ data: 2, screens: 1, logic: 1 });
});

test('the creator hides and shows the chat, and views the design and the game full screen', async ({ page }) => {
  const title = `Layout ${Date.now()}`;
  const tiny = tinyGame();
  const designKey = await seedGame(title, { ...tiny, phase: 'design', files: null, data: null, mockup: '<main><h1>Mock</h1></main>', concept: { ...tiny.concept, title } });
  await signInCreator(page);
  await page.goto(`/#/studio?game=${designKey}`);
  const chat = page.getByRole('region', { name: 'Conversation' });
  await expect(chat).toBeVisible();
  const before = (await page.locator('iframe[title="Mock-up"]').boundingBox())!.width;
  await page.getByRole('button', { name: 'Hide chat' }).click();
  await expect(chat).toHaveCount(0);
  await expect.poll(async () => (await page.locator('iframe[title="Mock-up"]').boundingBox())!.width).toBeGreaterThan(before + 150);
  await page.getByRole('button', { name: 'Show chat' }).click();
  await expect(chat).toBeVisible();

  await page.getByRole('button', { name: 'Full screen' }).click();
  const viewport = page.viewportSize()!;
  await expect.poll(async () => (await page.locator('iframe[title="Mock-up"]').boundingBox())!.width).toBeGreaterThan(viewport.width - 40);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await page.locator('iframe[title="Mock-up"]').boundingBox())!.width).toBeLessThan(viewport.width - 200);

  const readyKey = await seedGame(`${title} ready`, { ...tiny, concept: { ...tiny.concept, title: `${title} ready` } });
  await page.goto(`/#/studio?game=${readyKey}`);
  await page.getByRole('button', { name: 'Play test' }).click();
  // The test run has started (and its fresh frame has replaced the preview).
  await expect(page.getByRole('button', { name: 'Restart test' })).toBeVisible();
  const frame = page.frameLocator('iframe[title="Game"]');
  await expect(frame.getByRole('heading', { name: tiny.data.questions[0].q })).toBeVisible();
  await frame.getByRole('button', { name: tiny.data.questions[0].options[tiny.data.questions[0].answer], exact: true }).click();
  await page.getByRole('button', { name: 'Full screen' }).click();
  await expect.poll(async () => (await page.locator('iframe[title="Game"]').boundingBox())!.width).toBeGreaterThan(viewport.width - 40);
  // Still the same game: the second question is showing, not the first.
  await expect(frame.getByRole('heading', { name: tiny.data.questions[1].q })).toBeVisible();
  await page.getByRole('button', { name: 'Exit full screen' }).click();
  await expect.poll(async () => (await page.locator('iframe[title="Game"]').boundingBox())!.width).toBeLessThan(viewport.width - 200);
});

test('a creator takes in content a game admin added', async ({ page }) => {
  const title = `Behind ${Date.now()}`;
  const tiny = tinyGame();
  const key = await seedGame(title, { ...tiny, concept: { ...tiny.concept, title } }, { publish: true });
  // The creator changes their draft, then a game admin adds content to the live game.
  const { client } = await (await import('./games')).userClient('creator');
  const { data: draft } = await client.from('game_content').select('content').eq('game_key', key).eq('stage', 'draft').single();
  await client.from('game_content').update({ content: { ...draft!.content, data: { questions: draft!.content.data.questions.map((q: { q: string }, i: number) => (i === 0 ? { ...q, q: `${q.q} (reworded)` } : q)) } } }).eq('game_key', key).eq('stage', 'draft');
  const more = { questions: [...tiny.data.questions, { q: 'Added?', options: ['Yes', 'No'], answer: 0, source: 'p-number' }] };
  const { error } = await adminClient().rpc('publish_live_content', { p_game_key: key, p_data: more, p_fingerprint: 'e2e', p_checked_by: null });
  expect(error).toBeNull();

  await signInCreator(page);
  await page.goto(`/#/studio?game=${key}`);
  await expect(page.getByText('A game admin added content to the live game. Take it into your draft first.')).toBeVisible();
  await page.getByRole('button', { name: 'Take in the live content' }).click();
  await expect(page.getByRole('button', { name: 'Take in the live content' })).toHaveCount(0);
  const { data: after } = await adminClient().from('game_content').select('content').eq('game_key', key).eq('stage', 'draft').single();
  expect(after!.content.data.questions).toHaveLength(11);
});

test('a stale Studio tab can’t overwrite a draft that changed underneath it', async ({ page }) => {
  const title = `Stale tab ${Date.now()}`;
  const tiny = tinyGame();
  const key = await seedGame(title, { ...tiny, concept: { ...tiny.concept, title } });
  await page.route('**/functions/v1/game-builder', route => route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*' },
    body: `event: done\ndata: ${JSON.stringify({ reply: 'Changed.', files: { 'game.js': `${tiny.files['game.js']}\n// changed` } })}\n\n` }));
  await signInCreator(page);
  await page.goto(`/#/studio?game=${key}`);
  await expect(page.getByRole('button', { name: 'Play test' })).toBeVisible();
  // Meanwhile the draft changes on the server (as when a game admin's addition syncs into it).
  const more = { questions: [...tiny.data.questions, { q: 'Synced?', options: ['Yes', 'No'], answer: 0, source: 'p-number' }] };
  const { data: row } = await adminClient().from('game_content').select('content').eq('game_key', key).eq('stage', 'draft').single();
  await adminClient().from('game_content').update({ content: { ...row!.content, data: more } }).eq('game_key', key).eq('stage', 'draft');
  await page.getByRole('textbox', { name: 'Message the AI about this game' }).fill('Change something');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText(/The draft changed in the meantime/)).toBeVisible();
  const { data: after } = await adminClient().from('game_content').select('content').eq('game_key', key).eq('stage', 'draft').single();
  expect(after!.content.data.questions).toHaveLength(11);
});
