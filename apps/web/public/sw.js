// Setnayan service worker — route-scoped Workbox-equivalent semantics.
//
// Implements the asset layer half of the Caching & Offline Strategy spec
// (02_Specifications/Caching_and_Offline_Strategy.md § 3.2). Hand-rolled on
// the raw Cache + Fetch APIs; no Workbox bundle.
//
// Caches (each with its own LRU + max-age expiration · suffixed by VERSION):
//   - setnayan-images-v2   CacheFirst        500 entries, 30-day max-age
//   - setnayan-static-v2   StaleWhileReval.  100 entries,  7-day max-age
//                          (only NON-content-hashed scripts/styles now — e.g.
//                          the per-build /_next/static/<buildId>/ manifests)
//   - setnayan-fonts-v2    CacheFirst         20 entries,  1-year max-age
//
// …plus ONE cache that is deliberately NOT suffixed by VERSION:
//   - setnayan-static-immutable-v1  CacheFirst  1500 entries / 100 MB budget,
//                          pruned when not requested for 30 days
//   Holds Next's content-hashed build files (/_next/static/chunks|css|media/).
//   See "KEEP THE CODE ON THE PHONE" just below.
//
// KEEP THE CODE ON THE PHONE (DECISION_LOG 2026-10-02 "A HOST'S WHOLE APP
// LOADS ONCE, IN THE BACKGROUND… AND STAYS ON THE PHONE", part 2). Before this,
// every deploy (~6 a day) changed VERSION, and `activate` deleted every cache
// not in KNOWN_CACHES — so ALL cached code was thrown away and a returning host
// re-downloaded the whole app. And the browser's own HTTP cache could not
// help either: every asset URL carries Vercel's `?dpl=<deployment>` skew
// parameter, which changes per deploy, so the HTTP cache missed too.
//   A file under /_next/static/chunks|css|media/ is named by a hash of its own
//   bytes (Next serves it `public, max-age=31536000, immutable`). The same name
//   can never mean different bytes, so a file that did not change between two
//   deploys is the SAME file — it is safe to keep forever, keyed by its path
//   alone (the `?dpl=` query is dropped from the key). A file that DID change
//   gets a new name, which the new deploy's HTML asks for, so it can never be
//   served stale. That is why this cache survives deploys while everything
//   that is NOT content-hashed (shell, offline page, day-of pages, the
//   per-build manifests, non-hashed files) keeps the per-deploy wipe below —
//   the 2026-06-14 "stale shell after deploy" bug class stays dead.
//   Bump the `-v1` suffix BY HAND only if the key format or what this cache
//   holds changes; never tie it to VERSION.
//
// Preserves the existing exclusions (/auth/, /api/, /health, cross-origin,
// non-GET). App-shell navigations (dashboard / login / auth / marketing) are
// intentionally NOT intercepted — see the `fetch` handler's trailing comment
// for why (Safari "Service Worker context closed" navigation crash). Only the
// day-of guest `/[slug]` navigation is served offline.
//
// Listens for `{ type: 'CACHE_BUST' }` postMessages to drop every cache —
// used by the schema-buster pattern when NEXT_PUBLIC_CACHE_BUSTER bumps. That
// includes the deploy-surviving immutable cache: a bust is the escape hatch.
//
// CACHE VERSION — STAMPED PER DEPLOY (no more manual bumps). The build step
// `scripts/stamp-sw.mjs` rewrites the `const VERSION = '…'` line below to the
// deploy's VERCEL_GIT_COMMIT_SHA (wired into apps/web `package.json` "build").
// Because every deploy changes the sw.js bytes, the browser's own SW-update
// check — which re-fetches `/sw.js` (served `no-cache`, see next.config.ts) and
// byte-compares the script — installs the new worker. `install` calls
// skipWaiting() and `activate` deletes every cache NOT in KNOWN_CACHES +
// clients.claim(), so the prior deploy's shell/static/image caches are evicted
// and fresh assets land within one navigation. (The one exception is the
// content-hashed IMMUTABLE_CACHE, whose name does not contain VERSION — see
// "KEEP THE CODE ON THE PHONE" above.) This kills the
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
// Content-hashed build files. NOT suffixed by VERSION — survives deploys (see
// "KEEP THE CODE ON THE PHONE" in the header). Never derive this from VERSION.
const IMMUTABLE_CACHE = 'setnayan-static-immutable-v1';
// The viewer's OWN saved event pages for a no-signal venue (EV3 — see "THE SAVED COPY FOR A NO-SIGNAL VENUE" below).
// NOT suffixed by VERSION either: a deploy on the morning of the event must not erase the copy a coordinator saved
// the night before. It never answers an online navigation (network-first), so it cannot serve a stale shell to anyone
// with signal; its old page asks for old content-hashed code, which IMMUTABLE_CACHE keeps across deploys.
const OFFLINE_PAGES_CACHE = 'setnayan-offline-pages-v1';

const KNOWN_CACHES = [
  SHELL_CACHE,
  IMAGE_CACHE,
  STATIC_CACHE,
  FONT_CACHE,
  DAYOF_CACHE,
  IMMUTABLE_CACHE,
  OFFLINE_PAGES_CACHE,
];

// A Next build file whose NAME is a hash of its bytes: under chunks/, css/ or
// media/, with a hex content hash (webpack's [contenthash] / Next's media
// [hash]) in its file name — e.g. chunks/webpack-9041524f5488b3f7.js,
// css/c627faead13e2e1f.css, media/313510e2713fb214-s.p.woff2. The per-build
// /_next/static/<buildId>/_buildManifest.js + _ssgManifest.js are NOT matched
// (their name is fixed, their bytes change per build) and stay per-deploy.
// A file under these folders WITHOUT a hash in its name is not matched either.
const IMMUTABLE_PATH = /^\/_next\/static\/(?:chunks|css|media)\/(?:[^/]+\/)*[^/]*[0-9a-f]{8,}[^/]*$/i;

function isImmutableBuildFile(url) {
  return url.host === self.location.host && IMMUTABLE_PATH.test(url.pathname);
}

// The cache key is the path alone: Vercel appends `?dpl=<deployment>` to every
// asset URL and it changes per deploy, but a content-hashed name already pins
// the bytes — keeping the query in the key would re-download every unchanged
// file after every deploy, which is the whole problem this cache solves.
function immutableKey(url) {
  return url.origin + url.pathname;
}

