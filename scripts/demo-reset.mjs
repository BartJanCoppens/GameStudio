// Resets the hosted project for a pitch run-through: removes every game except the demo game
// (with their runs, chats and keys) and the looks creator@ made with AI. With --plan-b it adds a
// ready-made draft game owned by creator@, to open and publish if the live AI is slow on the day.
//
//   npm run demo:reset                 # clean slate
//   npm run demo:reset -- --plan-b     # clean slate + the prepared game
//
// Needs SUPABASE_URL and SUPABASE_SECRET_KEY (in .env.seed). Leaves users, roles, AI keys and the
// demo game's leaderboard alone.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const DEMO_GAME = 'invoice-errors';
const CREATOR = 'creator@deloitte.com';
const PLAN_B = {
  key: 'business-travel-expenses',
  title: 'Business travel expenses',
  description: 'Hotels, taxis, restaurants and flights from consultants’ trips in Belgium.',
  content: JSON.parse(readFileSync(new URL('./fixtures/plan-b-hotel-and-travel.json', import.meta.url), 'utf8')),
};

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

const { data: games } = await admin.from('games').select('title').neq('key', DEMO_GAME);
check(await admin.from('games').delete().neq('key', DEMO_GAME), 'Removing games');
console.log(`Removed ${games?.length ?? 0} games${games?.length ? `: ${games.map(g => g.title).join(', ')}` : ''}`);
const { data: looks } = await admin.from('design_systems').select('name').eq('owner_id', creator.id);
check(await admin.from('design_systems').delete().eq('owner_id', creator.id), 'Removing looks');
console.log(`Removed ${looks?.length ?? 0} looks made by ${CREATOR}`);

if (process.argv.includes('--plan-b')) {
  check(await admin.from('games').insert({ key: PLAN_B.key, title: PLAN_B.title, description: PLAN_B.description }), 'Plan B game');
  // The insert trigger stamps the caller (none, for the service role) as creator; hand it to creator@.
  check(await admin.from('games').update({ created_by: creator.id }).eq('key', PLAN_B.key), 'Plan B owner');
  check(await admin.from('game_content').insert({ game_key: PLAN_B.key, stage: 'draft', content: PLAN_B.content }), 'Plan B draft');
  console.log(`Added the draft “${PLAN_B.title}” (${PLAN_B.content.invoices.length} invoices, ${PLAN_B.content.errors.length} errors) for ${CREATOR}, not published`);
}
