// A game's content in the app: the shared model plus the checks the browser runs before saving.
export { EMPTY_CONTENT, FILE_NAMES, type AiRole, type BriefTurn, type FileName, type GameConcept, type GameContent, type GameFiles, type GameGoal, type TurnsConfig } from '../../supabase/functions/_shared/gameModel.ts';
export { PASSAGES, SOURCE_DOCUMENT, type Passage } from '../../supabase/functions/_shared/source.ts';
import type { GameContent } from '../../supabase/functions/_shared/gameModel.ts';

/** Under the database's 1 MB cap, with room to spare. */
export const MAX_CONTENT_BYTES = 900_000;

/** What would stop a save. */
export function contentProblems(c: GameContent): string[] {
  const p: string[] = [];
  if (new TextEncoder().encode(JSON.stringify(c)).length > MAX_CONTENT_BYTES) p.push('The game is too large to save');
  if (c.phase === 'ready' && !c.files?.['index.html']) p.push('The game has no code yet');
  if ((c.phase === 'code' || c.phase === 'ready') && !c.concept) p.push('The game has no approved design');
  return p;
}
