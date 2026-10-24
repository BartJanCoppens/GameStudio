// game-check: reviews a game's draft against the platform admin's house rules before it can be published.
//
// 1. Who: creators who may edit the game.
// 2. What: the static checks (code, concept, content) and then the model review (_shared/review.ts).
// 3. Where the result goes: game_checks, with a fingerprint of exactly the draft that was checked.
//    publish_game refuses any draft whose fingerprint has no passed check.
//
// Body: { game_key: string }
import type { GameContent } from '../_shared/gameModel.ts';
import { reviewGame } from '../_shared/review.ts';
import { CORS, HttpError, adminClient, caller, gameOf, json, requireEditable } from '../_shared/server.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  const admin = adminClient();
  try {
    const c = await caller(admin, req);
    const body = await req.json().catch(() => null) as { game_key?: unknown } | null;
    const game = await gameOf(admin, body?.game_key);
    requireEditable(c, game);

    // Content, secret and fingerprint come from one read, so the passed check belongs to exactly what was reviewed.
    const { data: rows } = await admin.rpc('draft_for_check', { p_game_key: game.key });
    const draft = (rows as { content: GameContent; ai: unknown; fingerprint: string }[] | null)?.[0];
    if (!draft) throw new HttpError(404, 'This game has no draft to check');

    const { passed, reasons } = await reviewGame(admin, c.id, game.key, draft.content, draft.ai);
    await admin.from('game_checks').insert({ game_key: game.key, fingerprint: draft.fingerprint, passed, reasons, checked_by: c.id });
    return json(200, { passed, reasons, fingerprint: draft.fingerprint });
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    console.error(e);
    return json(500, { error: 'Unexpected error' });
  }
});
