import { createContext, useContext } from 'react';
import type { GameContent } from './content';
import type { GameMeta } from './games';

export interface StoredContent {
  content: GameContent;
  /** 0 = the built-in version, never saved. */
  version: number;
  updatedAt: string | null;
}

export interface GameContentApi {
  /** The selected game (AppState.gameKey). */
  game: GameMeta;
  /** Every game, oldest first. */
  games: GameMeta[];
  reloadGames: () => Promise<void>;
  /** Players can play it: it has a live version (the demo game always does). */
  published: boolean;
  /** What players play; the built-in demo content while the game has never been published. */
  live: StoredContent;
  /** What the Studio edits; null for users who may not edit this game. */
  draft: StoredContent | null;
  loading: boolean;
  error: string | null;
  saveDraft: (content: GameContent) => Promise<void>;
  /** Copies the draft to live (needs "Approve and publish a version"). */
  publish: () => Promise<void>;
}

export const GameContentContext = createContext<GameContentApi | null>(null);

export function useGameContent(): GameContentApi {
  const ctx = useContext(GameContentContext);
  if (!ctx) throw new Error('useGameContent must be used inside <GameContentProvider>');
  return ctx;
}

/** The live game, for player screens and results. */
export const useLiveGame = () => useGameContent().live.content;
