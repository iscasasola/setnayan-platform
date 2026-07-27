/**
 * bench-sort-persistence.ts — remember the couple's chosen bench lens
 * (Explore_Replan §13.3).
 *
 * Today the bench holds its sort in `useState<BenchSort>('fit')`: tab away or
 * reload and it snaps back to the default. A couple who works in "Nearest to
 * your venue" re-picks it every single session — a small daily annoyance that
 * costs nothing to remove.
 *
 * Per EVENT, not per account: a couple planning a Manila wedding and a Cebu
 * debut want different lenses, and the bench is already event-scoped.
 *
 * localStorage rather than a `?sort=` query param: the takeover is a
 * single-scroll surface with its own tab machinery, and a URL param would have
 * to be threaded through every internal navigation to survive. Storage is
 * read-once on mount (never during render) so there is no SSR/hydration
 * mismatch, and every access is caller-guarded — a private-mode browser that
 * throws on `localStorage` degrades to today's behaviour, never to an error.
 *
 * Pure + framework-free: no `window` access lives here, only the key and the
 * parse. That keeps it unit-testable and keeps the storage guard at the one
 * call site that owns it.
 */

import type { BenchSort } from '@/lib/bench-sort';

/** Namespaced so it cannot collide with any other `sn.*` preference. */
export function benchSortStorageKey(eventId: string): string {
  return `sn.bench.sort.${eventId}`;
}

/**
 * Validate a stored value back into a `BenchSort`.
 *
 * Returns null for anything unrecognised — a stale key from a removed lens, a
 * hand-edited value, or a null read — so the caller falls back to the default
 * rather than trusting client-writable storage.
 */
export function parseBenchSort(raw: string | null | undefined): BenchSort | null {
  return raw === 'fit' || raw === 'near' || raw === 'price' || raw === 'rating' ? raw : null;
}
