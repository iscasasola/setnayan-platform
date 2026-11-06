/**
 * tile-merge-forward.ts — AN OLD CATEGORY ID STILL LANDS ON ITS REPLACEMENT.
 *
 * The tile-side twin of `service-merge-forward.ts`. When an admin folds
 * category A into B, `merge_service_category()` moves every stored tile id we
 * hold and leaves A's row behind as a tombstone carrying
 * `service_categories.merged_into_category_id = B`. This module serves the ids
 * we DO NOT hold: a bookmarked `/explore?tile=`, a code constant
 * (`VENDOR_CATEGORY_CANONICAL`), a link emitted months ago.
 *
 * 🔑 THE READER SHIPS WITH THE WRITER, for the reason service-merge-forward.ts
 * records: a forwarding pointer nothing reads is indistinguishable from none.
 *
 * Pure — the same resolver as trades (unknown ids pass through unchanged, a
 * cycle terminates), so a category nobody merged can never be gated by it.
 */
import { resolveMergedService, type MergeForwardMap } from './service-merge-forward';

/** `old tile id` → `the tile it was merged into`. */
export type TileForwardMap = MergeForwardMap;

/** Resolve a possibly-merged tile id to the live one. Never a gate. */
export function resolveMergedTile(id: string, forwards: TileForwardMap | undefined): string {
  if (!forwards) return id;
  return resolveMergedService(id, forwards);
}

/** Build the map from raw `service_categories` rows. Pure. */
export function tileForwardMapFromRows(
  rows: readonly { id: string; merged_into_category_id?: string | null }[],
): TileForwardMap {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const to = r.merged_into_category_id;
    if (to && to !== r.id) out[r.id] = to;
  }
  return out;
}
