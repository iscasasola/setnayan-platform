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
// CACHE VERSION — STAMPED PER DEPLOY (no more manual bumps). The build step
// `scripts/stamp-sw.mjs` rewrites the `const VERSION = '…'` line below to the
// deploy's VERCEL_GIT_COMMIT_SHA (wired into apps/web `package.json` "build").
// Because every deploy changes the sw.js bytes, the browser's own SW-update
// check — which re-fetches `/sw.js` (served `no-cache`, see next.config.ts) and
// byte-compares the script — installs the new worker. `install` calls
// skipWaiting() and `activate` deletes every cache NOT in KNOWN_CACHES +
// clients.claim(), so the prior deploy's shell/static/image caches are evicted
// and fresh assets land within one navigation. This kills the
// "returning users see the previous build's shell/JS for one load after a
// deploy" class of bug (the 2026-06-14 stale old-chrome shell was its last
// instance, then patched by a one-time v3→v4 bump).
//
// The literal below is the DEV / local fallback (a build with no
// VERCEL_GIT_COMMIT_SHA leaves it untouched) AND the human-readable
// version-history anchor. Keep the exact `const VERSION = '…';` shape — the
// stamp script's regex targets it and fails the build if it can't find it.
//   v1 -> v2: 2026-05-31 brand-logo + app-icon swap (gold S/Y monogram).
//   v2 -> v3: 2026-06-11 compliance/push-offline — Web Push handlers, a static
//             offline.html shell fallback, + a day-of guest SWR cache.
//   v3 -> v4: 2026-06-14 dashboard chrome retirement (legacy cream shell gone).
//   v4 -> per-deploy SHA: 2026-06-14 bytes now auto-stamp every build, so this
//             stale-after-deploy class of bug can't recur.

const VERSION = 'v4';
const SHELL_CACHE = `setnayan-${VERSION}`;
const IMAGE_CACHE = `setnayan-images-${VERSION}`;
const STATIC_CACHE = `setnayan-static-${VERSION}`;
const FONT_CACHE = `setnayan-fonts-${VERSION}`;
// Day-of guest data (the personal landing page + find-my-table). Served
// stale-while-revalidate so a guest at a venue with flaky signal still sees
// their schedule / table / floorplan from the last good fetch.
const DAYOF_CACHE = `setnayan-dayof-${VERSION}`;

const KNOWN_CACHES = [
  SHELL_CACHE,
  IMAGE_CACHE,
  STATIC_CACHE,
  FONT_CACHE,
  DAYOF_CACHE,
];

const SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  '/offline.html',
];

// A navigation to one of these path shapes is the day-of guest experience —
// cache it stale-while-revalidate in DAYOF_CACHE. `/[slug]` is the guest's
// personal landing page; `/[slug]/find-my-table` is the table/floorplan view.
// Dashboard + marketing routes are intentionally excluded (they stay on the
// network-first navigation fallback below).
function isDayOfGuestNavigation(url) {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length === 0) return false;
  const first = segments[0];
  // Exclude known top-level app sections so only the bare guest slug matches.
  const RESERVED = new Set([
    'dashboard',
    'vendor-dashboard',
    'admin',
    'login',
    'signup',
    'onboarding',
    'help',
    'blog',
    'recommendations',
    'pricing',
    'for-vendors',
    'auth',
    'api',
  ]);
  if (RESERVED.has(first)) return false;
  if (segments.length === 1) return true; // /[slug]
  if (segments.length === 2 && segments[1] === 'find-my-table') return true;
  return false;
}

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
  [DAYOF_CACHE]: {
    maxEntries: 50, // a handful of guests' landing pages per device
    maxAgeMs: 2 * 24 * 60 * 60 * 1000, // 2 days — the event-day window
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
  [DAYOF_CACHE]: new Map(),
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

  // Day-of guest navigation (the personal landing page + find-my-table):
  // stale-while-revalidate so the schedule / table / floorplan render instantly
  // and survive a venue with weak signal, while still refreshing in the
  // background when the network is reachable.
  const isNavigation =
    request.mode === 'navigate' || request.destination === 'document';
  if (isNavigation && isDayOfGuestNavigation(url)) {
    event.respondWith(
      staleWhileRevalidate(DAYOF_CACHE, request).then(
        (res) =>
          res ?? caches.match(request).then((c) => c ?? caches.match('/offline.html')),
      ),
    );
    return;
  }

  // Fallback: network with shell-cache offline support for navigations. On a
  // hard offline miss, serve the static offline.html fallback (added v3) before
  // falling back to the cached shell root.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && isNavigation) {
          const clone = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) =>
            cached ??
            (isNavigation
              ? caches.match('/offline.html').then((o) => o ?? caches.match('/'))
              : caches.match('/')),
        ),
      ),
  );
});

