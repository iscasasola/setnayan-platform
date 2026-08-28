/**
 * service-merge-forward.ts — AN OLD TRADE KEY STILL LANDS ON ITS REPLACEMENT.
 *
 * When an admin folds trade A into trade B, `merge_canonical_service()` moves
 * every stored key we hold and leaves A's taxonomy row behind as a tombstone
 * carrying `merged_into = B`. Our own rows are therefore already correct — this
 * module exists for the keys we DO NOT hold:
 *
 *   · a printed QR or a save-the-date carrying `/explore?category=sorbetes_cart`
 *   · a bookmark, an emailed link, a link on somebody else's site
 *   · a link we emitted ourselves months ago
 *
 * Without a reader those all land on an empty marketplace, which reads as
 * "nobody does this" rather than "we renamed it".
 *
 * 🔑 WHY THIS FILE EXISTS AT ALL, AND WHY THE READER SHIPS IN THE SAME CHANGE
 * AS THE WRITER. This repo has already paid for the other order once: slug
 * forwarding for renamed web addresses was written, two screens promised it,
 * and NOTHING READ THE LEDGER FOR MONTHS — the only reader returned null on its
 * first line behind a flag that was never on. A forwarding pointer with no
 * reader is indistinguishable from no forwarding at all, and it looks finished.
 *
 * ⚠ SEPARATELY: `service_categories.merged_into_category_id` (added 2026-08-03)
 * is NOT this. That column is on the table holding tier-1 folders and tier-2
 * tiles — read out of prod, there is no tier 3 — so it can forward a BRANCH and
 * never a TRADE. It still has zero writers and zero readers. Do not confuse the
 * two; they point at different things.
 */

/** `old canonical key` → `the trade it was merged into`. */
export type MergeForwardMap = Readonly<Record<string, string>>;

/** A chain longer than this is corrupt data, not a deep merge. */
const MAX_HOPS = 8;

/**
 * Resolve a possibly-merged trade key to the live one.
 *
 * `merge_canonical_service()` re-points existing forwards at write time, so a
 * chain should never exceed one hop. This still walks — and still refuses to
 * loop — because the column is hand-editable in SQL and a reader that spins on
 * a cycle takes the marketplace down with it. Unknown keys are returned
 * UNCHANGED: this must never be a gate. A key we have no opinion about is the
 * caller's business, exactly as it is today.
 */
export function resolveMergedService(key: string, forwards: MergeForwardMap): string {
  let current = key;
  const seen = new Set<string>([current]);
  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    const next = forwards[current];
    if (!next || next === current) return current;
    // A cycle (a→b→a) — stop on the key we have rather than spin. Returning the
    // current key degrades to "no forwarding", which is today's behaviour.
    if (seen.has(next)) return current;
    seen.add(next);
    current = next;
  }
  return current;
}

/** True when this key was merged away and should no longer be offered anywhere. */
export function isMergedAway(key: string, forwards: MergeForwardMap): boolean {
  return Boolean(forwards[key]);
}

/** Build the map from raw rows. Pure, so the guard can exercise it with no DB. */
export function forwardMapFromRows(
  rows: readonly { canonical_service: string; merged_into: string | null }[],
): MergeForwardMap {
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.merged_into && r.merged_into !== r.canonical_service) {
      out[r.canonical_service] = r.merged_into;
    }
  }
  return out;
}
