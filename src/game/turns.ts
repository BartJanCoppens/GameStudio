import type { GameConcept } from './content';

/** "Turn-taking · live (60 s a turn) or turn by turn · notified by phone and email". */
export function turnsLabel(t: NonNullable<GameConcept['turns']>): string {
  const ways = t.ways.map(w => (w === 'live' ? `live (${t.turnSeconds} s a turn)` : 'turn by turn')).join(' or ');
  const notify = t.notify.map(n => (n === 'push' ? 'phone' : 'email')).join(' and ');
  return `Turn-taking · ${ways} · notified by ${notify}`;
}

/** "3 days", "00:10:00" or "2 days 00:05:00" (Postgres intervals as the API returns them) → seconds. */
export function intervalSeconds(v: string): number {
  const days = Number(/(\d+) days?/.exec(v)?.[1] ?? 0);
  const t = /(\d+):(\d+):(\d+)/.exec(v);
  return days * 86400 + (t ? Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3]) : 0);
}
