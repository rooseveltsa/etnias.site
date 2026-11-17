// Etnias — service worker: esqueleto do app guardado para abrir sem internet (e mais rápido em rede lenta), página offline e leitura do que já foi
// visto. Dados privados (API e imagens da rede) ficam só neste aparelho, expiram em 7 dias e são apagados ao sair da conta.
const VERSION = 'v2';
const SHELL = `opy-shell-${VERSION}`, API = `opy-api-${VERSION}`, MEDIA = `opy-media-${VERSION}`;
const KEEP = [SHELL, API, MEDIA];
const MAX_AGE = 7 * 24 * 3600e3;
const PRIVATE_VIEWS = new Set(['admin', 'account', 'plans', 'chat', 'sessions', 'username_check']);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.add(new Request('/offline/', { cache: 'reload' }))).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((n) => n.startsWith('opy-') && !KEEP.includes(n)).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});
// Ao sair da conta (ou abrir a tela de entrada) a página manda apagar tudo o que é privado.
self.addEventListener('message', (event) => {
  if (event.data === 'clear-private') event.waitUntil(Promise.all([caches.delete(API), caches.delete(MEDIA)]));
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName); const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}
const stamped = (response) => { const h = new Headers(response.headers); h.set('x-opy-cached-at', String(Date.now())); return response.clone().blob().then((b) => new Response(b, { status: response.status, statusText: response.statusText, headers: h })); };
const fresh = (response) => response && Date.now() - Number(response.headers.get('x-opy-cached-at') || 0) < MAX_AGE;
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL); const hit = await cache.match(request);
  const update = fetch(request).then((response) => { if (response.ok) cache.put(request, response.clone()); return response; }).catch(() => null);
  return hit || (await update) || Response.error();
}
// Rede primeiro. Só desiste da rede (e usa a cópia guardada) se já houver cópia: sem cópia, espera a rede o quanto for preciso,
// para uma conexão lenta nunca virar "sem internet" por engano.
async function pageNetworkFirst(request) {
  const cache = await caches.open(SHELL); const hit = await cache.match(request);
  const net = fetch(request).then((response) => { if (response.ok && !response.redirected) cache.put(request, response.clone()); return response; });
  if (!hit) { try { return await net; } catch { return (await cache.match('/offline/')) || Response.error(); } }
  net.catch(() => {});
  try { return await withTimeout(net, 4000); } catch { return hit; }
}
async function apiNetworkFirst(request) {
  const cache = await caches.open(API); const hit = await cache.match(request);
  const net = fetch(request).then(async (response) => { if (response.status === 200 && !response.headers.has('set-cookie')) { cache.put(request, await stamped(response)); trim(API, 80); } return response; });
  const offline = () => new Response(JSON.stringify({ error: 'Você está sem internet. Confira a conexão e tente de novo.' }), { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  if (!fresh(hit)) { try { return await net; } catch { return offline(); } }
  net.catch(() => {});
  try { return await withTimeout(net, 6000); } catch { return hit; }
}
async function imageCacheFirst(request) {
  const cache = await caches.open(MEDIA); const hit = await cache.match(request);
  if (fresh(hit)) return hit;
  try {
    const response = await fetch(request);
    if (response.status === 200 && /^image\//.test(response.headers.get('content-type') || '')) { cache.put(request, await stamped(response)); trim(MEDIA, 150); }
    return response;
  } catch { return hit || Response.error(); }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  if (path.startsWith('/live/') || path === '/api/health' || path.startsWith('/.well-known/') || path.startsWith('/api/live') || path === '/sw.js') return;
  if (path.startsWith('/assets/') || path === '/manifest.webmanifest') { event.respondWith(staleWhileRevalidate(request)); return; }
  if (path === '/api/community') { if (!PRIVATE_VIEWS.has(url.searchParams.get('view') || '')) event.respondWith(apiNetworkFirst(request)); return; }
  if (path === '/api/media') { event.respondWith(imageCacheFirst(request)); return; }
  if (request.mode === 'navigate') event.respondWith(pageNetworkFirst(request));
});
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
