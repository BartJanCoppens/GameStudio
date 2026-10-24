import { createContext, useContext } from 'react';
import type { GameContent } from './content';
import type { GameMeta } from './games';

export interface StoredContent {
  content: GameContent;
  version: number;
  updatedAt: string | null;
}

export interface GameContentApi {
  /** The selected game (AppState.gameKey); null while there are no games. */
  game: GameMeta | null;
  /** Every game the user can see, oldest first. */
  games: GameMeta[];
  reloadGames: () => Promise<void>;
  /** Fetch the selected game's draft and live content again. */
  reloadContent: () => Promise<void>;
  /** Players can play it: it has a live version. */
  published: boolean;
  /** What players play; null until the game is published. */
  live: StoredContent | null;
  /** What the Studio edits; null for users who may not edit this game. */
  draft: StoredContent | null;
  loading: boolean;
  error: string | null;
  saveDraft: (content: GameContent) => Promise<void>;
  /** Publishes the draft (needs "Approve and publish a version" and a passed house-rules check). */
  publish: () => Promise<void>;
}

export const GameContentContext = createContext<GameContentApi | null>(null);

export function useGameContent(): GameContentApi {
  const ctx = useContext(GameContentContext);
  if (!ctx) throw new Error('useGameContent must be used inside <GameContentProvider>');
  return ctx;
}
