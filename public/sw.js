// Game Studio's service worker: shows phone notifications for turn-taking games and opens the game on a tap.
// Nothing is cached.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = typeof data.title === 'string' ? data.title : 'Game Studio';
  const body = typeof data.body === 'string' ? data.body.slice(0, 200) : 'Something happened in one of your games';
  const url = typeof data.url === 'string' && data.url.startsWith(self.location.origin) ? data.url : self.location.origin;
  event.waitUntil(self.registration.showNotification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', data: { url } }));
});

// Take charge of open pages right away, so a tap on a notification can send them to the game.
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.location.origin;
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of open) {
      if (!c.url.startsWith(self.location.origin) || !('navigate' in c)) continue;
      // A page this worker doesn't control can't be sent elsewhere: open the game in a new one instead.
      const moved = await c.navigate(url).then(() => true, () => false);
      if (moved) return c.focus();
    }
    return self.clients.openWindow(url);
  })());
});