// ---------------------------------------------------------------------------
// Web Push (compliance/push-offline — Apple guideline 4.2). The server's
// /api/notify route fires a JSON payload { title, body, data: { thread_id,
// type } } when a couple sends the vendor a message. We render it as a
// notification and route clicks into the vendor messages thread.
//
// Payload shape (from /api/notify → sendWebPush):
//   { title: string, body: string, data: { thread_id?: string, type?: string } }
//
// Best-effort and defensive: a malformed payload shows a generic Setnayan
// notification rather than throwing inside the push event.
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  /** @type {{ title?: string, body?: string, data?: Record<string,string> }} */
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Setnayan', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Setnayan';
  const data = (payload.data && typeof payload.data === 'object') ? payload.data : {};
  const options = {
    body: payload.body || '',
    // Use the existing SVG icon at the public root (icon-192.svg).
    // Chromium supports SVG notification icons; Safari ignores the icon field.
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    // Collapse per-thread: one notification per open conversation, not per message.
    tag: data.thread_id || 'setnayan-vendor',
    // Carry the structured data so notificationclick can route correctly.
    data,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  // Route vendor message notifications to the thread; fall back to the vendor
  // dashboard root for any other notification type.
  const target = data.thread_id
    ? `/vendor-dashboard/messages?thread=${encodeURIComponent(data.thread_id)}`
    : '/vendor-dashboard';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab if one is already open, else open a new one.
        for (const client of clientList) {
          if ('focus' in client) {
            client.navigate(target).catch(() => {});
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
        return undefined;
      }),
  );
});

// ---------------------------------------------------------------------------
// Background Sync stub (bonus) — flush queued day-of guestbook submissions
// once connectivity returns. The page enqueues entries in IndexedDB and
// registers a 'guestbook-sync' sync; here we replay them. This is a
// best-effort stub: the IndexedDB queue + POST endpoint are owned by the
// page/feature code, so we no-op gracefully when neither exists yet.
// ---------------------------------------------------------------------------
self.addEventListener('sync', (event) => {
  if (event.tag === 'guestbook-sync') {
    event.waitUntil(flushGuestbookQueue());
  }
});

async function flushGuestbookQueue() {
  try {
    // The guestbook feature stores pending entries under this IndexedDB store.
    // If the DB/store isn't present, openGuestbookDb resolves null and we exit.
    const db = await openGuestbookDb();
    if (!db) return;
    const entries = await idbGetAll(db, 'pending');
    for (const entry of entries) {
      try {
        const res = await fetch('/api/guestbook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry.payload),
        });
        if (res.ok) await idbDelete(db, 'pending', entry.id);
      } catch {
        // Leave it queued; the next sync attempt retries.
      }
    }
  } catch {
    // No queue yet / IndexedDB unavailable — nothing to flush.
  }
}

function openGuestbookDb() {
  return new Promise((resolve) => {
    if (!('indexedDB' in self)) return resolve(null);
    let req;
    try {
      req = indexedDB.open('setnayan-guestbook', 1);
    } catch {
      return resolve(null);
    }
    // Do NOT create the store here — the page owns the schema. If it doesn't
    // exist yet, treat the queue as empty.
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('pending')) {
        db.close();
        return resolve(null);
      }
      resolve(db);
    };
    req.onerror = () => resolve(null);
    req.onupgradeneeded = () => {
      // Abort our own upgrade so we never race the page's schema definition.
      try {
        req.transaction && req.transaction.abort();
      } catch {
        /* ignore */
      }
      resolve(null);
    };
  });
}

function idbGetAll(db, store) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

function idbDelete(db, store, key) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
