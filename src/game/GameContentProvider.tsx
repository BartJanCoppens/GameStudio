import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApp } from '../app/useApp';
import { useSignedIn } from '../auth/useAuth';
import { supabase } from '../lib/supabase';
import { DEFAULT_CONTENT, GAME, type GameContent } from './content';
import { DEMO_GAME_KEY, canEditGame, useGames, type GameMeta } from './games';
import { contentProblems } from './ops';
import { GameContentContext, type GameContentApi, type StoredContent } from './useGameContent';

interface Row {
  stage: 'draft' | 'live';
  content: GameContent;
  version: number;
  updated_at: string;
}

const BUILT_IN: StoredContent = { content: DEFAULT_CONTENT, version: 0, updatedAt: null };

/** Until the games list loads (and if the selected game disappears), the demo game. */
const DEMO_META: GameMeta = { key: DEMO_GAME_KEY, title: GAME.title, description: '', created_by: null, created_at: '', liveVersion: 0 };

/** A stored version that no longer passes the checks (it shouldn't happen) falls back to the built-in game. */
function fromRow(row: Row | undefined): StoredContent | null {
  if (!row) return null;
  if (contentProblems(row.content).length) {
    console.warn(`Stored ${row.stage} game failed its checks; using the built-in version`, contentProblems(row.content));
    return null;
  }
  return { content: row.content, version: row.version, updatedAt: row.updated_at };
}

async function fetchRows(gameKey: string): Promise<Row[]> {
  const { data, error } = await supabase.from('game_content').select('stage, content, version, updated_at').eq('game_key', gameKey).returns<Row[]>();
  if (error) throw error;
  return data ?? [];
}

/** The selected game (AppState.gameKey): its draft and live content, plus the list of games. */
export function GameContentProvider({ children }: { children: ReactNode }) {
  const { s, set } = useApp();
  const { profile, permissions } = useSignedIn();
  const { games, reload: reloadGames } = useGames();
  const gameKey = s.gameKey;
  const [loaded, setLoaded] = useState<{ key: string; rows: Row[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A game that was deleted (or a stale link) falls back to the demo game.
  useEffect(() => {
    if (games && !games.some(g => g.key === gameKey)) set({ gameKey: DEMO_GAME_KEY });
  }, [games, gameKey, set]);

  useEffect(() => {
    let cancelled = false;
    fetchRows(gameKey).then(
      r => { if (!cancelled) { setLoaded({ key: gameKey, rows: r }); setError(null); } },
      e => { if (!cancelled) { setError(e.message); setLoaded({ key: gameKey, rows: [] }); } },
    );
    return () => { cancelled = true; };
  }, [gameKey]);

  const rows = loaded?.key === gameKey ? loaded.rows : null;
  const reload = useCallback(async () => { setLoaded({ key: gameKey, rows: await fetchRows(gameKey) }); await reloadGames(); }, [gameKey, reloadGames]);

  const game = games?.find(g => g.key === gameKey) ?? DEMO_META;
  const canEdit = canEditGame(game, profile.id, permissions);
  const published = rows ? rows.some(r => r.stage === 'live') || gameKey === DEMO_GAME_KEY : game.liveVersion !== null;
  const live = useMemo(() => fromRow(rows?.find(r => r.stage === 'live')) ?? BUILT_IN, [rows]);
  // Until a creator saves, the draft starts as a copy of what is live.
  const draft = useMemo(() => (canEdit ? fromRow(rows?.find(r => r.stage === 'draft')) ?? { ...live, version: 0 } : null), [rows, canEdit, live]);

  const upsert = useCallback(async (stage: 'draft' | 'live', content: GameContent) => {
    const problems = contentProblems(content);
    if (problems.length) throw new Error(problems[0]);
    const exists = (rows ?? []).some(r => r.stage === stage);
    const { data, error: e } = exists
      ? await supabase.from('game_content').update({ content }).eq('game_key', gameKey).eq('stage', stage).select('stage')
      : await supabase.from('game_content').insert({ game_key: gameKey, stage, content }).select('stage');
    if (e) throw e;
    // Row level security skips refused writes without an error.
    if (!data?.length) throw new Error(stage === 'live' ? 'You need “Approve and publish a version” to publish' : 'Only the game’s creator can save its draft');
    await reload();
  }, [rows, gameKey, reload]);

  const api = useMemo<GameContentApi>(() => ({
    game,
    games: games ?? [],
    reloadGames,
    published,
    live,
    draft,
    loading: rows === null,
    error,
    saveDraft: content => upsert('draft', content),
    publish: async () => {
      if (!draft) throw new Error('Nothing to publish');
      await upsert('live', draft.content);
    },
  }), [game, games, reloadGames, published, live, draft, rows, error, upsert]);

  return <GameContentContext.Provider value={api}>{children}</GameContentContext.Provider>;
}
