/* lufs-recorder (browser) — service worker
 * App-shell caching so the recorder installs and runs offline after first load.
 * The recorder itself is fully client-side; the SW only serves static assets.
 * BUMP CACHE on every release so clients pick up new logic (verified by scripts/verify).
 */
const CACHE = 'lufs-rec-v0.3.3';
// The canonical shell URL. Deliberately "./" and never "./index.html":
// hosts commonly 308 the latter to the former, and a redirected response
// cannot satisfy a navigation.
const SHELL_URL = "./";
const SHELL = [
  './',
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

// --- navigation handling -----------------------------------------------------
// Navigation requests use redirect mode "manual": the browser rejects any
// response whose .redirected is true as a network error (ERR_FAILED). Cloudflare
// Pages 308-redirects /index.html -> /, and a redirected response STAYS flagged
// even after being stored in the Cache API (w3c/ServiceWorker#737) — so both the
// network path and a naive cache hit produce one. Hence: precache "./" (a clean
// 200) and strip the flag defensively before responding.
async function cleanRedirect(res) {
  if (!res || !res.redirected) return res;
  const body = await res.clone().blob();
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

async function handleNavigation() {
  const cached = await caches.match(SHELL_URL);
  if (cached) return cleanRedirect(cached);
  try {
    return await cleanRedirect(await fetch(SHELL_URL));
  } catch (err) {
    const fallback = await caches.match(SHELL_URL);
    if (fallback) return cleanRedirect(fallback);
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Cross-origin requests (the analytics beacon) are none of the shell's business:
  // let the browser own them so nothing third-party lands in the cache and the
  // offline guarantee stays a statement about OUR bytes.
  if (!req.url.startsWith(self.location.origin)) return;

  if (req.mode === 'navigate') {
    e.respondWith(handleNavigation());
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
