import 'server-only';
import { headers } from 'next/headers';
import { chromeSnapshotWith, mayReuseChrome } from './chrome-snapshot-core';

export { SNAPSHOT_MS } from './chrome-snapshot-core';

/**
 * lib/chrome-snapshot.ts — AN IN-APP REQUEST REUSES THE ACCOUNT CHROME THE SAME PERSON JUST HAD.
 *
 * ── WHY (measured 2026-10-16, production build, the owner's rows replayed) ──
 * Opening `/dashboard` fires nine RSC prefetches (the account rail's links and the three
 * event cards), and every tap inside the app is one more RSC request. Each re-rendered the
 * account chrome from scratch — the switcher (profile, roles, memberships, events, photo) and
 * the rail's account slot — a few hundred milliseconds after the page had read exactly the same
 * rows for the same person.
 *
 * ── WHY NOT "ONLY PREFETCHES" ──────────────────────────────────────────────
 * That was the first rule, and it could never fire: Next strips `Next-Router-Prefetch` (and
 * `RSC`) from `headers()` AND from the middleware's request (`FLIGHT_HEADERS`, measured: both
 * saw `null`). What the browser itself says survives: `Sec-Fetch-Dest` is `document` for a page
 * load and `empty` for the app's own fetches.
 *
 * ── THE RULE ───────────────────────────────────────────────────────────────
 *   · Keyed by the VERIFIED user id (callers pass `getCurrentUser().id`, checked with the auth
 *     server), holding only what that person's own reads returned — never another person's.
 *   · REUSE only on an in-app request (`Sec-Fetch-Dest: empty`) within `SNAPSHOT_MS`. A page
 *     LOAD (`document`, a refresh, a new tab) always reads fresh, and so does a request with no
 *     `Sec-Fetch-Dest` at all (not a browser we can read).
 *   · A SERVER ACTION (`Next-Action`) always reads fresh — so the re-render after the person
 *     changes something (a new event, a new photo, a shop) carries the change, and refreshes the
 *     snapshot for the requests after it.
 *   · Only a GOOD answer is kept: a failed or "not measured" read is never replayed (`keep`).
 *   · Bounded: `MAX_ENTRIES` people, oldest out first; per server instance.
 *
 * What can be stale, and for how long: another person's change to this person's chrome (a
 * co-host adding them to an event) shows up to `SNAPSHOT_MS` late — the same order as the
 * router's own 60 s `staleTimes.dynamic` the app already runs on. Nothing here caches money or
 * a permission CHECK: the chrome only draws; every page gates on its own fresh read.
 * 🔒 lib/a-prefetch-reuses-the-chrome.test.ts
 */
async function isPrefetch(): Promise<boolean> {
  try {
    return mayReuseChrome(await headers());
  } catch {
    return false; // outside a request (tests, build) — never reuse
  }
}

export function chromeSnapshot<T>(
  name: string,
  userId: string,
  load: () => Promise<T>,
  keep: (value: T) => boolean = () => true,
): Promise<T> {
  return chromeSnapshotWith(name, userId, load, keep, Date.now, isPrefetch);
}
