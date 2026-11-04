/**
 * 📶 THE SAVED COPY'S ADDRESSES — which addresses a copy may be kept for, and whose event each belongs to (EV3 +
 * "Your schedule"; the shapes are `OFFLINE_COPY_SHAPES` in `./offline-copies.ts`). Its own module because the guest's
 * Me shape asks the reserved-word list (`./reserved-slugs.ts`), which no page's client code needs — the shared bundle
 * has bytes of room (`scripts/check-bundle-size.mjs`). The server and the tests import this; `public/sw.js` holds a
 * COPY, and `app/sw-offline-copies.test.ts` runs both over one table.
 *
 * PURE — no I/O.
 */
import { OFFLINE_COPY_SHAPES } from './offline-copies';
import { RESERVED_SLUGS } from './reserved-slugs';

/** The guest's Me shape — its one capture is a slug, which must not be a reserved word (`lib/reserved-slugs.ts`). */
const GUEST_ME_SHAPE = OFFLINE_COPY_SHAPES[6];

/** True when `path` (a pathname, plus the query where the shape has one) is one of the shapes. */
export function isOfflineCopyPath(path: string): boolean {
  return offlineCopyEventId(path) !== undefined;
}

/**
 * The event a path belongs to — its event segment (a guest's Me: its slug) — or `null` for the supplier Hub, which is
 * the supplier's own page (it names no event, and it is kept under whichever event saved it). `undefined` = not a copy
 * path at all.
 */
export function offlineCopyEventId(path: string): string | null | undefined {
  for (const re of OFFLINE_COPY_SHAPES) {
    const m = re.exec(path);
    if (!m) continue;
    if (re === GUEST_ME_SHAPE && RESERVED_SLUGS.has(m[1] ?? '')) return undefined;
    return m[1] ?? null;
  }
  return undefined;
}

/** 📅 The guest's own day: Event Hub › Me. Its key in the registry is the slug (lower-case). */
export function guestMePath(slug: string): string | null {
  const s = slug.trim().toLowerCase();
  const path = `/${s}?tab=me`;
  return offlineCopyEventId(path) === s ? path : null;
}
