import { supabase } from '../lib/supabase';

// Phone notifications for turn-taking games (Web Push). The service worker (public/sw.js) only shows them.

export interface PushSub { endpoint: string; keys: { p256dh: string; auth: string } }

/** What the browser offers; replaced in tests. */
export interface PushEnv {
  supported: boolean;
  /** iPhone or iPad: push works only once Game Studio is on the home screen. */
  ios: boolean;
  installed: boolean;
  requestPermission: () => Promise<NotificationPermission>;
  subscribe: (publicKey: string) => Promise<PushSub>;
  save: (sub: PushSub) => Promise<void>;
}

export type PushResult = 'on' | 'denied' | 'unsupported' | 'needs-install';

export const VAPID_PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

/** Turns on notifications for this device and remembers it, so the platform can reach it. */
export async function enablePush(env: PushEnv = browserPush(), publicKey: string = VAPID_PUBLIC_KEY): Promise<PushResult> {
  if (env.ios && !env.installed) return 'needs-install';
  if (!env.supported || !publicKey) return 'unsupported';
  if (await env.requestPermission() !== 'granted') return 'denied';
  await env.save(await env.subscribe(publicKey));
  return 'on';
}

/** Turns them off for this device. */
export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

function urlBase64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function browserPush(): PushEnv {
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    supported: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
    ios: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    installed: window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true,
    requestPermission: () => Notification.requestPermission(),
    subscribe: async publicKey => {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(publicKey) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      return { endpoint: json.endpoint, keys: json.keys };
    },
    save: async sub => {
      // One row per device: replace whatever this endpoint had.
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      const { error } = await supabase.from('push_subscriptions').insert({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth });
      if (error) throw error;
    },
  };
}
