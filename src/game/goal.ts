import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Common-goal games: each player's contributions add up per game. Test runs can't contribute (the database refuses).

export async function contribute(gameKey: string, runId: string, amount: number, note: string): Promise<void> {
  const { error } = await supabase.from('game_contributions').insert({ game_key: gameKey, run_id: runId, amount, note });
  if (error) throw error;
}

export async function goalTotal(gameKey: string): Promise<number> {
  const { data, error } = await supabase.from('game_contributions').select('amount').eq('game_key', gameKey);
  if (error) throw error;
  return (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
}

export function useGoal(gameKey: string | undefined) {
  const [total, setTotal] = useState<number | null>(null);
  const reload = useCallback(async () => { if (gameKey) setTotal(await goalTotal(gameKey)); }, [gameKey]);
  useEffect(() => {
    if (!gameKey) return;
    let cancelled = false;
    goalTotal(gameKey).then(t => { if (!cancelled) setTotal(t); }, () => { if (!cancelled) setTotal(0); });
    return () => { cancelled = true; };
  }, [gameKey]);
  return { total, reload };
}
