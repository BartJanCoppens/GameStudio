// Resets the hosted project for a pitch run-through: removes every game (with its runs, chats, checks,
// secrets and contributions) and the looks creator@ made with AI.
//
//   npm run demo:reset                         # clean slate: no games
//   npm run demo:reset -- --plan-b             # + the prepared game as a draft for creator@
//   npm run demo:reset -- --plan-b --publish   # + the prepared game, checked and published for players
//
// Needs SUPABASE_URL and SUPABASE_SECRET_KEY (in .env.seed). Leaves users, roles, AI keys, house rules and
// the preset looks alone. The prepared game is scripts/fixtures/plan-b-game.json, built once through the
// real Studio flow.
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

const CREATOR = 'creator@deloitte.com';
const FIXTURE = new URL('./fixtures/plan-b-game.json', import.meta.url);

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SECRET_KEY (the secret / service_role key), e.g. in .env.seed.');
  process.exit(1);
}
const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const check = ({ error }, what) => { if (error) { console.error(`${what}: ${error.message}`); process.exit(1); } };

const { data: users, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (error) throw error;
const creator = users.users.find(u => u.email === CREATOR);
if (!creator) { console.error(`${CREATOR} doesn’t exist; run npm run seed:users first.`); process.exit(1); }

const { data: games } = await admin.from('games').select('key, title');
if (games?.length) check(await admin.from('games').delete().in('key', games.map(g => g.key)), 'Removing games');
console.log(`Removed ${games?.length ?? 0} games${games?.length ? `: ${games.map(g => g.title).join(', ')}` : ''}`);
const { data: looks } = await admin.from('design_systems').select('name').eq('owner_id', creator.id);
check(await admin.from('design_systems').delete().eq('owner_id', creator.id), 'Removing looks');
console.log(`Removed ${looks?.length ?? 0} looks made by ${CREATOR}`);

if (process.argv.includes('--plan-b')) {
  if (!existsSync(FIXTURE)) { console.error('scripts/fixtures/plan-b-game.json is missing'); process.exit(1); }
  const planB = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const key = 'plan-b-' + planB.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  check(await admin.from('games').insert({ key, title: planB.title, description: planB.description ?? '' }), 'Plan B game');
  // The insert trigger stamps the caller (none, for the service role) as creator; hand it to creator@.
  check(await admin.from('games').update({ created_by: creator.id }).eq('key', key), 'Plan B owner');
  check(await admin.from('game_content').insert({ game_key: key, stage: 'draft', content: planB.content }), 'Plan B draft');
  check(await admin.from('game_secrets').insert({ game_key: key, stage: 'draft', ai: planB.secret ?? {} }), 'Plan B secret');
  let state = 'a draft for';
  if (process.argv.includes('--publish')) {
    // What the Studio does after a passed house-rules check: record the check, then copy draft to live.
    const { data: fingerprint, error: fe } = await admin.rpc('draft_fingerprint', { p_game_key: key });
    if (fe) { console.error(`Fingerprint: ${fe.message}`); process.exit(1); }
    check(await admin.from('game_checks').insert({ game_key: key, fingerprint, passed: true, reasons: [], checked_by: creator.id }), 'Plan B check');
    check(await admin.from('game_content').insert({ game_key: key, stage: 'live', content: planB.content }), 'Plan B live');
    check(await admin.from('game_secrets').insert({ game_key: key, stage: 'live', ai: planB.secret ?? {} }), 'Plan B live secret');
    state = 'published, owned by';
  }
  console.log(`Added “${planB.title}”, ${state} ${CREATOR}`);
}
