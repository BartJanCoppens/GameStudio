import { useEffect, useRef, type RefObject } from 'react';
import { useSignedIn } from '../../auth/useAuth';
import { callFunction, supabase } from '../../lib/supabase';
import { PASSAGES, type GameContent } from '../content';
import { contribute, goalTotal } from '../goal';
import { finishRun, leaderboardOf, type RunRow } from '../runs';
import { firstNameInitial, parseBridgeRequest, type BridgeRequest } from './protocol';

export interface BridgeContext {
  gameKey: string;
  /** null: no run (a preview); the game can read but not score. */
  runId: string | null;
  test: boolean;
  content: GameContent;
  /** The frame left the page it was given and was stopped. */
  onLeft: () => void;
  /** The game called finish(); the score it submitted, if any. */
  onFinished: (score: number | null) => void;
}

async function leaderboard(gameKey: string) {
  const { data } = await supabase.from('game_runs').select('*').eq('game_key', gameKey).eq('test', false).not('finished_at', 'is', null).returns<RunRow[]>();
  return leaderboardOf(data ?? []).slice(0, 10).map(e => ({ rank: e.rank, name: firstNameInitial(e.name), score: e.score }));
}

/**
 * The platform side of the bridge: answers a game's requests, one by one, as the signed-in player.
 * Only messages from this frame's window that parse are handled; everything else is ignored.
 */
export function useBridgeHost(frame: RefObject<HTMLIFrameElement | null>, ctx: BridgeContext) {
  const { profile } = useSignedIn();
  const latest = useRef(ctx);
  useEffect(() => { latest.current = ctx; });
  const submitted = useRef<number | null>(null);

  useEffect(() => { submitted.current = null; }, [ctx.runId]);

  useEffect(() => {
    const respond = (res: { id: number; ok: true; value: unknown } | { id: number; ok: false; error: string }) => frame.current?.contentWindow?.postMessage({ source: 'gamestudio-host', ...res }, '*');

    async function handle(req: BridgeRequest): Promise<unknown> {
      const c = latest.current;
      const concept = c.content.concept;
      switch (req.type) {
        case 'ready': return true;
        case 'getData': return c.content.data ?? null;
        case 'getPlayer': return { name: firstNameInitial(profile.full_name || '') };
        case 'getSources': return PASSAGES.filter(p => concept?.sources.includes(p.id)).map(p => ({ id: p.id, heading: p.heading, loc: p.loc, text: p.text }));
        case 'getLeaderboard':
          if (!concept?.leaderboard) throw new Error('This game has no leaderboard');
          return leaderboard(c.gameKey);
        case 'getGoal':
          if (concept?.mode !== 'common_goal' || !concept.goal) throw new Error('This game has no common goal');
          return { ...concept.goal, total: await goalTotal(c.gameKey) };
        case 'contribute':
          if (concept?.mode !== 'common_goal') throw new Error('This game has no common goal');
          if (!c.runId || c.test) return { counted: false };
          await contribute(c.gameKey, c.runId, req.amount, req.note);
          return { counted: true };
        case 'submitScore':
          if (submitted.current !== null) throw new Error('The score was already submitted');
          submitted.current = req.score;
          if (c.runId) await finishRun(c.runId, req.score, req.details);
          return { saved: !!c.runId };
        case 'askAI':
          if (!concept?.aiRole) throw new Error('This game has no AI role');
          if (!c.runId) throw new Error('Start the game first');
          return callFunction('game-ai', { game_key: c.gameKey, run_id: c.runId, messages: req.messages, state: req.state });
        case 'finish':
          c.onFinished(submitted.current);
          return true;
      }
    }

    const onMessage = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const req = parseBridgeRequest(e.data);
      if (!req) return;
      handle(req).then(
        value => respond({ id: req.id, ok: true, value }),
        err => respond({ id: req.id, ok: false, error: err instanceof Error ? err.message : 'Something went wrong' }),
      );
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [frame, profile.full_name]);
}
