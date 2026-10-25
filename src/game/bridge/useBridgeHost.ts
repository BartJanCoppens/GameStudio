import { useEffect, useRef, type RefObject } from 'react';
import { useSignedIn } from '../../auth/useAuth';
import { callFunction, errorMessage, supabase } from '../../lib/supabase';
import { PASSAGES, type GameContent } from '../content';
import { contribute, goalTotal } from '../goal';
import { finishRun, leaderboardOf, type RunRow } from '../runs';
import { limitedQueue } from './limiter';
import { firstNameInitial, parseBridgeRequest, type BridgeRequest, type MakeMove, type MatchView } from './protocol';
import { standInMatch } from './standInMatch';

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
  /** Saving the score failed (the game went offline, for instance): the player is told, and stays on the game. */
  onScoreFailed: (message: string) => void;
  /** A real turn-taking match (the match screen). Without one, a turn-taking game gets a stand-in kept in memory. */
  match?: { view: MatchView; move: (m: MakeMove) => Promise<void> };
  /** The stand-in's view changed (test plays show whose side is being played). */
  onStandIn?: (view: MatchView) => void;
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
  const scoreFailed = useRef(false);
  // Contributions go one at a time, at most 50 per run (the database enforces the same).
  const contributions = useRef(limitedQueue(50));

  // Test plays of a turn-taking game: one person plays both sides, in memory.
  const standIn = useRef(standInMatch());

  useEffect(() => { submitted.current = null; scoreFailed.current = false; contributions.current = limitedQueue(50); standIn.current = standInMatch(); }, [ctx.runId]);

  // The other player moved (or the turn passed): the game hears it.
  const matchView = ctx.match?.view;
  useEffect(() => {
    if (matchView) frame.current?.contentWindow?.postMessage({ source: 'gamestudio-host', event: 'match', value: matchView }, '*');
  }, [frame, matchView]);

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
          await contributions.current(() => contribute(c.gameKey, c.runId!, req.amount, req.note));
          return { counted: true };
        case 'submitScore':
          if (submitted.current !== null) throw new Error('The score was already submitted');
          if (c.runId) {
            try { await finishRun(c.runId, req.score, req.details); } catch (e) {
              scoreFailed.current = true;
              c.onScoreFailed(errorMessage(e));
              throw e;
            }
          }
          submitted.current = req.score;
          return { saved: !!c.runId };
        case 'askAI':
          if (!concept?.aiRole) throw new Error('This game has no AI role');
          if (!c.runId) throw new Error('Start the game first');
          return callFunction('game-ai', { game_key: c.gameKey, run_id: c.runId, messages: req.messages, state: req.state });
        case 'getMatch':
          if (concept?.mode !== 'turns') throw new Error('This isn’t a turn-taking game');
          return c.match ? c.match.view : standIn.current.view();
        case 'makeMove': {
          if (concept?.mode !== 'turns') throw new Error('This isn’t a turn-taking game');
          const move = { move: req.move, state: req.state, mine: req.mine, over: req.over, moveNo: req.moveNo };
          if (c.match) {
            if (req.moveNo == null) throw new Error('The game hasn’t seen the match yet: call getMatch() first');
            await c.match.move(move);
            return true;
          }
          const view = standIn.current.move(move);
          c.onStandIn?.(view);
          frame.current?.contentWindow?.postMessage({ source: 'gamestudio-host', event: 'match', value: view }, '*');
          return true;
        }
        case 'finish':
          // After a failed save the player stays where the message is, not on results without this game.
          if (!scoreFailed.current) c.onFinished(submitted.current);
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
