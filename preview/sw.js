self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', () => {});
// Avisos enviados pelo servidor (preview/server/push.mjs): { title, body, href, tag }.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Etnias', {
    body: data.body || '', tag: data.tag || undefined, renotify: !!data.tag, data: { href: data.href || '/' },
    icon: '/assets/opy/icon-192.png', badge: '/assets/opy/icon-192.png'
  }));
});
// Tocar no aviso abre (ou traz para a frente) a página certa.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = new URL((event.notification.data && event.notification.data.href) || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => 'focus' in c);
    if (open) return open.navigate(href).then((c) => c && c.focus());
    return self.clients.openWindow(href);
  }));
});
