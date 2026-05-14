// Setnayan Sprint 0 service worker.
// Minimal shell — registers, caches the offline fallback, network-first for
// everything else. Real offline strategy lands with iteration 0031 (Day-of
// Guest Experience), which is the first feature that genuinely needs offline.

const CACHE_VERSION = 'setnayan-v1';
const SHELL_ASSETS = ['/', '/manifest.json', '/icon-192.svg', '/icon-512.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Iteration 0036 — event-day pre-load.
// Listen for PRELOAD_ASSETS messages from the page and fetch+stash each URL
// in the shell cache so it's available offline. This is a thin stub in
// Sprint 0: the full Workbox-backed handler with route-scoped expiration
// lands with the iteration 0010 caching foundation. Unknown message types
// are ignored — V1 only cares about PRELOAD_ASSETS.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type !== 'PRELOAD_ASSETS') return;
  const urls = Array.isArray(data.urls) ? data.urls.filter((u) => typeof u === 'string') : [];
  if (urls.length === 0) return;

  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(
        urls.map((url) =>
          fetch(url, { mode: 'no-cors' })
            .then((res) => {
              // `no-cors` responses are opaque but still cacheable. Skip
              // anything the browser flagged as a real failure.
              if (!res || (res.status >= 400 && res.type !== 'opaque')) return;
              return cache.put(url, res.clone());
            })
            .catch(() => {
              // Best-effort warm-up; ignore network errors for individual
              // URLs so one bad asset doesn't tank the whole preload.
            }),
        ),
      ),
    ),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache auth / API / Supabase traffic — auth state needs fresh reads.
  if (
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/health' ||
    url.host !== self.location.host
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Stash a clone of successful navigation/document responses so the
        // shell still loads offline on a return visit.
        if (response.ok && (request.mode === 'navigate' || request.destination === 'document')) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? caches.match('/'))),
  );
});
