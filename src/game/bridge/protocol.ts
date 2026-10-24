// The messages a game in the sealed-off frame may send the platform, and their limits.
// Anything that doesn't parse is ignored: a game can ask, never instruct.

export type BridgeRequest = { id: number } & (
  | { type: 'ready' }
  | { type: 'getData' }
  | { type: 'getPlayer' }
  | { type: 'getLeaderboard' }
  | { type: 'getGoal' }
  | { type: 'getSources' }
  | { type: 'finish' }
  | { type: 'submitScore'; score: number; details: unknown }
  | { type: 'contribute'; amount: number; note: string }
  | { type: 'askAI'; messages: { role: 'player' | 'ai'; text: string }[]; state: unknown }
);

export type BridgeResponse = { source: 'gamestudio-host'; id: number; ok: true; value: unknown } | { source: 'gamestudio-host'; id: number; ok: false; error: string };

export const LIMITS = { score: 1e9, amount: 1000, note: 140, messages: 20, messageChars: 1000, stateBytes: 4096, detailsBytes: 16384 };

const SIMPLE = ['ready', 'getData', 'getPlayer', 'getLeaderboard', 'getGoal', 'getSources', 'finish'] as const;

const jsonSize = (v: unknown) => { try { return JSON.stringify(v ?? null).length; } catch { return Infinity; } };

export function parseBridgeRequest(raw: unknown): BridgeRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m.source !== 'gamestudio' || typeof m.id !== 'number' || !Number.isInteger(m.id)) return null;
  const id = m.id;
  if ((SIMPLE as readonly unknown[]).includes(m.type)) return { id, type: m.type as (typeof SIMPLE)[number] };
  switch (m.type) {
    case 'submitScore':
      if (typeof m.score !== 'number' || !Number.isFinite(m.score) || Math.abs(m.score) >= LIMITS.score) return null;
      if (jsonSize(m.details) > LIMITS.detailsBytes) return null;
      return { id, type: 'submitScore', score: m.score, details: m.details ?? {} };
    case 'contribute':
      if (typeof m.amount !== 'number' || !Number.isFinite(m.amount) || m.amount <= 0 || m.amount > LIMITS.amount) return null;
      if (m.note !== undefined && (typeof m.note !== 'string' || m.note.length > LIMITS.note)) return null;
      return { id, type: 'contribute', amount: m.amount, note: (m.note as string | undefined) ?? '' };
    case 'askAI': {
      const msgs = m.messages;
      if (!Array.isArray(msgs) || !msgs.length || msgs.length > LIMITS.messages) return null;
      const ok = msgs.every(x => x && typeof x === 'object' && ((x as { role?: unknown }).role === 'player' || (x as { role?: unknown }).role === 'ai')
        && typeof (x as { text?: unknown }).text === 'string' && (x as { text: string }).text.length <= LIMITS.messageChars);
      if (!ok || jsonSize(m.state) > LIMITS.stateBytes) return null;
      return { id, type: 'askAI', messages: msgs.map(x => ({ role: x.role, text: x.text })), state: m.state ?? null };
    }
    default:
      return null;
  }
}

/** What a game may show of a person: "Bart Jan Coppens" → "Bart C.". */
export function firstNameInitial(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Player';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
