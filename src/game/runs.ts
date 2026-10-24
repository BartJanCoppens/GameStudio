import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { InvoiceAnswer, RunScore } from './scoring';

/** A row of public.game_runs (see supabase/migrations/*_game_runs.sql). */
export interface RunRow {
  id: string;
  user_id: string;
  player_name: string;
  player_cohort: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  invoices_correct: number | null;
  errors_found: number | null;
  false_flags: number | null;
  points: number | null;
  answers: InvoiceAnswer[];
  game_key: string;
  /** The live version played; 0 = the built-in game. */
  content_version: number;
}

export async function startRun(gameKey: string, contentVersion: number): Promise<RunRow> {
  // The database fills in the player, their name and the start time.
  const { data, error } = await supabase.from('game_runs').insert({ game_key: gameKey, content_version: contentVersion }).select('*').single<RunRow>();
  if (error) throw error;
  return data;
}

export async function saveAnswers(runId: string, answers: InvoiceAnswer[]): Promise<void> {
  const { error } = await supabase.from('game_runs').update({ answers }).eq('id', runId);
  if (error) throw error;
}

export async function finishRun(runId: string, answers: InvoiceAnswer[], score: RunScore): Promise<RunRow> {
  const { data, error } = await supabase
    .from('game_runs')
    .update({
      answers,
      // The server replaces this with its own clock.
      finished_at: new Date().toISOString(),
      invoices_correct: score.invoicesCorrect,
      errors_found: score.errorsFound,
      false_flags: score.falseFlags,
      points: score.points,
    })
    .eq('id', runId)
    .select('*')
    .single<RunRow>();
  if (error) throw error;
  return data;
}

/** Finished runs the signed-in user may see (their own always; everyone's with play or results permission). */
const fetchFinished = (gameKey?: string) => {
  const q = supabase.from('game_runs').select('*').not('finished_at', 'is', null);
  return (gameKey ? q.eq('game_key', gameKey) : q).order('finished_at', { ascending: false }).returns<RunRow[]>();
};

/** One game's finished runs, or every game's without a key. */
export function useFinishedRuns(gameKey?: string) {
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const { data, error: e } = await fetchFinished(gameKey);
    setError(e ? e.message : null);
    if (!e) setRuns(data ?? []);
  }, [gameKey]);
  useEffect(() => {
    let cancelled = false;
    fetchFinished(gameKey).then(({ data, error: e }) => {
      if (cancelled) return;
      setError(e ? e.message : null);
      if (!e) setRuns(data ?? []);
    });
    return () => { cancelled = true; };
  }, [gameKey]);
  return { runs, error, reload };
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  cohort: string;
  points: number;
  invoicesCorrect: number;
  runs: number;
}

/** Each player's best run: most points, then most invoices right, then fastest. */
export function leaderboardOf(runs: RunRow[]): LeaderboardEntry[] {
  const best = new Map<string, { run: RunRow; count: number }>();
  for (const r of runs) {
    const cur = best.get(r.user_id);
    const better = !cur
      || (r.points ?? 0) > (cur.run.points ?? 0)
      || ((r.points ?? 0) === (cur.run.points ?? 0) && (r.invoices_correct ?? 0) > (cur.run.invoices_correct ?? 0))
      || ((r.points ?? 0) === (cur.run.points ?? 0) && (r.invoices_correct ?? 0) === (cur.run.invoices_correct ?? 0) && (r.duration_seconds ?? 0) < (cur.run.duration_seconds ?? 0));
    best.set(r.user_id, { run: better ? r : cur!.run, count: (cur?.count ?? 0) + 1 });
  }
  return [...best.values()]
    .sort((a, b) => (b.run.points ?? 0) - (a.run.points ?? 0) || (b.run.invoices_correct ?? 0) - (a.run.invoices_correct ?? 0) || (a.run.duration_seconds ?? 0) - (b.run.duration_seconds ?? 0))
    .map(({ run, count }, i) => ({ rank: i + 1, userId: run.user_id, name: run.player_name, cohort: run.player_cohort, points: run.points ?? 0, invoicesCorrect: run.invoices_correct ?? 0, runs: count }));
}

export const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
