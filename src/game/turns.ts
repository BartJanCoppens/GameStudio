import type { GameConcept } from './content';

/** "Turn-taking · live (60 s a turn) or turn by turn · notified by phone and email". */
export function turnsLabel(t: NonNullable<GameConcept['turns']>): string {
  const ways = t.ways.map(w => (w === 'live' ? `live (${t.turnSeconds} s a turn)` : 'turn by turn')).join(' or ');
  const notify = t.notify.map(n => (n === 'push' ? 'phone' : 'email')).join(' and ');
  return `Turn-taking · ${ways} · notified by ${notify}`;
}
