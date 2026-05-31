// Setnayan service worker — route-scoped Workbox-equivalent semantics.
//
// Implements the asset layer half of the Caching & Offline Strategy spec
// (02_Specifications/Caching_and_Offline_Strategy.md § 3.2). Hand-rolled on
// the raw Cache + Fetch APIs; no Workbox bundle.
//
// Caches (each with its own LRU + max-age expiration · suffixed by VERSION):
//   - setnayan-images-v2   CacheFirst        500 entries, 30-day max-age
//   - setnayan-static-v2   StaleWhileReval.  100 entries,  7-day max-age
//   - setnayan-fonts-v2    CacheFirst         20 entries,  1-year max-age
//
// Preserves the existing exclusions (/auth/, /api/, /health, cross-origin,
// non-GET) and the shell-cache navigation fallback so the app shell still
// loads offline on a return visit.
//
// Listens for `{ type: 'CACHE_BUST' }` postMessages to drop every cache —
// used by the schema-buster pattern when NEXT_PUBLIC_CACHE_BUSTER bumps.
//
// CACHE VERSION — bump this whenever a same-named static asset changes in
// place (logo, favicon, app icon, shell). Images are served CacheFirst from a
// long-lived cache, so without a version bump returning visitors keep serving
// the OLD asset off-device until the 30-day max-age lapses. Bumping VERSION
// renames every cache; the `activate` handler then deletes the prior-version
// caches (they fall out of KNOWN_CACHES) and the SW re-fetches fresh.
//   v1 -> v2: 2026-05-31 brand-logo + app-icon swap (gold S/Y monogram).

const VERSION = 'v2';
const SHELL_CACHE = `setnayan-${VERSION}`;
const IMAGE_CACHE = `setnayan-images-${VERSION}`;
const STATIC_CACHE = `setnayan-static-${VERSION}`;
const FONT_CACHE = `setnayan-fonts-${VERSION}`;

const KNOWN_CACHES = [SHELL_CACHE, IMAGE_CACHE, STATIC_CACHE, FONT_CACHE];

const SHELL_ASSETS = ['/', '/manifest.json', '/icon-192.svg', '/icon-512.svg'];

// LRU + max-age caps per asset class. Soft splits per spec § 2 — whichever
// layer fills first triggers eviction inside that layer, no cross-layer
// borrowing.
const EXPIRATION = {
  [IMAGE_CACHE]: {
    maxEntries: 500,
    maxAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  [STATIC_CACHE]: {
    maxEntries: 100,
    maxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  [FONT_CACHE]: {
    maxEntries: 20,
    maxAgeMs: 365 * 24 * 60 * 60 * 1000, // 1 year
  },
};

// LRU metadata lives in an in-memory map per-cache; the SW process is shared
// across tabs and lives for the lifetime of the registration, so this is
// "good enough" for ordering decisions. On a cold SW restart the LRU order
// resets to insertion order on first touch — acceptable per spec § 7
// (eviction reasoning stays local, not exact).
const lru = {
  [IMAGE_CACHE]: new Map(),
  [STATIC_CACHE]: new Map(),
  [FONT_CACHE]: new Map(),
};

function recordAccess(cacheName, url) {
  const map = lru[cacheName];
  if (!map) return;
  map.delete(url);
  map.set(url, Date.now());
}

async function enforceLimits(cacheName) {
  const config = EXPIRATION[cacheName];
  if (!config) return;
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  const map = lru[cacheName];
  const now = Date.now();

  // Age-based eviction first.
  for (const request of requests) {
    const last = map.get(request.url) ?? now;
    if (now - last > config.maxAgeMs) {
      await cache.delete(request);
      map.delete(request.url);
    }
  }

  // Then LRU-based eviction down to the cap.
  const remaining = await cache.keys();
  if (remaining.length <= config.maxEntries) return;

  const ordered = remaining
    .map((request) => ({ request, ts: map.get(request.url) ?? 0 }))
    .sort((a, b) => a.ts - b.ts);

  const overflow = ordered.length - config.maxEntries;
  for (let i = 0; i < overflow; i += 1) {
    const victim = ordered[i].request;
    await cache.delete(victim);
    map.delete(victim.url);
  }
}

function cacheNameFor(request) {
  if (request.destination === 'image') return IMAGE_CACHE;
  if (request.destination === 'font') return FONT_CACHE;
  if (request.destination === 'script' || request.destination === 'style') {
    return STATIC_CACHE;
  }
  return null;
}

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    recordAccess(cacheName, request.url);
    return cached;
  }
  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone()).then(() => {
      recordAccess(cacheName, request.url);
      return enforceLimits(cacheName);
    });
  }
  return response;
}

async function staleWhileRevalidate(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).then(() => {
          recordAccess(cacheName, request.url);
          return enforceLimits(cacheName);
        });
      }
      return response;
    })
    .catch(() => cached);

  if (cached) {
    recordAccess(cacheName, request.url);
    return cached;
  }
  return networkPromise;
}

async function clearAllCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
  for (const name of Object.keys(lru)) {
    lru[name].clear();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !KNOWN_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'CACHE_BUST') {
    event.waitUntil(clearAllCaches());
    return;
  }

  // Iteration 0036 — event-day pre-load. Page sends a list of image URLs
  // (guest avatars, mood-board thumbnails, save-the-date previews) to warm
  // into IMAGE_CACHE so the dashboard renders offline on event day. Plays
  // nice with the route-scoped LRU + max-age expiration in IMAGE_CACHE.
  if (data.type === 'PRELOAD_ASSETS') {
    const urls = Array.isArray(data.urls)
      ? data.urls.filter((u) => typeof u === 'string')
      : [];
    if (urls.length === 0) return;

    event.waitUntil(
      (async () => {
        const cache = await caches.open(IMAGE_CACHE);
        await Promise.all(
          urls.map(async (url) => {
            try {
              const res = await fetch(url, { mode: 'no-cors' });
              // `no-cors` responses are opaque but still cacheable. Skip
              // anything the browser flagged as a real failure.
              if (!res || (res.status >= 400 && res.type !== 'opaque')) return;
              await cache.put(url, res.clone());
              recordAccess(IMAGE_CACHE, url);
            } catch {
              // Best-effort warm-up; ignore network errors for individual
              // URLs so one bad asset doesn't tank the whole preload.
            }
          }),
        );
        await enforceLimits(IMAGE_CACHE);
      })(),
    );
  }
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

  const routedCache = cacheNameFor(request);

  if (routedCache === IMAGE_CACHE || routedCache === FONT_CACHE) {
    event.respondWith(cacheFirst(routedCache, request));
    return;
  }

  if (routedCache === STATIC_CACHE) {
    event.respondWith(staleWhileRevalidate(routedCache, request));
    return;
  }

  // Fallback: network with shell-cache offline support for navigations.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (
          response.ok &&
          (request.mode === 'navigate' || request.destination === 'document')
        ) {
          const clone = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached ?? caches.match('/')),
      ),
  );
});
