// What a notification says: who did what in which game, never anything of the game's content.

export type NotificationKind = 'turn' | 'invite' | 'accepted' | 'declined';

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Names and titles without anything that reads as a link (a notification must not carry one but ours). */
const plain = (s: string) => s.replace(/\b(?:https?|ftp):\/\/\S*/gi, '').replace(/\bwww\.\S*/gi, '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();

export function notificationText(kind: NotificationKind, from: string, game: string): string {
  const f = short(plain(from) || 'A colleague', 60), g = short(plain(game) || 'a game', 80);
  switch (kind) {
    case 'turn': return `${f} made a move in ${g} · your turn`;
    case 'invite': return `${f} invites you to play ${g}`;
    case 'accepted': return `${f} accepted your invitation · ${g} has started`;
    case 'declined': return `${f} declined your invitation to ${g}`;
  }
}

/** The browsers' push services; a device subscription pointing anywhere else is refused (no requests to other hosts). */
export const PUSH_HOSTS = /^(fcm\.googleapis\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.push\.services\.mozilla\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.notify\.windows\.com|web\.push\.apple\.com)$/;

export function isPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.port && PUSH_HOSTS.test(u.hostname);
  } catch { return false; }
}
