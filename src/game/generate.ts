import { callFunction, supabase } from '../lib/supabase';
import type { GameContent } from './content';
import { applyOperations, contentProblems, type Operation } from './ops';

// Building a whole game from a creator's description: the Studio assistant (studio-chat) gets an empty
// draft and a request for the full set, and the browser checks the result like any other AI edit.

/** What studio-chat answers. */
export interface ChatAnswer {
  status: 'changes' | 'answer' | 'out_of_scope';
  reply: string;
  operations: Operation[];
  chat_id: string;
  message_id: number | null;
  model: string;
}

export const GAME_SIZES = [6, 8, 10] as const;
export type GameSize = (typeof GAME_SIZES)[number];
export const DESCRIPTION_MAX = 600;

const EMPTY: GameContent = { invoices: [], errors: [] };

/** Roughly half the invoices carry an error, so "no errors" stays a real answer. */
export const errorsFor = (invoices: GameSize) => Math.round(invoices / 2);

export function generationRequest(title: string, description: string, invoices: GameSize): string {
  return [
    'Build this game from scratch; the current draft is empty.',
    `Title: ${title}`,
    `What the creator wants: ${description}`,
    `Make ${invoices} invoices numbered 1 to ${invoices} and plant ${errorsFor(invoices)} errors, each on a different invoice and using different rules; leave the other invoices correct.`,
    'Use upsert_invoice for every invoice and upsert_error for every error.',
  ].join('\n');
}

export interface Generated {
  content: GameContent;
  chatId: string;
  request: string;
  reply: string;
  changes: string[];
}

/** One call, about a minute. Throws when the model declines or the result fails the game's checks. */
export async function generateGame(gameKey: string, title: string, description: string, invoices: GameSize): Promise<Generated> {
  const request = generationRequest(title, description.slice(0, DESCRIPTION_MAX), invoices);
  const answer = await callFunction<ChatAnswer>('studio-chat', { game_key: gameKey, chat_id: null, message: request, draft: EMPTY });
  if (answer.status !== 'changes') throw new Error(answer.reply || 'The AI didn’t build a game from that description.');
  const applied = applyOperations(EMPTY, answer.operations);
  if (answer.message_id) await supabase.from('studio_chat_messages').update({ changes: applied.changes, skipped: applied.skipped }).eq('id', answer.message_id);
  const problems = contentProblems(applied.content);
  if (problems.length) throw new Error(`The AI’s game didn’t pass the checks (${problems[0]}).`);
  if (applied.content.invoices.length < 3) throw new Error('The AI made too few invoices. Try a more specific description.');
  return { content: applied.content, chatId: answer.chat_id, request, reply: answer.reply, changes: applied.changes };
}
