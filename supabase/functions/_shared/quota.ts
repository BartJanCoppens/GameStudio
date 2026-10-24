// AI usage limits. Every AI call made for a user goes through takeQuota first and finishQuota after.
//
// Creators (Studio chat and design AI) are limited by a platform admin; players (AI a game uses while
// it's played) per game by a game admin. A user's own limit goes before the audience default, which
// goes before the built-in default.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import { HttpError } from './server.ts';
import type { Usage } from './llm.ts';

export type Kind = 'studio' | 'design' | 'game';
const BUILT_IN = { perHour: 120, perDay: 400 };

interface Limit {
  calls_per_day: number | null;
  spend_per_month_usd: number | null;
}

async function limitFor(admin: SupabaseClient, kind: Kind, userId: string, gameKey: string | null): Promise<Limit> {
  const audience = kind === 'game' ? 'players' : 'creators';
  let q = admin.from('usage_limits').select('user_id, calls_per_day, spend_per_month_usd').eq('audience', audience).or(`user_id.is.null,user_id.eq.${userId}`);
  q = audience === 'players' ? q.eq('game_key', gameKey) : q.is('game_key', null);
  const { data } = await q;
  const own = data?.find(r => r.user_id === userId);
  const fallback = data?.find(r => r.user_id === null);
  return {
    calls_per_day: own?.calls_per_day ?? fallback?.calls_per_day ?? BUILT_IN.perDay,
    spend_per_month_usd: own?.spend_per_month_usd ?? fallback?.spend_per_month_usd ?? null,
  };
}

/**
 * Records the call first, then counts, so parallel requests can't all slip under the cap: each one counts
 * itself. A call over a limit removes its own record and is refused. Returns the record's id.
 */
export async function takeQuota(admin: SupabaseClient, userId: string, kind: Kind, gameKey: string | null): Promise<number> {
  const { data: call, error } = await admin.from('studio_ai_calls').insert({ user_id: userId, kind, game_key: gameKey, status: 'pending' }).select('id').single();
  if (error || !call) throw new HttpError(500, 'Could not record the call');
  const limit = await limitFor(admin, kind, userId, gameKey);
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const forUser = () => {
    const q = admin.from('studio_ai_calls').select('id', { count: 'exact', head: true }).eq('user_id', userId);
    // Creators share one budget across Studio and design AI; players' budget is per game.
    return kind === 'game' ? q.eq('kind', 'game').eq('game_key', gameKey) : q.in('kind', ['studio', 'design']);
  };
  const spendQ = admin.from('studio_ai_calls').select('cost_usd').eq('user_id', userId).gte('created_at', monthStart);
  const [hour, day, spend] = await Promise.all([
    forUser().gte('created_at', since(3600_000)),
    forUser().gte('created_at', since(86_400_000)),
    kind === 'game' ? spendQ.eq('kind', 'game').eq('game_key', gameKey) : spendQ.in('kind', ['studio', 'design']),
  ]);
  const spent = (spend.data ?? []).reduce((a, r) => a + Number(r.cost_usd ?? 0), 0);
  const over =
    (hour.count ?? 0) > BUILT_IN.perHour ? `You’ve used the AI ${BUILT_IN.perHour} times this hour. Try again later.`
    : limit.calls_per_day != null && (day.count ?? 0) > limit.calls_per_day ? `You’ve reached your limit of ${limit.calls_per_day} AI calls a day. Try again tomorrow, or ask an admin to raise it.`
    : limit.spend_per_month_usd != null && spent >= limit.spend_per_month_usd ? `You’ve used your AI budget for this month (about $${spent.toFixed(2)} of $${Number(limit.spend_per_month_usd).toFixed(2)}). Ask an admin to raise it.`
    : null;
  if (over) {
    await admin.from('studio_ai_calls').delete().eq('id', call.id);
    throw new HttpError(429, over);
  }
  return call.id;
}

export async function finishQuota(admin: SupabaseClient, callId: number, status: string, usage?: Usage) {
  await admin.from('studio_ai_calls').update({
    status,
    ...(usage ? { model: usage.model, input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, cost_usd: usage.costUsd } : {}),
  }).eq('id', callId);
}
