/*
 * Forge service worker. All paths are relative to the SW scope, so the app works
 * at the domain root or under a sub-path (e.g. GitHub Pages /GymApp/).
 * - Navigations: network-first, falling back to the cached app shell (works offline).
 * - Hashed build assets: cache-first (immutable).
 * - Everything else same-origin: stale-while-revalidate.
 * Bump VERSION to force old caches out.
 */
const VERSION = 'forge-v2';
const scoped = (p) => new URL(p, self.registration.scope).href;
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/apple-touch-icon.png', 'icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL.map(scoped)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !req.url.startsWith(self.registration.scope)) return;

  if (req.mode === 'navigate') {
    const shell = scoped('index.html');
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(shell, copy));
          return res;
        })
        .catch(() => caches.match(shell).then((r) => r || caches.match(scoped('./')))),
    );
    return;
  }

  if (url.href.startsWith(scoped('assets/'))) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});