// Sized from a production build (2026-10-02): the host app + the Maker + the
// supplier app (/dashboard + /site-editor + /vendor-dashboard, with every lazy
// chunk) is ~570 files / ~11 MB; the WHOLE build is 1,181 files / ~20 MB. So
// 1,500 entries / 100 MB holds every page of the app plus a few deploys' worth
// of replaced files. Evicted least-recently-requested first when EITHER cap is
// passed; anything not requested for 30 days is pruned regardless.
const IMMUTABLE_LIMITS = {
  maxEntries: 1500,
  maxBytes: 100 * 1024 * 1024,
  maxAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 days since last requested
};

const SHELL_ASSETS = [
  // NOTE: '/' is intentionally NOT precached. The homepage is force-dynamic and
  // never edge-cached, so precaching it on SW install fired a second full-TTFB
  // fetch of '/' right after first load — pure waste. Offline navigation still
  // falls back to the static '/offline.html' below. (Perf sweep 2026-07-02,
  // finding #26.)
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  '/offline.html',
];

// A navigation that WRITES OR CLEARS THE GUEST PASS — a personal link
// (`?invite=`), its redeem, a seat claim, a Papic hand-off, a sign-out. Left to
// the browser, never answered from here: the pass must be what the route just
// wrote, the same on a phone with this worker installed as on one without it
// (owner's live test 2026-10-02: a personal link opened the Event Hub on the
// host's long-used phone only). A COPY of `isGuestPassHop` in
// lib/guest-pass-hop.ts — this file cannot import it — and
// lib/guest-pass-hop.test.ts runs both over one table and fails if they differ.
function isGuestPassHop(url) {
  if ((url.searchParams.get('invite') || '').trim()) return true;
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length === 0) return false;
  if (url.pathname === '/auth/sign-out') return true;
  if (segments[0] === 'papic' && segments[1] === 'me' && segments[3] === 'session') return true;
  if (segments.length >= 2 && (segments[1] === 'redeem' || segments[1] === 'sign-out')) return true;
  if (segments[1] === 'seat' && segments[2] === 'claim') return true;
  return false;
}

// ---------------------------------------------------------------------------
// THE MAKER ASKS ONCE (2026-10-12; owner: "the key was to lessen the requests").
// Measured on a real event, 77 seconds in the Event Hub Maker: the guest page —
// a full server render, 31–34 database calls — was rendered about 22 times, and
// after EVERY canvas load one more request arrived for the BARE page
// (`/<slug>`, no `phase`, no `editor`; `referer: /sw.js`, `sec-fetch-mode:
// no-cors`). That request is made HERE, by the `PRELOAD_ASSETS` branch of the
// `message` listener: the guest page mounts `GuestPreload` in every render —
// the Maker's canvas included — which asks this worker to keep `/<slug>` for
// offline, and the worker fetches it. For a guest that is the point. For the
// Maker's canvas it is one wasted render per warm-up and per press.
//
// A page the HOST's app asks for is therefore the browser's alone: this worker
// makes no request of its own for it, answers nothing, and keeps no copy —
//   (a) a page address that is a host canvas or preview: `editor=1`, or any
//       `phase` query (`?phase=` is the host's preview of a stage; a guest's
//       address never carries it);
//   (b) a page asked for FROM the host's app — the referrer is a document
//       under /dashboard/ or /site-editor/, or is itself (a);
//   (c) a page loaded into a frame. The guest page may only be framed by this
//       origin (`frame-ancestors 'self'`), so a framed page is always one of
//       our own surfaces — the Maker's canvas, a style or theme miniature —
//       never a guest's visit.
// A guest's own visit (a top-level navigation to `/<slug>`, and the preload its
// page then asks for) is exactly as before. Code, images and fonts are cached
// as before for everyone — those cost the server nothing and save requests.
// `app/sw-the-maker-asks-once.test.ts` counts the requests for each case.
// ---------------------------------------------------------------------------
function isHostCanvasUrl(url) {
  return url.searchParams.get('editor') === '1' || url.searchParams.has('phase');
}

function sameOriginUrl(href) {
  if (!href || typeof href !== 'string') return null;
  try {
    const url = new URL(href, self.location.origin);
    return url.host === self.location.host ? url : null;
  } catch {
    return null;
  }
}

function isHostAppDocument(url) {
  return url.pathname.startsWith('/dashboard/') || url.pathname.startsWith('/site-editor/');
}

// A NAVIGATION the host's app makes — (a), (b) or (c) above.
function isHostAppNavigation(request, url) {
  if (isHostCanvasUrl(url)) return true;
  const destination = request.destination;
  if (destination === 'iframe' || destination === 'frame' || destination === 'embed' || destination === 'object') {
    return true;
  }
  const from = sameOriginUrl(request.referrer);
  return !!from && (isHostAppDocument(from) || isHostCanvasUrl(from));
}

// The page that SENT a message is a host canvas, a host preview, or framed:
// what it asks to be kept for offline is never fetched. `client` is the
// message's `source` (absent → not one of these, as before).
function isHostCanvasClient(client) {
  if (!client) return false;
  if (client.frameType === 'nested') return true;
  const at = sameOriginUrl(client.url);
  return !!at && isHostCanvasUrl(at);
}

// ---------------------------------------------------------------------------
// A GUEST'S OWN VISIT IS ONE RENDER (2026-10-12). The guest page asks the
// worker to keep its own address for offline (`GuestPreload`) — but when the
// worker ANSWERED that navigation, the day-of handler below is already keeping
// it (`DAYOF_CACHE`), so fetching it again was a second full server render of
// the guest page on every visit after the first. So the preload skips exactly
// one address: the SENDER'S OWN, and only while the day-of copy of it is held
// (or still being written — `DAYOF_WRITES`, its body may still be streaming).
// A page the worker did not answer (the first visit, a pass hop, a hard
// reload) has no such copy, and its preload is made exactly as before.
// ---------------------------------------------------------------------------
const DAYOF_WRITES = new Map();

function clientAddress(client) {
  const at = client ? sameOriginUrl(client.url) : null;
  if (!at) return null;
  at.hash = '';
  return at.href;
}

async function dayOfCopyHeld(href) {
  try {
    const writing = DAYOF_WRITES.get(href);
    if (writing) await writing;
    const cache = await caches.open(DAYOF_CACHE);
    return Boolean(await cache.match(href));
  } catch {
    return false;
  }
}

