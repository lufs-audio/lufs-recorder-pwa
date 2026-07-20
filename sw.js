/* lufs-recorder (browser) — service worker
 * App-shell caching so the recorder installs and runs offline after first load.
 * The recorder itself is fully client-side; the SW only serves static assets.
 * BUMP CACHE on every release so clients pick up new logic (verified by scripts/verify).
 */
const CACHE = 'lufs-rec-v0.3.0';
const SHELL = [
  './',
  './index.html',
  './404.html',
  './manifest.webmanifest',
  './icons/icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Navigations: serve the app shell, fall back to network, then offline shell.
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then((cached) => cached || fetch(req).catch(() => caches.match('./index.html')))
    );
    return;
  }

  // Static assets: cache-first, populate on miss.
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => cached))
  );
});
