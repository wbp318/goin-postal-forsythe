// Service worker for the staff pages only (/counter/...). When the shop's internet drops, the pages
// still open from the last copy this browser saw, and the page scripts keep working from their own
// cache (the queue) or an outbox (drop-off scans) until the connection is back. Nothing here touches
// customer pages or any API call: those always go to the network, and the pages decide what to do
// when they fail. Bump CACHE when the shape of a staff page changes.
const CACHE = 'petership-counter-v2';
const ASSETS = /\/_astro\//;

self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('petership-counter-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Built assets never change under one name: cache first.
  if (ASSETS.test(url.pathname)) {
    e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(req)) ?? fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); c.put(req, copy); } return res; })));
    return;
  }
  // Staff pages: network first, last good copy when the network fails, a plain note when there is none.
  if (req.mode === 'navigate' && url.pathname.startsWith('/counter/')) {
    // Clone before handing the response back: once the browser starts reading the body, a later clone throws.
    e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; }).catch(async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const shell = await caches.match('/counter/queue');
      if (shell) return shell;
      return new Response('<!doctype html><meta charset="utf-8"><title>Offline</title><body style="font-family:system-ui;padding:2rem;max-width:40rem"><h1>No connection</h1><p>The shop\'s internet is down and this page has not been opened on this device before, so there is no saved copy. Open the queue or the drop-off page once while online and it will work offline after that. Labels cannot be bought until the connection is back; the POS keeps selling.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 });
    }));
  }
});
