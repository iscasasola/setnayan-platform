import 'server-only';
import { headers } from 'next/headers';
import { chromeSnapshotWith } from './chrome-snapshot-core';

export { SNAPSHOT_MS } from './chrome-snapshot-core';

/**
 * lib/chrome-snapshot.ts — A PREFETCH REUSES THE ACCOUNT CHROME THE SAME PERSON JUST HAD.
 *
 * ── WHY (measured 2026-10-16, production build, the owner's rows replayed) ──
 * Opening `/dashboard` fires nine RSC prefetches (the account rail's links and the three
 * event cards). Every one of them re-rendered the account chrome from scratch — the
 * switcher (profile, roles, memberships, events, photo) and the rail's account slot — about
 * sixteen reads each, a few hundred milliseconds after the page had read exactly the same
 * rows for the same person. 281 reads per visit of the board, most of them repeats.
 *
 * ── THE RULE ───────────────────────────────────────────────────────────────
 *   · Keyed by the VERIFIED user id (the caller passes `getCurrentUser().id`, which is
 *     checked with the auth server), and only ever holding what that person's own reads
 *     returned — one person's chrome can never be served to another.
 *   · Only a PREFETCH (`Next-Router-Prefetch: 1`) may reuse a snapshot. A page the person
 *     actually opens always reads fresh — and refreshes the snapshot — so a prefetch is never
 *     older than the page it was fired from (at most `SNAPSHOT_MS`).
 *   · Only a GOOD answer is kept: a read that failed, or that came back marked "not
 *     measured", is never replayed (`keep` says which answers are good).
 *   · Bounded: `MAX_ENTRIES` people, oldest out first. Per server instance; an instance that
 *     never saw the person simply reads, as before.
 *
 * Nothing here caches money or a permission check: the chrome only DRAWS (names, marks,
 * the switcher list, which rows the rail shows). Every page still gates on its own fresh read.
 * 🔒 lib/a-prefetch-reuses-the-chrome.test.ts
 */
async function isPrefetch(): Promise<boolean> {
  try {
    return (await headers()).get('next-router-prefetch') === '1';
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
