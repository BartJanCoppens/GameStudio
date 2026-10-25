// game-match: turn-taking games between two colleagues. The only writer of matches.
//
// 1. Who: the two players of a match (the inviter "a" and the invited colleague "b"), each of whom must still be
//    allowed to play the game (access, online, not archived, the player role). b moves first.
// 2. What: invite, accept, decline, withdraw, ready (live), move, pass (live, after the turn's time), get.
//    A move names the move number it was made on; a second move for the same turn is refused ("The game moved
//    on"). A player's private state is only ever returned to that player.
// 3. Notifications: invitations, answers and "your turn" (turn by turn) go out as the game's creator chose
//    (phone and/or email), without any of the game's content.
//
// Body: { action, ... } (see each action below)
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import type { GameContent, TurnsConfig } from '../_shared/gameModel.ts';
import { notify } from '../_shared/notify.ts';
import { CORS, HttpError, adminClient, caller, json, type Caller } from '../_shared/server.ts';

const LIMITS = { move: 4096, state: 32768, mine: 16384 };
type Side = 'a' | 'b';
interface Match {
  id: string; game_key: string; version: number; way: 'live' | 'async'; status: string; player_a: string; player_b: string;
  a_name: string; b_name: string; turn: Side; move_no: number; state: unknown; last_move: unknown; a_ready: boolean; b_ready: boolean;
  turn_ends_at: string | null; winner: Side | null;
}
type Body = Record<string, unknown>;

const size = (v: unknown) => JSON.stringify(v ?? null).length;
const other = (s: Side): Side => (s === 'a' ? 'b' : 'a');
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v);

async function canPlay(admin: SupabaseClient, gameKey: string, userId: string) {
  const { data, error } = await admin.rpc('can_user_play', { p_game_key: gameKey, p_user: userId });
  if (error) throw new Error(`can_user_play failed: ${error.message}`);
  if (data !== true) throw new HttpError(403, 'This game isn’t available');
}

async function turnsOf(admin: SupabaseClient, gameKey: string, version: number): Promise<{ turns: TurnsConfig; title: string }> {
  const { data } = await admin.from('game_versions').select('content').eq('game_key', gameKey).eq('version', version).maybeSingle();
  const concept = (data?.content as GameContent | undefined)?.concept;
  if (!concept || concept.mode !== 'turns' || !concept.turns) throw new HttpError(409, 'This isn’t a turn-taking game');
  return { turns: concept.turns, title: concept.title };
}

async function load(admin: SupabaseClient, c: Caller, id: unknown): Promise<{ m: Match; side: Side }> {
  if (!isUuid(id)) throw new HttpError(400, 'Say which game (match_id)');
  const { data } = await admin.from('matches').select('*').eq('id', id).maybeSingle<Match>();
  if (!data) throw new HttpError(404, 'That game no longer exists');
  const side: Side | null = data.player_a === c.id ? 'a' : data.player_b === c.id ? 'b' : null;
  if (!side) throw new HttpError(403, 'That game isn’t yours');
  await canPlay(admin, data.game_key, c.id);
  return { m: data, side };
}

/** Changes a match only if it is still as expected; otherwise someone (or the clock) got there first. */
async function update(admin: SupabaseClient, m: Match, expect: Record<string, unknown>, set: Record<string, unknown>): Promise<Match> {
  let q = admin.from('matches').update(set).eq('id', m.id);
  for (const [k, v] of Object.entries(expect)) q = q.eq(k, v as string);
  const { data, error } = await q.select('*');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new HttpError(409, 'The game moved on. It has been reloaded.');
  return data[0] as Match;
}

const nameOf = (m: Match, s: Side) => (s === 'a' ? m.a_name : m.b_name);
const playerOf = (m: Match, s: Side) => (s === 'a' ? m.player_a : m.player_b);

