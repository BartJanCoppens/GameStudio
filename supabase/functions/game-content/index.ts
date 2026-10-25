// game-content: a game admin publishes content added to a live game (more levels, questions, cases).
//
// 1. Who: the game's own game admin (holding "Add content to a live game", live.edit), or a platform admin.
// 2. What is checked: the new content keeps the game's content shape (nothing dropped, same types, no list
//    shorter), then the full game with the new content gets the house-rules review: static checks and the model.
// 3. Where it goes: on a pass, publish_live_content writes the new live content, its check and an untouched
//    draft in one transaction. The AI role's hidden knowledge stays as it is.
//
// Body: { game_key: string, data: unknown, based_on_version?: number } (the live version the additions were written for)
import { dataShapeProblems, sameData, type GameContent } from '../_shared/gameModel.ts';
import { reviewGame } from '../_shared/review.ts';
import { CORS, HttpError, adminClient, caller, gameOf, json, requireGameAdmin } from '../_shared/server.ts';

const MAX_DATA_CHARS = 120_000;

async function fingerprint(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return 'sha256:' + [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  const admin = adminClient();
  try {
    const c = await caller(admin, req);
    const body = await req.json().catch(() => null) as { game_key?: unknown; data?: unknown; based_on_version?: unknown } | null;
    const game = await gameOf(admin, body?.game_key);
    requireGameAdmin(c, game);
    if (JSON.stringify(body?.data ?? null).length > MAX_DATA_CHARS) throw new HttpError(400, 'The content is too large');

    const { data: live } = await admin.from('game_content').select('content, version').eq('game_key', game.key).eq('stage', 'live').maybeSingle();
    if (!live) throw new HttpError(404, 'This game isn’t published');
    if (typeof body?.based_on_version === 'number' && body.based_on_version !== live.version) {
      throw new HttpError(409, 'The game changed since you generated these additions. Generate again.');
    }
    const current = live.content as GameContent;
    if (sameData(current.data, body?.data)) throw new HttpError(400, 'Nothing was added: the new content is the same as the live content');
    const shape = dataShapeProblems(current.data, body?.data);
    if (shape.length) throw new HttpError(400, `The new content would break the game: ${shape[0]}`);

    const { data: secretRow } = await admin.from('game_secrets').select('ai').eq('game_key', game.key).eq('stage', 'live').maybeSingle();
    const candidate: GameContent = { ...current, data: body!.data };
    const { passed, reasons } = await reviewGame(admin, c.id, game.key, candidate, secretRow?.ai ?? null);
    if (!passed) {
      await admin.from('game_checks').insert({ game_key: game.key, fingerprint: await fingerprint({ candidate, secret: secretRow?.ai ?? null }), passed: false, reasons, checked_by: c.id });
      return json(200, { passed, reasons });
    }
    const { data: version, error } = await admin.rpc('publish_live_content', {
      p_game_key: game.key, p_data: candidate.data, p_fingerprint: await fingerprint({ candidate, secret: secretRow?.ai ?? null }), p_checked_by: c.id,
      p_expected_version: live.version,
    });
    if (error) throw new HttpError(409, error.message);
    return json(200, { passed: true, reasons: [], version });
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    console.error(e);
    return json(500, { error: 'Unexpected error' });
  }
});
