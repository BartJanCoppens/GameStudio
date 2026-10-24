import { useCallback, useEffect, useRef, useState } from 'react';
import { callFunction, errorMessage } from '../../lib/supabase';
import type { BriefTurn, GameConcept, GameContent } from '../content';
import { renameGame } from '../games';
import { useGameContent } from '../useGameContent';

type Answer =
  | { kind: 'question'; question: { text: string; choices: string[]; multi: boolean } }
  | { kind: 'ready' }
  | { kind: 'declined'; reply: string }
  | { kind: 'concept'; reply: string; concept: GameConcept; mockup_html: string };

/**
 * The Questions and Design phases: the AI interviews the creator, proposes a concept with a mock-up, and
 * revises it on request. Every turn is saved to the draft, so a reload picks up where the creator was.
 */
export function useArchitect() {
  const { game, draft, saveDraft, reloadGames } = useGameContent();
  const [busy, setBusy] = useState<null | 'asking' | 'designing'>(null);
  const [since, setSince] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const asked = useRef<string | null>(null);
  /** The AI step that failed, to run again as is (the creator's message is already saved). */
  const failed = useRef<(() => Promise<void>) | null>(null);

  const call = useCallback((c: GameContent, mode: 'ask' | 'propose' | 'revise', request = '') =>
    callFunction<Answer>('game-architect', { game_key: game!.key, brief: c.brief.map(t => ({ role: t.role, text: t.text })), concept: c.concept, request, mode }), [game]);

  const withTurn = (c: GameContent, turn: BriefTurn): GameContent => ({ ...c, brief: [...c.brief, turn] });

  const run = useCallback(async (kind: 'asking' | 'designing', work: () => Promise<void>, again: () => Promise<void> = work) => {
    setBusy(kind);
    setSince(Date.now());
    setError(null);
    failed.current = null;
    try { await work(); } catch (e) { failed.current = again; setError(errorMessage(e)); } finally { setBusy(null); }
  }, []);

  const propose = useCallback(async (c: GameContent) => {
    setBusy('designing');
    setSince(Date.now());
    const a = await call(c, 'propose');
    if (a.kind === 'concept') await saveDraft({ ...withTurn(c, { role: 'ai', text: a.reply }), concept: a.concept, mockup: a.mockup_html, phase: 'design' });
    else if (a.kind === 'declined') await saveDraft(withTurn(c, { role: 'ai', text: a.reply, declined: true }));
  }, [call, saveDraft]);

  const ask = useCallback(async (c: GameContent) => {
    const a = await call(c, 'ask');
    if (a.kind === 'question') await saveDraft(withTurn(c, { role: 'ai', text: a.question.text, choices: a.question.choices, multi: a.question.multi }));
    else if (a.kind === 'declined') await saveDraft(withTurn(c, { role: 'ai', text: a.reply, declined: true }));
    else await propose(c);
  }, [call, saveDraft, propose]);

  /** A creator message: an answer in the Questions phase, a change request in the Design phase. */
  const send = useCallback((text: string) => {
    const c = draft!.content;
    const next = withTurn(c, { role: 'creator', text });
    // What follows the saved message; Try again repeats only this part.
    const answer = async () => {
      if (c.phase === 'questions') await ask(next);
      else if (c.phase === 'design') {
        setBusy('designing');
        const a = await call(next, 'revise', text);
        if (a.kind === 'concept') await saveDraft({ ...withTurn(next, { role: 'ai', text: a.reply }), concept: a.concept, mockup: a.mockup_html });
        else if (a.kind === 'declined') await saveDraft(withTurn(next, { role: 'ai', text: a.reply, declined: true }));
      }
    };
    return run('asking', async () => { await saveDraft(next); await answer(); }, answer);
  }, [draft, saveDraft, ask, call, run]);

  const proposeNow = useCallback(() => run('designing', () => propose(draft!.content)), [draft, propose, run]);

  /** The look the creator picked, replacing the AI's. */
  const setLook = useCallback(async (look: GameConcept['look']) => {
    const c = draft!.content;
    await saveDraft({ ...c, concept: { ...c.concept!, look } });
  }, [draft, saveDraft]);

  const approveDesign = useCallback(() => run('designing', async () => {
    const c = draft!.content;
    await saveDraft({ ...c, phase: 'code' });
    await renameGame(game!.key, c.concept!.title, c.concept!.pitch.slice(0, 300));
    await reloadGames();
  }), [draft, game, saveDraft, reloadGames, run]);

  // A new game opens with the creator's idea as the only turn: the first question follows by itself.
  const content = draft?.content;
  const last = content?.brief[content.brief.length - 1];
  const key = game && content ? `${game.key}:${content.brief.length}` : null;
  useEffect(() => {
    if (!content || !key || content.phase !== 'questions' || last?.role !== 'creator' || busy || error || asked.current === key) return;
    asked.current = key;
    void run('asking', () => ask(content));
  }, [content, key, last, busy, error, ask, run]);

  const retry = useCallback(() => {
    const again = failed.current;
    if (again) void run('designing', again);
    else { setError(null); asked.current = null; }
  }, [run]);

  return { busy, since, error, send, proposeNow, approveDesign, setLook, retry };
}
