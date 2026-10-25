import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameContent, GameFiles } from '../content';
import { useGameContent } from '../useGameContent';
import { streamFunction } from './sse';
import { MAX_PARTS, joinContinuation } from '../../../supabase/functions/_shared/continuation.ts';
import { jsSyntaxProblem } from './syntax';

export type StepId = 'data' | 'screens' | 'logic';
export type StepStatus = 'waiting' | 'running' | 'done' | 'failed';

export interface BuildStep {
  id: StepId;
  label: string;
  status: StepStatus;
  /** When it started (ms) and how long it took (s), for the timers. */
  started: number;
  seconds: number;
  error?: string;
  /** Shown under the label while it runs, e.g. which part of a long file is being written. */
  note?: string;
}

const STEPS: { id: StepId; label: string }[] = [
  { id: 'data', label: 'Writing the game’s content' },
  { id: 'screens', label: 'Building the screens' },
  { id: 'logic', label: 'Writing the game logic' },
];

interface Partial_ {
  data?: unknown;
  notes?: string;
  html?: string;
  js?: string;
}

/**
 * The Code phase: content and screens are written side by side, then the logic. Each step streams its text
 * so the creator watches it appear. Only a complete build is saved; a failed step keeps what came before and
 * offers Retry for that step (and the logic after it).
 */
export function useBuilder() {
  const { game, draft, saveDraft } = useGameContent();
  const [steps, setSteps] = useState<BuildStep[]>(() => STEPS.map(s => ({ ...s, status: 'waiting', started: 0, seconds: 0 })));
  const [live, setLive] = useState<{ step: StepId | 'change'; text: string } | null>(null);
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const parts = useRef<Partial_>({});
  const started = useRef<string | null>(null);
  /** Steps in flight: a retry joins a running step instead of starting it again. */
  const inflight = useRef<Partial<Record<StepId, Promise<boolean>>>>({});

  const patch = (id: StepId, p: Partial<BuildStep>) => setSteps(s => s.map(x => (x.id === id ? { ...x, ...p } : x)));

  const runStep = useCallback(async (id: StepId, content: GameContent): Promise<boolean> => {
    const t0 = Date.now();
    patch(id, { status: 'running', started: t0, error: undefined, note: undefined });
    let text = '';
    try {
      const p = parts.current;
      // A long file comes in parts: each answer that reaches its length limit is continued by the next call.
      let soFar = '';
      let result: Record<string, unknown>;
      for (let part = 1; ; part++) {
        result = await streamFunction('game-builder', {
          game_key: game!.key, step: id, concept: content.concept,
          ...(id === 'logic' ? { notes: p.notes ?? '', files: { 'index.html': p.html } } : {}),
          ...(soFar ? { so_far: soFar, part } : {}),
        }, d => { text += d; setLive({ step: id, text }); }) as Record<string, unknown>;
        if (!result.partial) break;
        if (part >= MAX_PARTS) throw new Error('The file is too long even in several parts. Ask for a simpler game.');
        soFar = joinContinuation(soFar, String(result.text ?? ''));
        patch(id, { note: `Long file · writing part ${part + 1}` });
      }
      if (id === 'data') { p.data = result.data; p.notes = String(result.notes ?? ''); }
      if (id === 'screens') p.html = String(result.content);
      if (id === 'logic') {
        // A file that doesn't even parse never becomes the game.
        const problem = jsSyntaxProblem(String(result.content));
        if (problem) throw new Error(problem);
        p.js = String(result.content);
      }
      patch(id, { status: 'done', seconds: Math.round((Date.now() - t0) / 1000), note: undefined });
      return true;
    } catch (e) {
      patch(id, { status: 'failed', seconds: Math.round((Date.now() - t0) / 1000), error: e instanceof Error ? e.message : 'The step failed' });
      return false;
    }
  }, [game]);

  const once = useCallback((id: StepId, content: GameContent) => {
    const running = inflight.current[id];
    if (running) return running;
    const started_ = runStep(id, content).finally(() => { delete inflight.current[id]; });
    inflight.current[id] = started_;
    return started_;
  }, [runStep]);

  /** Runs whatever isn't done yet; saves the game once every step has succeeded. */
  const build = useCallback(async () => {
    const content = draft!.content;
    const p = parts.current;
    const first = await Promise.all([
      p.data === undefined ? once('data', content) : Promise.resolve(true),
      p.html === undefined ? once('screens', content) : Promise.resolve(true),
    ]);
    if (!first.every(Boolean)) return;
    if (p.js === undefined && !(await once('logic', content))) return;
    const files: GameFiles = { 'index.html': p.html!, 'game.js': p.js! };
    await saveDraft({ ...content, files, data: p.data ?? null, dataNotes: p.notes ?? '', phase: 'ready' });
    setLive(null);
  }, [draft, once, saveDraft]);

  /** Retry a failed step: it and the logic (which depends on both) run again. */
  const retry = useCallback((id: StepId) => {
    const p = parts.current;
    if (id === 'data') { p.data = undefined; p.notes = undefined; }
    if (id === 'screens') p.html = undefined;
    p.js = undefined;
    setSteps(s => s.map(x => (x.id === id || x.id === 'logic' ? { ...x, status: 'waiting', error: undefined } : x)));
    void build();
  }, [build]);

  /** A change request after the build: the AI returns whole changed files, applied and saved together. */
  const change = useCallback(async (instruction: string): Promise<string> => {
    const content = draft!.content;
    setChanging(true);
    setChangeError(null);
    let text = '';
    try {
      const result = await streamFunction('game-builder', {
        game_key: game!.key, step: 'change', concept: content.concept, files: content.files, data: content.data, instruction,
      }, d => { text += d; setLive({ step: 'change', text }); }) as { reply: string; files: GameFiles; data?: unknown };
      const broken = result.files?.['game.js'] !== undefined ? jsSyntaxProblem(result.files['game.js']) : null;
      if (broken) throw new Error(`${broken}. Nothing was changed; try asking again.`);
      const changedFiles = Object.keys(result.files ?? {}).length;
      const reply = result.reply || (changedFiles ? 'Changed.' : 'Nothing changed.');
      // The request and the answer join the conversation; the files and content change together.
      await saveDraft({
        ...content,
        brief: [...content.brief, { role: 'creator', text: instruction }, { role: 'ai', text: reply }],
        previous: { files: content.files, data: content.data },
        files: { ...content.files, ...result.files },
        ...(result.data !== undefined ? { data: result.data } : {}),
      });
      return reply;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'The change failed';
      setChangeError(msg);
      throw e;
    } finally {
      setChanging(false);
      setLive(null);
    }
  }, [draft, game, saveDraft]);

  // Approving the design starts the build by itself.
  const phase = draft?.content.phase;
  useEffect(() => {
    if (phase !== 'code' || !game || started.current === game.key) return;
    started.current = game.key;
    void build();
  }, [phase, game, build]);

  /** Back to the files and content before the last change. */
  const undo = useCallback(async () => {
    const content = draft!.content;
    if (!content.previous) return;
    await saveDraft({ ...content, files: content.previous.files, data: content.previous.data, previous: null, brief: [...content.brief, { role: 'ai', text: 'Undid the last change.' }] });
  }, [draft, saveDraft]);

  return { steps, live, build, retry, change, undo, changing, changeError };
}
