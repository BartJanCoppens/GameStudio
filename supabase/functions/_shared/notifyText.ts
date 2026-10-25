// What a notification says: who did what in which game, never anything of the game's content.

export type NotificationKind = 'turn' | 'invite' | 'accepted' | 'declined';

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function notificationText(kind: NotificationKind, from: string, game: string): string {
  const f = short(from, 60), g = short(game, 80);
  switch (kind) {
    case 'turn': return `${f} made a move in ${g} · your turn`;
    case 'invite': return `${f} invites you to play ${g}`;
    case 'accepted': return `${f} accepted your invitation · ${g} has started`;
    case 'declined': return `${f} declined your invitation to ${g}`;
  }
}
