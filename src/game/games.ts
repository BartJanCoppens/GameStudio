import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { EMPTY_CONTENT, type GameContent } from './content';

// The games (see supabase/migrations/*_games.sql and *_generic_games.sql): each is built by the AI
// from a creator's answers, with its own content, look, runs and leaderboard.

/** A row of public.games, with whether players can play it and which live version they get. */
export interface GameMeta {
  key: string;
  title: string;
  description: string;
  created_by: string | null;
  created_at: string;
  /** null: never published. */
  liveVersion: number | null;
  /** Archived: hidden from players and can't be started; results stay. */
  archived_at: string | null;
  /** everyone, or only the groups and people its game admins listed. */
  access?: 'everyone' | 'restricted';
}

async function fetchGames(): Promise<GameMeta[]> {
  const [games, live] = await Promise.all([
    supabase.from('games').select('key, title, description, created_by, created_at, archived_at, access').order('created_at'),
    supabase.from('game_content').select('game_key, version').eq('stage', 'live'),
  ]);
  if (games.error) throw games.error;
  const versions = new Map((live.data ?? []).map(r => [r.game_key as string, r.version as number]));
  return (games.data ?? []).map(g => ({ ...g, liveVersion: versions.get(g.key) ?? null }) as GameMeta);
}

export function useGames() {
  const [games, setGames] = useState<GameMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apply = useCallback((p: Promise<GameMeta[]>, live: () => boolean = () => true) =>
    p.then(g => { if (live()) { setGames(g); setError(null); } }, e => { if (live()) { setError((e as Error).message); setGames(g => g ?? []); } }), []);
  const reload = useCallback(() => apply(fetchGames()), [apply]);
  useEffect(() => {
    let cancelled = false;
    void apply(fetchGames(), () => !cancelled);
    return () => { cancelled = true; };
  }, [apply]);
  return { games, error, reload };
}

/** Same rule as private.can_edit_game: its creator or a platform admin. */
export const canEditGame = (g: Pick<GameMeta, 'created_by'>, userId: string, permissions: Set<string>) =>
  permissions.has('games.create') && (g.created_by === userId || permissions.has('users.manage'));

/** "Escape the audit room" → "escape-the-audit-room-k3f9": readable, and unique without a lookup. */
export function gameKeyFor(title: string): string {
  const base = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'game';
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Adds the game and saves its first draft. It isn't playable until it is published. */
export async function createGame(title: string, description: string, content: GameContent = EMPTY_CONTENT): Promise<string> {
  const key = gameKeyFor(title);
  const { error } = await supabase.from('games').insert({ key, title, description });
  if (error) throw error;
  const { error: e } = await supabase.from('game_content').insert({ game_key: key, stage: 'draft', content });
  if (e) {
    await supabase.from('games').delete().eq('key', key);
    throw e;
  }
  return key;
}

/** Replaces the draft of a game the caller may edit. */
export async function saveDraftOf(key: string, content: GameContent): Promise<void> {
  const { data, error } = await supabase.from('game_content').update({ content }).eq('game_key', key).eq('stage', 'draft').select('stage');
  if (error) throw error;
  if (!data?.length) throw new Error('Only the game’s creator can save its draft');
}

export async function renameGame(key: string, title: string, description: string): Promise<void> {
  const { data, error } = await supabase.from('games').update({ title, description }).eq('key', key).select('key');
  if (error) throw error;
  if (!data?.length) throw new Error('Only the game’s creator can rename it');
}

/** Only games nobody can play yet. */
/** Archive (or restore): the game leaves players' libraries; its results stay. */
export async function archiveGame(key: string, archived: boolean): Promise<void> {
  const { data, error } = await supabase.from('games').update({ archived_at: archived ? new Date().toISOString() : null }).eq('key', key).select('key');
  if (error) throw error;
  if (!data?.length) throw new Error('Only the game’s creator or a platform admin can archive it');
}

/** For good: the game with its content, runs, leaderboard and checks. */
export async function deleteGame(key: string): Promise<void> {
  const { data, error } = await supabase.from('games').delete().eq('key', key).select('key');
  if (error) throw error;
  if (!data?.length) throw new Error('Only the game’s creator or a platform admin can delete it');
}
