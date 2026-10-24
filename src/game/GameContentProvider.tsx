import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../app/useApp';
import { useSignedIn } from '../auth/useAuth';
import { supabase } from '../lib/supabase';
import { EMPTY_CONTENT, contentProblems, type GameContent } from './content';
import { canEditGame, useGames } from './games';
import { GameContentContext, type GameContentApi, type StoredContent } from './useGameContent';

interface Row {
  stage: 'draft' | 'live';
  content: GameContent;
  version: number;
  updated_at: string;
  data_revision: number;
  base_revision: number;
}

const fromRow = (row: Row | undefined): StoredContent | null =>
  row ? { content: { ...EMPTY_CONTENT, ...row.content }, version: row.version, updatedAt: row.updated_at } : null;

async function fetchRows(gameKey: string): Promise<Row[]> {
  const { data, error } = await supabase.from('game_content').select('stage, content, version, updated_at, data_revision, base_revision').eq('game_key', gameKey).returns<Row[]>();
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

  // A game not in the list may be new (a link to it, or made in another tab): reload the list once before
  // falling back to the first game.
  const refreshedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!games || games.some(g => g.key === gameKey)) return;
    if (gameKey && refreshedFor.current !== gameKey) { refreshedFor.current = gameKey; void reloadGames(); return; }
    if (games[0]) set({ gameKey: games[0].key });
  }, [games, gameKey, set, reloadGames]);

  useEffect(() => {
    if (!gameKey) return;
    let cancelled = false;
    fetchRows(gameKey).then(
      r => { if (!cancelled) { setLoaded({ key: gameKey, rows: r }); setError(null); } },
      e => { if (!cancelled) { setError(e.message); setLoaded({ key: gameKey, rows: [] }); } },
    );
    return () => { cancelled = true; };
  }, [gameKey]);

  const rows = loaded?.key === gameKey ? loaded.rows : null;
  // The draft version this tab last loaded or saved. A tab's own saves follow each other quickly (the creator's
  // message, then the AI's answer), before the reload: this keeps them from refusing each other.
  const draftVersion = useRef<{ key: string; version: number } | null>(null);
  useEffect(() => {
    const row = rows?.find(r => r.stage === 'draft');
    draftVersion.current = row ? { key: gameKey, version: row.version } : null;
  }, [rows, gameKey]);
  const reload = useCallback(async () => { setLoaded({ key: gameKey, rows: await fetchRows(gameKey) }); await reloadGames(); }, [gameKey, reloadGames]);

  const game = games?.find(g => g.key === gameKey) ?? null;
  const canEdit = game ? canEditGame(game, profile.id, permissions) : false;
  const live = useMemo(() => fromRow(rows?.find(r => r.stage === 'live')), [rows]);
  // No draft until the rows are loaded: an empty stand-in would let the Studio act on (and save over) the wrong content.
  const draft = useMemo(() => (canEdit && rows ? fromRow(rows.find(r => r.stage === 'draft')) ?? { content: EMPTY_CONTENT, version: 0, updatedAt: null } : null), [rows, canEdit]);

  const saveDraft = useCallback(async (content: GameContent) => {
    const problems = contentProblems(content);
    if (problems.length) throw new Error(problems[0]);
    const current = draftVersion.current?.key === gameKey ? draftVersion.current.version : null;
    // Only over the draft this tab has: a game admin's addition may have changed it since.
    const { data, error: e } = current !== null
      ? await supabase.from('game_content').update({ content }).eq('game_key', gameKey).eq('stage', 'draft').eq('version', current).select('version')
      : await supabase.from('game_content').insert({ game_key: gameKey, stage: 'draft', content }).select('version');
    if (e) throw e;
    if (!data?.length) {
      // Row level security skips refused writes without an error, as does a draft that moved on.
      const fresh = await fetchRows(gameKey);
      const moved = current !== null && fresh.find(r => r.stage === 'draft')?.version !== current;
      await reload();
      throw new Error(moved ? 'The draft changed in the meantime (perhaps a game admin added content). It has been reloaded; try again.' : 'Only the game’s creator can save its draft');
    }
    draftVersion.current = { key: gameKey, version: data[0].version as number };
    await reload();
  }, [gameKey, reload]);

  // A game admin added content to the live game after the draft was based on it.
  const liveRow = rows?.find(r => r.stage === 'live');
  const draftRow = rows?.find(r => r.stage === 'draft');
  const draftBehind = !!liveRow && !!draftRow && draftRow.base_revision < liveRow.data_revision;

  const takeInLive = useCallback(async () => {
    const { error: e } = await supabase.rpc('take_in_live', { p_game_key: gameKey });
    if (e) throw e;
    await reload();
  }, [gameKey, reload]);

  const publish = useCallback(async () => {
    const { error: e } = await supabase.rpc('publish_game', { p_game_key: gameKey });
    if (e) throw e;
    await reload();
  }, [gameKey, reload]);

  const api = useMemo<GameContentApi>(() => ({
    game,
    games: games ?? [],
    reloadGames,
    reloadContent: reload,
    draftBehind,
    takeInLive,
    published: live !== null,
    live,
    draft,
    loading: rows === null && !!gameKey,
    error,
    saveDraft,
    publish,
  }), [game, games, reloadGames, reload, draftBehind, takeInLive, live, draft, rows, gameKey, error, saveDraft, publish]);

  return <GameContentContext.Provider value={api}>{children}</GameContentContext.Provider>;
}
