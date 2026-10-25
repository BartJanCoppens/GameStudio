// Notifications for turn-taking games: a phone notification (Web Push) and an email, as the game's creator chose
// and the player allows. Best effort: a failed notification never fails the action that caused it.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import { isPushEndpoint, notificationText, type NotificationKind } from './notifyText.ts';

const APP_URL = Deno.env.get('APP_URL') ?? 'https://game-studio-flame.vercel.app';
export const matchUrl = (matchId: string) => `${APP_URL}/#/match?id=${matchId}`;

// Loaded on first use: if the push library can't load, only phone notifications stop, never the match itself.
type WebPush = typeof import('npm:web-push@3.6.7').default;
let webpushReady: Promise<WebPush | null> | null = null;
function webpush(): Promise<WebPush | null> {
  webpushReady ??= (async () => {
    const pub = Deno.env.get('VAPID_PUBLIC_KEY'), priv = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!pub || !priv) { console.warn('push skipped: VAPID keys not set'); return null; }
    const lib = (await import('npm:web-push@3.6.7')).default;
    lib.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:gamestudio@example.com', pub, priv);
    return lib;
  })().catch(e => { console.error('push unavailable', e instanceof Error ? e.message : e); return null; });
  return webpushReady;
}

async function push(admin: SupabaseClient, userId: string, text: string, url: string) {
  const lib = await webpush();
  if (!lib) return;
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId);
  for (const s of subs ?? []) {
    if (!isPushEndpoint(s.endpoint)) continue;
    try {
      await lib.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: 'Game Studio', body: text, url }), { TTL: 86400 });
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // The device unsubscribed or the subscription expired: forget it.
      if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
      else console.error('push failed', status);
    }
  }
}

async function email(to: string, text: string, url: string) {
  const key = Deno.env.get('RESEND_API_KEY'), from = Deno.env.get('EMAIL_FROM');
  if (!key || !from) { console.warn('email skipped: RESEND_API_KEY or EMAIL_FROM not set'); return; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject: text, text: `${text}\n\nOpen it in Game Studio: ${url}` }),
  });
  if (!res.ok) console.error('email failed', res.status);
}

/** Tells one player about a match, through the channels the game uses and the player allows. */
export async function notify(admin: SupabaseClient, userId: string, kind: NotificationKind, from: string, game: string, matchId: string, channels: ('email' | 'push')[]) {
  try {
    const { data: p } = await admin.from('profiles').select('email, notify_email, notify_push, status').eq('id', userId).maybeSingle();
    if (!p || p.status !== 'active') return;
    const text = notificationText(kind, from, game), url = matchUrl(matchId);
    await Promise.all([
      channels.includes('push') && p.notify_push ? push(admin, userId, text, url) : null,
      channels.includes('email') && p.notify_email ? email(p.email, text, url) : null,
    ]);
  } catch (e) {
    console.error('notify failed', e instanceof Error ? e.message : e);
  }
}
