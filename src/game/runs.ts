import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/** A row of public.game_runs (see supabase/migrations/*_generic_games.sql). */
export interface RunRow {
  id: string;
  user_id: string;
  game_key: string;
  player_name: string;
  player_cohort: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  /** Higher is better; null until the game reports one. */
  score: number | null;
  details: unknown;
  /** A creator's play test: never on leaderboards or in goal totals. */
  test: boolean;
  /** The live version played; the draft's for a test. */
  content_version: number;
}

export async function startRun(gameKey: string, contentVersion: number, test: boolean): Promise<RunRow> {
  // The database fills in the player, their name and the start time.
  const { data, error } = await supabase.from('game_runs').insert({ game_key: gameKey, content_version: contentVersion, test }).select('*').single<RunRow>();
  if (error) throw error;
  return data;
}

export async function finishRun(runId: string, score: number, details: unknown): Promise<RunRow> {
  const { data, error } = await supabase
    .from('game_runs')
    // The server replaces the time with its own clock.
    .update({ finished_at: new Date().toISOString(), score, details })
    .eq('id', runId)
    .select('*')
    .single<RunRow>();
  if (error) throw error;
  return data;
}

/** Finished, non-test runs the signed-in user may see. */
const fetchFinished = (gameKey?: string) => {
  const q = supabase.from('game_runs').select('*').not('finished_at', 'is', null).eq('test', false);
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
  score: number;
  runs: number;
}

const better = (a: RunRow, b: RunRow) => (a.score ?? 0) > (b.score ?? 0) || ((a.score ?? 0) === (b.score ?? 0) && (a.duration_seconds ?? 0) < (b.duration_seconds ?? 0));

/** Each player's best run: highest score, then fastest. */
export function leaderboardOf(runs: RunRow[]): LeaderboardEntry[] {
  const best = new Map<string, { run: RunRow; count: number }>();
  for (const r of runs) {
    const cur = best.get(r.user_id);
    best.set(r.user_id, { run: !cur || better(r, cur.run) ? r : cur.run, count: (cur?.count ?? 0) + 1 });
  }
  return [...best.values()]
    .sort((a, b) => (better(a.run, b.run) ? -1 : better(b.run, a.run) ? 1 : 0))
    .map(({ run, count }, i) => ({ rank: i + 1, userId: run.user_id, name: run.player_name, cohort: run.player_cohort, score: run.score ?? 0, runs: count }));
}

export const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
