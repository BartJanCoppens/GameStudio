// What an AI-built game is: shared by the app and the Edge Functions. Plain TypeScript, no imports
// beyond the shared design and source modules, so Deno and Vite both load it.
import type { DesignTokens } from './design.ts';

/** One turn of the Questions phase: the AI's question (with its choices) or the creator's answer. */
export interface BriefTurn {
  role: 'ai' | 'creator';
  text: string;
  choices?: string[];
}

export interface AiRole {
  kind: 'game_master' | 'opponent';
  /** Plain-language role, e.g. "a tough but fair tax inspector". */
  description: string;
  /** Moves an opponent may make; the game applies them. Empty for a game master. */
  actions: string[];
}

export interface GameGoal {
  description: string;
  target: number;
  unit: string;
}

export interface GameConcept {
  title: string;
  pitch: string;
  howToPlay: string[];
  winCondition: string;
  scoring: string;
  mode: 'solo' | 'common_goal';
  /** Present when mode is common_goal. */
  goal: GameGoal | null;
  leaderboard: boolean;
  aiRole: AiRole | null;
  /** Ids of the source passages the game rests on (PASSAGES). */
  sources: string[];
  look: { name: string; tokens: DesignTokens };
}

export const FILE_NAMES = ['index.html', 'game.js', 'style.css'] as const;
export type FileName = (typeof FILE_NAMES)[number];
export type GameFiles = Partial<Record<FileName, string>>;

/** A game's draft or live content. The AI role's hidden knowledge is stored apart (game_secrets). */
export interface GameContent {
  phase: 'questions' | 'design' | 'code' | 'ready';
  brief: BriefTurn[];
  concept: GameConcept | null;
  /** Static HTML of the main screen, shown in the Design phase. */
  mockup: string | null;
  files: GameFiles | null;
  /** The game's own content (levels, questions, cases, story set-up), read by the game through the bridge. */
  data: unknown;
}

export const EMPTY_CONTENT: GameContent = { phase: 'questions', brief: [], concept: null, mockup: null, files: null, data: null };
