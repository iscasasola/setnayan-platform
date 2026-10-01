## 2026-10-02 · perf(sw): the app's code stays on the phone across deploys

Part 2 of DECISION_LOG 2026-10-02 "A HOST'S WHOLE APP LOADS ONCE, IN THE
BACKGROUND… AND STAYS ON THE PHONE" (+ its amendment "THE PRELOAD FOLLOWS WHAT
THE ACCOUNT HAS").

- **Why:** every deploy (~6 a day) stamps a new `VERSION` into `public/sw.js`,
  and `activate` deleted every cache not named with it — so all cached code was
  thrown away and returning hosts re-downloaded the whole app. The browser's
  HTTP cache could not cover for it: every asset URL carries Vercel's per-deploy
  `?dpl=` skew parameter, so it missed too. The static cache also capped at 100
  entries / 7 days — smaller than the host app alone.
- **What:** Next's content-hashed build files (`/_next/static/chunks|css|media/`
  with a hex hash in the name) now live in `setnayan-static-immutable-v1` — a
  cache whose name carries no `VERSION`, CacheFirst, keyed by path alone (the
  `?dpl=` query dropped; a hashed name already pins the bytes). Routed by path,
  not `request.destination`, so a prefetch lands where the later `<script>`
  looks. Never stores a non-200, a non-same-origin answer, or a `text/html`
  answer (an error/login page under a chunk name would otherwise be pinned).
  Range requests pass through.
- **Eviction:** 1,500 entries / 100 MB budget, least-recently-requested first,
  and anything not requested for 30 days is pruned (also on `activate`, so a
  host back after a month is cleaned up at once). Last-requested time and size
  are persisted in a small JSON index stored inside that cache — the in-memory
  LRU the other caches use dies with every SW restart. Measured on a production
  build: host app + Maker + supplier app ≈ 600 files / ~8 MB; the whole build
  ≈ 1,180 files / ~20 MB.
- **Unchanged:** the per-deploy wipe for everything NOT content-hashed (shell,
  offline page, day-of pages, the per-build `_buildManifest`/`_ssgManifest`,
  non-hashed files), so the 2026-06-14 stale-shell class stays dead; no
  navigation interception (the Safari "Service Worker context closed" crash);
  `CACHE_BUST` still drops every cache, the new one included. Next already
  serves `/_next/static` as `public, max-age=31536000, immutable` (verified on
  prod); no headers added.
- **Tests:** `app/sw-keeps-code.test.ts` runs the real sw.js in a `vm` with a
  fake CacheStorage across two "deploys" — 8 tests, each of 8 sabotages turned
  at least one red.

SPEC IMPACT: None
