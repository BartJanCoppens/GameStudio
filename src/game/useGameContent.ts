import { createContext, useContext } from 'react';
import type { GameContent } from './content';

export interface StoredContent {
  content: GameContent;
  /** 0 = the built-in version, never saved. */
  version: number;
  updatedAt: string | null;
}

export interface GameContentApi {
  /** What players play. */
  live: StoredContent;
  /** What the Studio edits; null for users without "Create a game in the Studio". */
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
