import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSignedIn } from '../auth/useAuth';
import { supabase } from '../lib/supabase';
import { DEFAULT_CONTENT, GAME, type GameContent } from './content';
import { contentProblems } from './ops';
import { GameContentContext, type GameContentApi, type StoredContent } from './useGameContent';

interface Row {
  stage: 'draft' | 'live';
  content: GameContent;
  version: number;
  updated_at: string;
}

const BUILT_IN: StoredContent = { content: DEFAULT_CONTENT, version: 0, updatedAt: null };

/** A stored version that no longer passes the checks (it shouldn't happen) falls back to the built-in game. */
function fromRow(row: Row | undefined): StoredContent | null {
  if (!row) return null;
  if (contentProblems(row.content).length) {
    console.warn(`Stored ${row.stage} game failed its checks; using the built-in version`, contentProblems(row.content));
    return null;
  }
  return { content: row.content, version: row.version, updatedAt: row.updated_at };
}

async function fetchRows(): Promise<Row[]> {
  const { data, error } = await supabase.from('game_content').select('stage, content, version, updated_at').eq('game_key', GAME.key).returns<Row[]>();
  if (error) throw error;
  return data ?? [];
}

export function GameContentProvider({ children }: { children: ReactNode }) {
  const { permissions } = useSignedIn();
  const canCreate = permissions.has('games.create');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRows().then(r => { if (!cancelled) setRows(r); }, e => { if (!cancelled) { setError(e.message); setRows([]); } });
    return () => { cancelled = true; };
  }, []);

  const reload = useCallback(async () => setRows(await fetchRows()), []);

  const live = useMemo(() => fromRow(rows?.find(r => r.stage === 'live')) ?? BUILT_IN, [rows]);
  // Until a creator saves, the draft starts as a copy of what is live.
  const draft = useMemo(() => (canCreate ? fromRow(rows?.find(r => r.stage === 'draft')) ?? { ...live, version: 0 } : null), [rows, canCreate, live]);

  const upsert = useCallback(async (stage: 'draft' | 'live', content: GameContent) => {
    const problems = contentProblems(content);
    if (problems.length) throw new Error(problems[0]);
    const exists = (rows ?? []).some(r => r.stage === stage);
    const { data, error: e } = exists
      ? await supabase.from('game_content').update({ content }).eq('game_key', GAME.key).eq('stage', stage).select('stage')
      : await supabase.from('game_content').insert({ game_key: GAME.key, stage, content }).select('stage');
    if (e) throw e;
    // Row level security skips refused writes without an error.
    if (!data?.length) throw new Error(stage === 'live' ? 'You need “Approve and publish a version” to publish' : 'You need “Create a game in the Studio” to save');
    await reload();
  }, [rows, reload]);

  const api = useMemo<GameContentApi>(() => ({
    live,
    draft,
    loading: rows === null,
    error,
    saveDraft: content => upsert('draft', content),
    publish: async () => {
      if (!draft) throw new Error('Nothing to publish');
      await upsert('live', draft.content);
    },
  }), [live, draft, rows, error, upsert]);

  return <GameContentContext.Provider value={api}>{children}</GameContentContext.Provider>;
}
