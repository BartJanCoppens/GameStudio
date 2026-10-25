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

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.location.origin;
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of open) if (c.url.startsWith(self.location.origin) && 'focus' in c) { await c.navigate(url).catch(() => null); return c.focus(); }
    return self.clients.openWindow(url);
  })());
});