async function handle(admin: SupabaseClient, c: Caller, b: Body): Promise<unknown> {
  switch (b.action) {
    case 'invite': {
      if (typeof b.game_key !== 'string' || !isUuid(b.invitee) || (b.way !== 'live' && b.way !== 'async')) throw new HttpError(400, 'Say which game, whom and how (game_key, invitee, way)');
      if (b.invitee === c.id) throw new HttpError(400, 'Invite a colleague, not yourself');
      await canPlay(admin, b.game_key, c.id);
      await canPlay(admin, b.game_key, b.invitee);
      const { data: live } = await admin.from('game_content').select('version').eq('game_key', b.game_key).eq('stage', 'live').maybeSingle();
      if (!live) throw new HttpError(404, 'This game isn’t published');
      const { turns, title } = await turnsOf(admin, b.game_key, live.version as number);
      if (!turns.ways.includes(b.way)) throw new HttpError(400, b.way === 'live' ? 'This game is played turn by turn only' : 'This game is played live only');
      const { data: names } = await admin.from('profiles').select('id, full_name, email').in('id', [c.id, b.invitee]);
      const name = (id: string) => { const p = names?.find(x => x.id === id); return p?.full_name || 'A colleague'; };
      const { data: row, error } = await admin.from('matches').insert({
        game_key: b.game_key, version: live.version, way: b.way, player_a: c.id, player_b: b.invitee, a_name: name(c.id), b_name: name(b.invitee),
      }).select('id').single();
      if (error) throw new Error(error.message);
      await notify(admin, b.invitee, 'invite', name(c.id), title, row.id, turns.notify);
      return { match_id: row.id };
    }
    case 'accept':
    case 'decline':
    case 'withdraw': {
      const { m, side } = await load(admin, c, b.match_id);
      if (side !== (b.action === 'withdraw' ? 'a' : 'b')) throw new HttpError(403, b.action === 'withdraw' ? 'Only the person who invited can withdraw' : 'Only the invited colleague can answer');
      const { turns, title } = await turnsOf(admin, m.game_key, m.version);
      if (b.action === 'accept') await canPlay(admin, m.game_key, m.player_a);
      const status = b.action === 'accept' ? (m.way === 'live' ? 'waiting' : 'active') : b.action === 'decline' ? 'declined' : 'withdrawn';
      const done = b.action !== 'accept';
      const next = await update(admin, m, { status: 'invited' }, { status, last_activity_at: new Date().toISOString(), ...(done ? { finished_at: new Date().toISOString() } : {}) });
      if (b.action !== 'withdraw') await notify(admin, m.player_a, b.action === 'accept' ? 'accepted' : 'declined', m.b_name, title, m.id, turns.notify);
      return { status: next.status };
    }
    case 'ready': {
      const { m, side } = await load(admin, c, b.match_id);
      if (m.way !== 'live' || m.status !== 'waiting') return { status: m.status };
      const { turns } = await turnsOf(admin, m.game_key, m.version);
      const flags = { a_ready: m.a_ready || side === 'a', b_ready: m.b_ready || side === 'b' };
      const both = flags.a_ready && flags.b_ready;
      const now = Date.now();
      const next = await update(admin, m, { status: 'waiting', [`${side}_ready`]: side === 'a' ? m.a_ready : m.b_ready }, {
        ...flags, ...(both ? { status: 'active', turn_ends_at: new Date(now + turns.turnSeconds * 1000).toISOString(), last_activity_at: new Date(now).toISOString() } : {}),
      });
      return { status: next.status };
    }
    case 'move': {
      const { m, side } = await load(admin, c, b.match_id);
      if (m.status !== 'active') throw new HttpError(409, 'This game isn’t being played');
      // A move made on an older position first: "moved on" tells the game to reload, whoever's turn it now is.
      if (b.move_no !== m.move_no) throw new HttpError(409, 'The game moved on. It has been reloaded.');
      if (m.turn !== side) throw new HttpError(403, 'It isn’t your turn');
      if (size(b.move) > LIMITS.move || size(b.state) > LIMITS.state || size(b.mine) > LIMITS.mine) throw new HttpError(400, 'The move is too large');
      const over = b.over as { winner?: unknown } | undefined | null;
      if (over != null && (typeof over !== 'object' || (over.winner !== 'a' && over.winner !== 'b' && over.winner !== null))) throw new HttpError(400, 'over must be { winner: "a" | "b" | null }');
      const { turns, title } = await turnsOf(admin, m.game_key, m.version);
      const now = new Date();
      const next = await update(admin, m, { status: 'active', turn: side, move_no: m.move_no }, {
        move_no: m.move_no + 1, turn: other(side), state: b.state ?? null, last_move: b.move ?? null, last_activity_at: now.toISOString(),
        turn_ends_at: m.way === 'live' && !over ? new Date(now.getTime() + turns.turnSeconds * 1000).toISOString() : null,
        ...(over ? { status: 'finished', winner: over.winner ?? null, finished_at: now.toISOString() } : {}),
      });
      await admin.from('match_moves').insert({ match_id: m.id, move_no: m.move_no, side, move: b.move ?? null });
      if (b.mine !== undefined) await admin.from('match_private').upsert({ match_id: m.id, side, state: b.mine ?? null });
      if (m.way === 'async' && !over) await notify(admin, playerOf(m, other(side)), 'turn', nameOf(m, side), title, m.id, turns.notify);
      return { move_no: next.move_no };
    }
    case 'pass': {
      const { m, side } = await load(admin, c, b.match_id);
      if (m.way !== 'live' || m.status !== 'active' || m.turn === side) throw new HttpError(409, 'There is no turn to pass');
      if (!m.turn_ends_at || new Date(m.turn_ends_at).getTime() > Date.now()) throw new HttpError(409, 'The turn’s time isn’t up yet');
      const { turns } = await turnsOf(admin, m.game_key, m.version);
      // A passed turn isn't activity: a game one player left still ends at the game admin's limit.
      const next = await update(admin, m, { status: 'active', turn: m.turn, move_no: m.move_no }, {
        turn: side, move_no: m.move_no + 1, turn_ends_at: new Date(Date.now() + turns.turnSeconds * 1000).toISOString(),
      });
      return { turn: next.turn };
    }
    case 'get': {
      const { m, side } = await load(admin, c, b.match_id);
      const [{ data: version }, { data: mine }] = await Promise.all([
        admin.from('game_versions').select('content').eq('game_key', m.game_key).eq('version', m.version).maybeSingle(),
        admin.from('match_private').select('state').eq('match_id', m.id).eq('side', side).maybeSingle(),
      ]);
      return { match: m, you: side, mine: mine?.state ?? null, content: version?.content ?? null };
    }
    default:
      throw new HttpError(400, 'action must be invite, accept, decline, withdraw, ready, move, pass or get');
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  const admin = adminClient();
  try {
    const c = await caller(admin, req);
    const body = await req.json().catch(() => null) as Body | null;
    if (!body || typeof body !== 'object') throw new HttpError(400, 'Send a JSON body');
    return json(200, await handle(admin, c, body));
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    console.error(e);
    return json(500, { error: 'Unexpected error' });
  }
});