// A navigation to one of these path shapes is the day-of guest experience —
// cache it stale-while-revalidate in DAYOF_CACHE. `/[slug]` is the guest's
// personal landing page; `/[slug]/find-my-table` is the table/floorplan view.
// Dashboard + marketing routes are intentionally excluded (they stay on the
// network-first navigation fallback below).
function isDayOfGuestNavigation(url) {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length === 0) return false;
  const first = segments[0];
  // Exclude EVERY known top-level app route so only a bare guest slug matches.
  // (owner 2026-06-19: /monogram — and other public pages — were mistaken for a
  // guest slug and stale-cached, so the Vector Studio served an old build that
  // hung on "Loading the typeface…". Keep this in sync with app/<route>/.)
  //
  // This list is generated from the top-level directories under `apps/web/app/`
  // (private `_dirs`, `(route-groups)` and `[dynamic]` segments excluded — see
  // `app/sw-reserved-routes.test.ts`, which fails if this drifts from what
  // `app/` actually contains). Add the new route's segment here and let the
  // guard confirm it matches.
  const RESERVED = new Set([
    '3d_plan',
    'about',
    'acceptable-use',
    'admin',
    'alaala',
    'api',
    'auth',
    'blog',
    'budget',
    'claim',
    'cookies',
    'creators',
    'dashboard',
    'demo-capture',
    'dev',
    'download',
    'explore',
    'favicon.ico',
    'features',
    'for-suppliers',
    'forgot-password',
    'guest-list',
    'health',
    'help',
    'host',
    'join',
    'live',
    'llms.txt',
    'login',
    'marketplace',
    'monogram',
    'mood-board',
    'onboarding',
    'open-shop',
    'our-story',
    'pa3d',
    'pakanta',
    'palogo',
    'panood',
    'papic',
    'patiktok',
    'pawebsite',
    'pay',
    'pricing',
    'privacy',
    'proposals',
    'realstories',
    'receipts',
    'refunds',
    'reset-password',
    'samahan',
    'schedule',
    'seat-plan',
    'setnayan-ai',
    'signup',
    'site-editor',
    'start',
    'suppliers',
    'sitemap-blog.xml',
    'sitemap-features.xml',
    'sitemap-help.xml',
    'sitemap-static.xml',
    'sitemap-suppliers.xml',
    'sitemap-vendors.xml',
    'sitemap-weddings.xml',
    'sitemap.xml',
    'terms',
    'tl',
    'tour',
    'u',
    'v',
    'vendor',
    'vendor-dashboard',
    'vendor-invite',
    'waitlist',
    'wall',
    'web-only',
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

// ---------------------------------------------------------------------------
// IMMUTABLE_CACHE bookkeeping. Unlike the in-memory `lru` maps above (fine for
// caches that die with each deploy), this cache lives for weeks across many SW
// restarts and versions — so "when was this last requested" and "how big is
// it" are PERSISTED, as one small JSON document stored inside the cache itself
// under IMMUTABLE_INDEX_PATH (so CACHE_BUST, which deletes the cache, deletes
// the index with it). Shape: { v: 1, entries: { [key]: [lastRequestedMs, bytes] } }.
// ---------------------------------------------------------------------------
const IMMUTABLE_INDEX_PATH = '/__setnayan-sw/immutable-index.json';
// A hit only rewrites the index when the stored time is older than this, so a
// page load's ~30 chunk hits cost zero writes after the first of the hour.
const IMMUTABLE_TOUCH_EVERY_MS = 60 * 60 * 1000;
const IMMUTABLE_FLUSH_DELAY_MS = 1000;

let immutableIndex = null; // Map<key, { at: number, size: number }>
let immutableIndexLoading = null;
let immutableFlushPending = null;
let immutableQueue = Promise.resolve();

function immutableIndexKey() {
  return self.location.origin + IMMUTABLE_INDEX_PATH;
}

// Serialises every read-modify-write of the index + cache, so two fetches
// finishing together can't evict on a half-updated picture.
function withImmutableLock(fn) {
  const run = immutableQueue.then(fn, fn);
  immutableQueue = run.catch(() => undefined);
  return run;
}

async function responseSize(response) {
  try {
    return (await response.clone().arrayBuffer()).byteLength;
  } catch {
    return 0;
  }
}

function loadImmutableIndex() {
  if (immutableIndex) return Promise.resolve(immutableIndex);
  if (!immutableIndexLoading) {
    immutableIndexLoading = (async () => {
      const map = new Map();
      const cache = await caches.open(IMMUTABLE_CACHE);
      const indexKey = immutableIndexKey();
      try {
        const stored = await cache.match(indexKey);
        const json = stored ? await stored.json() : null;
        const entries = json && json.v === 1 && json.entries ? json.entries : {};
        for (const key of Object.keys(entries)) {
          const [at, size] = entries[key];
          map.set(key, { at: Number(at) || 0, size: Number(size) || 0 });
        }
      } catch {
        // Unreadable index — rebuilt from the cache's own keys just below.
      }
      // Reconcile with what the cache really holds: drop index rows whose file
      // is gone; adopt files the index doesn't know (index lost / write raced
      // a CACHE_BUST) as just-requested, with their real size.
      const actual = new Set();
      const now = Date.now();
      for (const request of await cache.keys()) {
        if (request.url === indexKey) continue;
        actual.add(request.url);
        if (!map.has(request.url)) {
          const res = await cache.match(request);
          map.set(request.url, { at: now, size: res ? await responseSize(res) : 0 });
        }
      }
      for (const key of [...map.keys()]) {
        if (!actual.has(key)) map.delete(key);
      }
      immutableIndex = map;
      return map;
    })().finally(() => {
      immutableIndexLoading = null;
    });
  }
  return immutableIndexLoading;
}

async function writeImmutableIndex() {
  if (!immutableIndex) return;
  const entries = {};
  for (const [key, e] of immutableIndex) entries[key] = [e.at, e.size];
  const cache = await caches.open(IMMUTABLE_CACHE);
  await cache.put(
    immutableIndexKey(),
    new Response(JSON.stringify({ v: 1, entries }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

// Coalesces index writes: every caller in the next second shares one write.
// Callers hand the returned promise to event.waitUntil so the SW stays alive
// until it lands.
function scheduleImmutableIndexFlush() {
  if (!immutableFlushPending) {
    immutableFlushPending = new Promise((resolve) => {
      setTimeout(() => {
        immutableFlushPending = null;
        withImmutableLock(writeImmutableIndex).then(resolve, resolve);
      }, IMMUTABLE_FLUSH_DELAY_MS);
    });
  }
  return immutableFlushPending;
}

// Prune anything not requested for maxAgeMs, then evict least-recently-
// requested until BOTH the entry cap and the byte budget hold.
async function enforceImmutableLimits() {
  const index = await loadImmutableIndex();
  const cache = await caches.open(IMMUTABLE_CACHE);
  const now = Date.now();
  const victims = [];
  const kept = [];
  for (const [key, e] of index) {
    if (now - e.at > IMMUTABLE_LIMITS.maxAgeMs) victims.push(key);
    else kept.push([key, e]);
  }
  kept.sort((a, b) => a[1].at - b[1].at);
  let count = kept.length;
  let bytes = kept.reduce((sum, [, e]) => sum + e.size, 0);
  let i = 0;
  while (
    i < kept.length &&
    (count > IMMUTABLE_LIMITS.maxEntries || bytes > IMMUTABLE_LIMITS.maxBytes)
  ) {
    const [key, e] = kept[i];
    victims.push(key);
    count -= 1;
    bytes -= e.size;
    i += 1;
  }
  for (const key of victims) {
    await cache.delete(key);
    index.delete(key);
  }
  return victims.length;
}

// What may be kept forever: a same-origin 200 that is not an HTML page (an
// error/login page answered with 200 must never be pinned under a chunk's name
// — a hashed name is never re-fetched once cached).
function isKeepableBuildFile(response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return false;
  if (response.redirected) return false;
  const type = (response.headers.get('Content-Type') || '').toLowerCase();
  return !type.includes('text/html');
}

// CacheFirst for content-hashed build files. `after` collects the background
// work (store, touch, evict, index flush) for the caller's event.waitUntil.
async function immutableCacheFirst(request, url, after) {
  const key = immutableKey(url);
  let cache;
  let cached;
  try {
    cache = await caches.open(IMMUTABLE_CACHE);
    cached = await cache.match(key);
  } catch {
    // Storage unavailable (private mode, quota, a closing context): behave as
    // if there were no worker at all rather than failing the script load.
    return fetch(request);
  }
  if (cached) {
    after.push(
      withImmutableLock(async () => {
        const index = await loadImmutableIndex();
        const now = Date.now();
        const e = index.get(key);
        if (e && now - e.at < IMMUTABLE_TOUCH_EVERY_MS) return;
        index.set(key, { at: now, size: e ? e.size : await responseSize(cached) });
        after.push(scheduleImmutableIndexFlush());
      }).catch(() => undefined),
    );
    return cached;
  }
  const response = await fetch(request);
  if (isKeepableBuildFile(response)) {
    const copy = response.clone();
    after.push(
      withImmutableLock(async () => {
        const index = await loadImmutableIndex();
        const size = await responseSize(copy);
        await cache.put(key, copy);
        index.set(key, { at: Date.now(), size });
        await enforceImmutableLimits();
        after.push(scheduleImmutableIndexFlush());
      }).catch(() => undefined),
    );
  }
  return response;
}

function serveImmutable(event, url) {
  const after = [];
  let release;
  event.waitUntil(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  // `after` can grow while it is being awaited (a store schedules a flush), so
  // drain until it stops growing, then let the worker sleep.
  const drain = async () => {
    let seen = 0;
    while (seen < after.length) {
      const batch = after.slice(seen);
      seen = after.length;
      await Promise.allSettled(batch);
    }
    release();
  };
  event.respondWith(
    immutableCacheFirst(event.request, url, after).finally(() => {
      drain();
    }),
  );
}

async function clearAllCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
  for (const name of Object.keys(lru)) {
    lru[name].clear();
  }
  // The immutable cache (and the index stored inside it) is gone too — forget
  // the in-memory copy so the next request rebuilds it from an empty cache.
  immutableIndex = null;
  // …and so are the saved event pages and their registry.
  offlineRegistry = null;
}

// ---------------------------------------------------------------------------
// 📶 THE SAVED COPY FOR A NO-SIGNAL VENUE (EV3, owner 2026-10-28 — DECISION_LOG "OFFLINE SAVING IS ALWAYS ON",
// "APPROVED — EVENT DAY NEVER FAILS (always-on) … + BROWSER OFFLINE SUPPORT", "APP-WIDE SPEED RULE").
//
// Until now every coordinator / supplier navigation was the browser's alone (see the end of the `fetch` handler), so
// with no signal Home › Today, the Check-in desk, the supplier Hub and the event's console opened /offline.html. Now
// the viewer's OWN copies of exactly four page shapes are kept, and opened when — and only when — there is no signal:
//   /dashboard/<event> · /dashboard/<event>/guests/checkin · /vendor-dashboard/on-the-day ·
//   /vendor-dashboard/on-the-day/live/<event>        (query-less; a COPY of lib/offline-copies.ts OFFLINE_COPY_SHAPES,
//                                                     held equal by app/sw-offline-copies.test.ts)
//
// 🔑 THE RULES (each one a test in app/sw-offline-copies.test.ts):
//   · NETWORK-FIRST, ALWAYS. With signal the page is the network's answer, every time — a kept copy is never returned
//     to a request the network answered, and there is no stale-while-revalidate for HTML (the June "old build served
//     after deploy" bug). The copy answers only a navigation whose network request FAILED, or one made while the
//     browser says it is offline.
//   · REFRESHED ON EVERY OPEN WITH SIGNAL. A kept page's own navigation re-saves it from that same response (no second
//     request); the page then asks (`OFFLINE_SAVE`) for its siblings — e.g. Home asks for the Check-in desk — which the
//     worker fetches with the viewer's own cookies, at most every 30 min unless "Update now" is pressed.
//   · ONE VIEWER. The registry records whose copies these are. A save or a signed-in page (`OFFLINE_VIEWER`, an inline
//     script in the dashboard + supplier layouts) by anyone else erases them all first; the signed-out landing pages
//     erase them (`OFFLINE_COPIES_WIPE_SCRIPT`); `OFFLINE_FORGET` erases them.
//   · ONLY WHAT THE VIEWER'S OWN SESSION RENDERED, FOR THE EVENT NAMED. A save may name only these shapes, only the
//     event it is for, and a response is kept only when it is that page itself — 200, HTML, not redirected (a refused
//     or signed-out render, which redirects, is never kept).
//   · ERASED AFTER THE EVENT. Each event's copies carry its `until` (the end of the day after it); past it they go.
//
// 🍎 SAFARI. A navigation the worker answers can be failed whole by WebKit if it kills the worker mid-answer (the
// 2026-07-03 "Service Worker context closed" crash — see the end of `fetch`). So the worker answers one of these
// navigations only when (a) its in-memory registry says a copy of that page is kept for the viewer, or (b) the browser
// says it is offline, or (c) the engine is not WebKit (the async check then passes the request straight through when
// nothing is kept). On WebKit with a cold worker and a phone that claims signal it does NOT answer — the browser's
// own behaviour, exactly as before. This is why the help tells iPhone coordinators to use the app / Home Screen.
// ---------------------------------------------------------------------------
const OFFLINE_REGISTRY_PATH = '/__setnayan-sw/offline/registry.json';
const OFFLINE_COPY_SHAPES = [
  /^\/dashboard\/([A-Za-z0-9-]{8,64})$/,
  /^\/dashboard\/([A-Za-z0-9-]{8,64})\/guests\/checkin$/,
  /^\/vendor-dashboard\/on-the-day$/,
  /^\/vendor-dashboard\/on-the-day\/live\/([A-Za-z0-9-]{8,64})$/,
];
const OFFLINE_EVENT_ID = /^[A-Za-z0-9-]{8,64}$/;
const OFFLINE_VIEWER_ID = /^[A-Za-z0-9_-]{8,128}$/;
const OFFLINE_MAX_PAGES = 4;
// An automatic save re-renders a kept page only when its copy is older than this (lib/offline-copies.ts
// AUTO_REFRESH_AFTER_MS); "Update now" (`force`) always does.
const OFFLINE_AUTO_REFRESH_MS = 30 * 60 * 1000;
// A save may not keep a copy for longer than this from now — `until` is the day after the event, at most ~3 days on.
const OFFLINE_MAX_KEEP_MS = 10 * 24 * 60 * 60 * 1000;
const OFFLINE_WARM_MAX = 250;

function isOfflineCopyPath(path) {
  return OFFLINE_COPY_SHAPES.some((re) => re.test(path));
}

// The event a copy path belongs to; null for the supplier Hub (names no event); undefined = not a copy path.
function offlineCopyEventId(path) {
  for (const re of OFFLINE_COPY_SHAPES) {
    const m = re.exec(path);
    if (m) return m[1] || null;
  }
  return undefined;
}

const WORKER_UA = (self.navigator && self.navigator.userAgent) || '';
// iOS Chrome ("CriOS") and every other iPhone browser IS WebKit; desktop/Android Chrome, Edge, Opera and Samsung say so.
const IS_WEBKIT = /AppleWebKit\//.test(WORKER_UA) && !/(?:Chrome|Chromium|Edg|OPR|SamsungBrowser)\//.test(WORKER_UA);

function browserSaysOffline() {
  return Boolean(self.navigator) && self.navigator.onLine === false;
}

let offlineRegistry = null; // { v: 1, viewer, events: { [eventId]: { until, pages: { [path]: savedAtMs } } } }
let offlineRegistryLoading = null;
let offlineQueue = Promise.resolve();

function emptyOfflineRegistry() {
  return { v: 1, viewer: '', events: {} };
}

function offlineRegistryKey() {
  return self.location.origin + OFFLINE_REGISTRY_PATH;
}

function offlinePageKey(path) {
  return self.location.origin + path;
}

// Serialises every read-modify-write of the registry + cache (two saves, or a save and a navigation, finishing together).
function withOfflineLock(fn) {
  const run = offlineQueue.then(fn, fn);
  offlineQueue = run.catch(() => undefined);
  return run;
}

function loadOfflineRegistry() {
  if (offlineRegistry) return Promise.resolve(offlineRegistry);
  if (!offlineRegistryLoading) {
    offlineRegistryLoading = (async () => {
      let reg = null;
      try {
        // `has` first: merely reading must not create an empty cache on every phone that keeps nothing.
        const cache = (await caches.has(OFFLINE_PAGES_CACHE)) ? await caches.open(OFFLINE_PAGES_CACHE) : null;
        const stored = cache ? await cache.match(offlineRegistryKey()) : null;
        const json = stored ? await stored.json() : null;
        if (json && json.v === 1 && typeof json.viewer === 'string' && json.events && typeof json.events === 'object') {
          reg = json;
        }
      } catch {
        // Unreadable → nothing is kept (never somebody's copy).
      }
      offlineRegistry = reg || emptyOfflineRegistry();
      return offlineRegistry;
    })().finally(() => {
      offlineRegistryLoading = null;
    });
  }
  return offlineRegistryLoading;
}

async function writeOfflineRegistry() {
  const cache = await caches.open(OFFLINE_PAGES_CACHE);
  await cache.put(
    offlineRegistryKey(),
    new Response(JSON.stringify(offlineRegistry || emptyOfflineRegistry()), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

// Every copy, every event, the registry with them.
async function forgetOfflineCopies() {
  offlineRegistry = emptyOfflineRegistry();
  try {
    await caches.delete(OFFLINE_PAGES_CACHE);
  } catch {
    // Nothing to delete.
  }
}

// When the copy of `path` was saved, if a live (not yet erased) event of the CURRENT viewer keeps it; else null.
function offlineCopySavedAt(reg, path, now) {
  if (!reg || !reg.viewer) return null;
  let newest = null;
  for (const id of Object.keys(reg.events)) {
    const ev = reg.events[id];
    if (!ev || !(ev.until > now) || !ev.pages) continue;
    const at = ev.pages[path];
    if (typeof at === 'number' && (newest === null || at > newest)) newest = at;
  }
  return newest;
}

// Erase every event whose window has closed — and each copy no other live event still keeps.
async function pruneOfflineCopies(now) {
  const reg = await loadOfflineRegistry();
  const doomed = Object.keys(reg.events).filter((id) => !(reg.events[id] && reg.events[id].until > now));
  if (doomed.length === 0) return false;
  const paths = new Set();
  for (const id of doomed) {
    for (const p of Object.keys((reg.events[id] && reg.events[id].pages) || {})) paths.add(p);
    delete reg.events[id];
  }
  const cache = await caches.open(OFFLINE_PAGES_CACHE);
  for (const p of paths) {
    if (offlineCopySavedAt(reg, p, now) === null) await cache.delete(offlinePageKey(p));
  }
  await writeOfflineRegistry();
  return true;
}

// The page itself: a same-origin 200 HTML document that was not redirected. A refused / signed-out render redirects
// (to /login, to the event, to verify) — never kept.
function isKeepablePage(response) {
  if (!response || response.status !== 200 || response.redirected) return false;
  if (response.type !== 'basic' && response.type !== 'default') return false;
  return (response.headers.get('Content-Type') || '').toLowerCase().includes('text/html');
}

// The content-hashed code a kept page asks for, put in IMMUTABLE_CACHE now, so the copy opens whole with no signal.
async function warmPageCode(html) {
  const seen = new Set();
  const re = /\/_next\/static\/(?:chunks|css|media)\/[^"'\s<>()\\]+/g;
  let m;
  while ((m = re.exec(html)) && seen.size < OFFLINE_WARM_MAX) {
    const pathOnly = m[0].replace(/&amp;.*$/, '').split('?')[0];
    if (IMMUTABLE_PATH.test(pathOnly)) seen.add(pathOnly);
  }
  const after = [];
  for (const path of seen) {
    const url = new URL(path, self.location.origin);
    try {
      await immutableCacheFirst(new Request(url.href), url, after);
    } catch {
      // A file that cannot be fetched now is fetched the next time — the copy is still kept.
    }
  }
  let seenAfter = 0;
  while (seenAfter < after.length) {
    const batch = after.slice(seenAfter);
    seenAfter = after.length;
    await Promise.allSettled(batch);
  }
}

async function keepOfflinePage(path, response, now) {
  const html = await response.clone().text();
  const cache = await caches.open(OFFLINE_PAGES_CACHE);
  const headers = new Headers(response.headers);
  headers.set('X-Setnayan-Saved-Copy', String(now));
  await cache.put(offlinePageKey(path), new Response(html, { status: 200, headers }));
  try {
    await warmPageCode(html);
  } catch {
    // Best-effort.
  }
}

// `OFFLINE_SAVE` — keep (or refresh) this viewer's copies of one event's pages. Returns what the page's mark says.
async function saveOfflineCopies(data) {
  const now = Date.now();
  const viewer = typeof data.viewer === 'string' ? data.viewer : '';
  const eventId = typeof data.eventId === 'string' ? data.eventId : '';
  const until = Number(data.until);
  const paths = Array.isArray(data.paths) ? data.paths.filter((p) => typeof p === 'string') : [];
  if (
    !OFFLINE_VIEWER_ID.test(viewer) ||
    !OFFLINE_EVENT_ID.test(eventId) ||
    !Number.isFinite(until) ||
    until <= now ||
    until > now + OFFLINE_MAX_KEEP_MS ||
    paths.length === 0 ||
    paths.length > OFFLINE_MAX_PAGES ||
    !paths.every((p) => {
      const owner = offlineCopyEventId(p);
      // Only the four shapes, and only THIS event's address (the Hub names no event and is the supplier's own).
      return owner !== undefined && (owner === null || owner === eventId);
    })
  ) {
    return { ok: false, refused: true, savedAt: null, failed: paths };
  }
  const reg = await loadOfflineRegistry();
  if (reg.viewer !== viewer) {
    // 🔑 ONE VIEWER: somebody else's copies are erased before anything of this viewer's is kept.
    await forgetOfflineCopies();
    offlineRegistry.viewer = viewer;
  }
  await pruneOfflineCopies(now);
  const reg2 = offlineRegistry;
  const ev = reg2.events[eventId] || { until, pages: {} };
  ev.until = until;
  const failed = [];
  for (const path of paths) {
    const had = ev.pages[path];
    if (!data.force && typeof had === 'number' && now - had < OFFLINE_AUTO_REFRESH_MS) continue;
    try {
      const response = await fetch(new Request(offlinePageKey(path), {
        credentials: 'same-origin',
        redirect: 'manual',
        cache: 'no-store',
        headers: { 'X-Setnayan-Offline-Save': '1' },
      }));
      if (isKeepablePage(response)) {
        const at = Date.now();
        await keepOfflinePage(path, response, at);
        ev.pages[path] = at;
      } else {
        failed.push(path);
      }
    } catch {
      failed.push(path);
    }
  }
  reg2.events[eventId] = ev;
  await writeOfflineRegistry();
  let savedAt = Infinity;
  for (const p of paths) {
    const at = ev.pages[p];
    if (typeof at !== 'number') {
      savedAt = null;
      break;
    }
    savedAt = Math.min(savedAt, at);
  }
  return { ok: failed.length === 0, savedAt: savedAt === Infinity ? null : savedAt, failed };
}

// The copy of `path` the current viewer keeps, or null. It is marked on its <html> element
// (`data-sn-saved-copy="<saved at ms>"`; the root <html> carries suppressHydrationWarning) so the page KNOWS it is the
// copy: its mark says so, and its day-of refresh tick stands still instead of reloading the copy every 45 s.
async function offlineCopyResponse(path) {
  const reg = await loadOfflineRegistry();
  const at = offlineCopySavedAt(reg, path, Date.now());
  if (at === null) return null;
  try {
    const cache = await caches.open(OFFLINE_PAGES_CACHE);
    const kept = await cache.match(offlinePageKey(path));
    if (!kept) return null;
    const html = (await kept.text()).replace(/<html(?=[\s>])/i, `<html data-sn-saved-copy="${at}"`);
    return new Response(html, { status: 200, headers: kept.headers });
  } catch {
    return null;
  }
}

// One kept-shape navigation. NETWORK-FIRST: the network's answer is returned whenever there is one; the copy only when
// the request failed (or the browser says it is offline). A kept page's successful answer refreshes its copy.
async function offlineCopyNavigation(request, url, after) {
  const path = url.pathname;
  if (browserSaysOffline()) {
    const copy = await offlineCopyResponse(path);
    if (copy) return copy;
  }
  let response;
  try {
    response = await fetch(request);
  } catch (err) {
    const copy = await offlineCopyResponse(path);
    if (copy) return copy;
    const shell = await caches.match('/offline.html');
    if (shell) return shell;
    throw err;
  }
  if (isKeepablePage(response)) {
    const copy = response.clone();
    after.push(
      withOfflineLock(async () => {
        const reg = await loadOfflineRegistry();
        const now = Date.now();
        if (offlineCopySavedAt(reg, path, now) === null) return; // not a page this viewer keeps
        await keepOfflinePage(path, copy, now);
        for (const id of Object.keys(reg.events)) {
          const ev = reg.events[id];
          if (ev && ev.until > now && ev.pages && typeof ev.pages[path] === 'number') ev.pages[path] = now;
        }
        await writeOfflineRegistry();
      }).catch(() => undefined),
    );
  }
  return response;
}

// The fetch handler's synchronous decision for a navigation (see 🍎 SAFARI above). Returns true when it answered.
function maybeServeOfflineCopy(event, request, url) {
  if (url.search || !isOfflineCopyPath(url.pathname)) return false;
  if (request.destination && request.destination !== 'document') return false;
  const listed = offlineRegistry ? offlineCopySavedAt(offlineRegistry, url.pathname, Date.now()) !== null : null;
  if (!(listed === true || (listed === null && (browserSaysOffline() || !IS_WEBKIT)))) return false;
  const after = [];
  let release;
  event.waitUntil(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  event.respondWith(
    offlineCopyNavigation(request, url, after).finally(() => {
      Promise.allSettled(after).then(() => release());
    }),
  );
  return true;
}

// ---------------------------------------------------------------------------
// A DEVELOPMENT HOST GETS A PASS-THROUGH WORKER (2026-10-09). This worker is
// registered wherever the app runs, `next dev` included — and on a dev server
// the files behind /_next/static are NOT content-hashed: the same URL holds new
// bytes after every edit. The stale-while-revalidate above then answered every
// such script from the cache first, so the first load after each change ran the
// PREVIOUS script against the NEW html and css, and a reviewer judged code that
// had already been replaced.
//   On a development host this worker therefore never reads a cache, never
//   writes one (no install pre-cache, no PRELOAD_ASSETS), and never calls
//   respondWith — every request goes straight to the network, natively. When it
//   activates there it also deletes every cache an earlier copy of it made and
//   claims its clients, so a worker that was already installed (and serving
//   stale scripts) is replaced and stops on the next load.
//   Development host = localhost · 127.0.0.1 · [::1] · *.localhost · *.test ·
//   a private LAN address (10.* · 172.16–31.* · 192.168.*). A production host
//   is none of these, and every handler below behaves there exactly as before.
// ---------------------------------------------------------------------------
function isDevHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
  if (host.endsWith('.localhost') || host.endsWith('.test')) return true;
  const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ip) return false;
  const [a, b, c, d] = ip.slice(1).map(Number);
  if (a > 255 || b > 255 || c > 255 || d > 255) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
const DEV_HOST = isDevHost(self.location.hostname);
// 📶 Read the saved-copy registry as the worker starts, so a navigation a moment later can be decided from memory.
if (!DEV_HOST) loadOfflineRegistry().catch(() => undefined);

// Every cache this worker ever made is named `setnayan-…` (the versioned ones and
// the deploy-surviving immutable one). Nothing else on the origin is touched.
async function forgetMyCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith('setnayan-')).map((key) => caches.delete(key)));
  for (const name of Object.keys(lru)) {
    lru[name].clear();
  }
  immutableIndex = null;
  offlineRegistry = null;
}

self.addEventListener('install', (event) => {
  // A development host pre-caches nothing: it takes over at once (skipWaiting)
  // and its activate step clears whatever an older copy kept.
  if (DEV_HOST) {
    self.skipWaiting();
    return;
  }
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  if (DEV_HOST) {
    event.waitUntil(forgetMyCaches().then(() => self.clients.claim()));
    return;
  }
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
      .then(() => self.clients.claim())
      // A host back after a month: drop the code nobody has asked for in 30
      // days now, not only the next time something new is stored. Best-effort.
      .then(() =>
        withImmutableLock(async () => {
          if (await enforceImmutableLimits()) await writeImmutableIndex();
        }).catch(() => undefined),
      )
      // 📶 An event whose window has closed: its saved pages go now.
      .then(() => withOfflineLock(() => pruneOfflineCopies(Date.now())).catch(() => undefined)),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'CACHE_BUST') {
    event.waitUntil(clearAllCaches());
    return;
  }

  // 📶 THE SAVED COPY (see "THE SAVED COPY FOR A NO-SIGNAL VENUE"). Each answers on the message's port, if it sent one.
  if (data.type === 'OFFLINE_SAVE' || data.type === 'OFFLINE_VIEWER' || data.type === 'OFFLINE_FORGET') {
    const port = event.ports && event.ports[0];
    const reply = (result) => {
      try {
        if (port) port.postMessage(result);
      } catch {
        // The page has gone.
      }
    };
    if (DEV_HOST) {
      // A development host keeps nothing (see "A DEVELOPMENT HOST" above) — and says so.
      reply({ ok: false, dev: true, savedAt: null, failed: [] });
      return;
    }
    const work =
      data.type === 'OFFLINE_SAVE'
        ? withOfflineLock(() => saveOfflineCopies(data))
        : data.type === 'OFFLINE_FORGET'
          ? withOfflineLock(() => forgetOfflineCopies().then(() => ({ ok: true })))
          : withOfflineLock(async () => {
              const reg = await loadOfflineRegistry();
              const viewer = typeof data.viewer === 'string' ? data.viewer : '';
              if (reg.viewer && reg.viewer !== viewer) await forgetOfflineCopies();
              return { ok: true };
            });
    event.waitUntil(work.then(reply, () => reply({ ok: false, savedAt: null, failed: [] })));
    return;
  }

  // Iteration 0036 — event-day pre-load. Page sends a list of image URLs
  // (guest avatars, mood-board thumbnails, save-the-date previews) to warm
  // into IMAGE_CACHE so the dashboard renders offline on event day. Plays
  // nice with the route-scoped LRU + max-age expiration in IMAGE_CACHE.
  if (data.type === 'PRELOAD_ASSETS') {
    if (DEV_HOST) return; // a development host writes no cache
    // 🔑 THE MAKER ASKS ONCE — a host canvas, a host preview or a framed page
    // asked: nothing is fetched (this was the bare `/<slug>` after every canvas
    // load). And no sender can have a host canvas address kept.
    if (isHostCanvasClient(event.source)) return;
    const urls = Array.isArray(data.urls)
      ? data.urls.filter((u) => {
          if (typeof u !== 'string') return false;
          const at = sameOriginUrl(u);
          return !(at && isHostCanvasUrl(at));
        })
      : [];
    if (urls.length === 0) return;
    const own = clientAddress(event.source);

    event.waitUntil(
      (async () => {
        const cache = await caches.open(IMAGE_CACHE);
        await Promise.all(
          urls.map(async (url) => {
            try {
              // The sender's own page, already kept for the day: not fetched again.
              const at = sameOriginUrl(url);
              if (own && at && at.href === own && (await dayOfCopyHeld(own))) return;
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
  // A development host: no respondWith, no cache read, no cache write — the
  // request goes straight to the network (see "A DEVELOPMENT HOST" above).
  if (DEV_HOST) return;
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

  // Content-hashed build files: kept across deploys, CacheFirst. Routed by
  // PATH, not request.destination — a prefetch/preload asks with an empty
  // destination and must land in the same place as the <script> that later
  // uses it. A Range request (media seeking) is left to the network: a 206 is
  // not cacheable and a whole-file 200 is not what it asked for.
  if (isImmutableBuildFile(url) && !request.headers.has('range')) {
    serveImmutable(event, url);
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

  // Guest landing-page navigation (the personal `/[slug]` page + find-my-table).
  // NETWORK-FIRST (owner 2026-06-19): always fetch fresh when online and update
  // the cache, falling back to the cached copy ONLY when the network fails. The
  // old stale-while-revalidate served the PREVIOUS build's HTML (→ old JS chunks)
  // on the first visit after every deploy — so couples/owners saw stale pages and
  // thought nothing shipped. Network-first keeps the offline/weak-signal fallback
  // (day-of at a venue) while guaranteeing a fresh page whenever the network is up.
  const isNavigation =
    request.mode === 'navigate' || request.destination === 'document';
  // 🔑 A pass hop is the browser's alone — no respondWith, no cache, no fallback.
  if (isNavigation && isGuestPassHop(url)) return;
  // 📶 A coordinator's / supplier's own event page: network-first, the saved copy only with no signal (EV3). Checked
  // BEFORE the host-app rule below — that rule is about GUEST pages opened from the host's app, and its referrer test
  // would otherwise hand Home → Check-in desk back to the browser.
  if (isNavigation && maybeServeOfflineCopy(event, request, url)) return;
  // 🔑 So is a page the host's app asks for (the Maker's canvas, a stage
  // preview, a miniature): one request, the browser's, and no copy kept.
  if (isNavigation && isHostAppNavigation(request, url)) return;
  if (isNavigation && isDayOfGuestNavigation(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            const writing = caches.open(DAYOF_CACHE).then((cache) =>
              cache.put(request, clone).then(() => {
                recordAccess(DAYOF_CACHE, request.url);
                return enforceLimits(DAYOF_CACHE);
              }),
            );
            // The page's own preload waits for this copy instead of fetching it again.
            DAYOF_WRITES.set(request.url, writing);
            writing
              .catch(() => undefined)
              .then(() => {
                if (DAYOF_WRITES.get(request.url) === writing) DAYOF_WRITES.delete(request.url);
              });
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((c) => c ?? caches.match('/offline.html')),
        ),
    );
    return;
  }

  // Every OTHER navigation (dashboard · login · auth · marketing — all but the
  // four saved-copy shapes above) is left to the browser: we deliberately do NOT call event.respondWith for it, so the
  // request goes straight to the network natively.
  //
  // WHY (Safari "Service Worker context closed" crash · 2026-07-03): WebKit
  // aggressively terminates the SW context during a navigation — most often in
  // the install→skipWaiting()→clients.claim() handover window a returning user
  // hits on nearly every visit (our sw.js bytes change per deploy, so the
  // worker updates constantly). If we're mid-`respondWith(fetch(navigation))`
  // when Safari kills the context, WebKit fails the WHOLE navigation with
  // "Service Worker context closed (WebKitInternal:0)" instead of retrying on
  // the network. Login was the reproducer: POST → server-action redirect → GET
  // /dashboard navigation, intercepted right inside that handover window.
  //
  // The generic shell-cache offline fallback we used to serve here bought
  // almost nothing — the dashboard / login / auth surfaces all need the network
  // + a live auth session anyway — so it never justified crashing live logins.
  // The one genuinely-offline navigation, the day-of guest `/[slug]` page, is
  // still intercepted above; asset caching (images / fonts / JS / CSS) is
  // unaffected because those aren't navigations. Not intercepting app
  // navigations also *helps* freshness: they can never serve a stale shell.
  return;
});

// ---------------------------------------------------------------------------
// Web Push (compliance/push-offline — Apple guideline 4.2).
//
// 🔑 TWO PAYLOAD SHAPES, AND THE ONE EVERY NOTICE ACTUALLY SENDS WAS IGNORED.
// `lib/web-push.ts` (the funnel every emitNotification push goes through) sends
//   { title, body, url, tag }            — top level, no `data`
// while this handler only ever read the older vendor-thread shape
//   { title, body, data: { thread_id?, type? } }
// so until 2026-10-31 every notice arrived tagged 'setnayan-vendor' and a tap
// opened /vendor-dashboard — a host tapping "Maria RSVP'd" landed on a supplier
// screen. Both shapes are read now: `url` and `tag` first, then `data.*`.
//
// The tap opens `url` only when it is a same-origin PATH ("/dashboard/…"); any
// other value falls back, so a payload can never send the phone off-site.
//
// Best-effort and defensive: a malformed payload shows a generic Setnayan
// notification rather than throwing inside the push event.
// ---------------------------------------------------------------------------
function pushTargetPath(data) {
  const url = data && typeof data.url === 'string' ? data.url : '';
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  if (data && data.thread_id) {
    return `/vendor-dashboard/messages?thread=${encodeURIComponent(data.thread_id)}`;
  }
  return '/dashboard';
}

self.addEventListener('push', (event) => {
  /** @type {{ title?: string, body?: string, url?: string, tag?: string, data?: Record<string,string> }} */
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Setnayan', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Setnayan';
  const nested = (payload.data && typeof payload.data === 'object') ? payload.data : {};
  const data = { ...nested };
  if (typeof payload.url === 'string') data.url = payload.url;
  const options = {
    body: payload.body || '',
    // Use the existing SVG icon at the public root (icon-192.svg).
    // Chromium supports SVG notification icons; Safari ignores the icon field.
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    // Collapse: a newer notice with the same tag REPLACES the older one on the
    // device (one per conversation; one per event for grouped guest replies).
    tag: (typeof payload.tag === 'string' && payload.tag) || nested.thread_id || 'setnayan',
    // Carry the structured data so notificationclick can route correctly.
    data,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = pushTargetPath(event.notification.data || {});

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
