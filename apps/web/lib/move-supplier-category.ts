/**
 * MOVE A SUPPLIER TO ANOTHER CATEGORY — what one move writes. (owner 2026-10-20)
 *
 * Owner, asked "Do you want a 'Move to another category' option for
 * suppliers?" → *"okay"*. The case: the couple typed in Dunkin' Donuts under
 * Everything else; it is really a Food Truck. #6706 let them TICK Food Truck as
 * "also covers" (so the card shows there again, "included with Everything
 * else"); nothing could change the row the card itself lives under.
 *
 * Pure, so the server action (`moveSupplierToCategory`) and the guard
 * (`lib/a-moved-supplier-is-drawn-once-under-its-new-row.test.ts`) run the SAME
 * plan — a test of a copy would prove the copy.
 *
 * What one move writes, and why each part:
 *   · `category` — `categoryForTile(target)`, the enum label the rest of the app
 *     (Budget's `bucketForVendor`, supplier access, the claim) keys on. Always
 *     plan-group-bucketable, by `categoryForTile`'s own invariant.
 *   · `category_key` — the target row itself, when the enum cannot name it (48
 *     of the 80 rows; Food Truck stores `misc`). `homeTileForRow` reads it back.
 *     Null when the enum alone already draws the target, so such a row is
 *     byte-for-byte what an add under that row writes today.
 *   · `covers` — "also covers" WITHOUT the new home (a row cannot also-cover
 *     itself; the keys taken off are returned so Undo can put them back) and
 *     WITHOUT the old home (owner brief: the old home is not auto-added; a key
 *     naming it can only be a budget-cost row's own group, never a tick).
 *
 * Price, payments, notes and the contact card are on the same `event_vendors`
 * row and are not touched — they move with it because the row is the booking.
 */

import {
  categoryForTile,
  homeTileForRow,
  tileForCategory,
  tileForCover,
} from '@/lib/shortlist-taxonomy';
import type { WeddingTile } from '@/lib/taxonomy';
import type { VendorCategory } from '@/lib/vendors';

export type SupplierMoveRow = {
  category: VendorCategory | string;
  category_key?: string | null;
  covers_plan_groups?: readonly string[] | null;
};

export type SupplierMovePlan = {
  /** The row it was drawn under before the move (null only for a raw DB category). */
  from: WeddingTile | null;
  to: WeddingTile;
  category: VendorCategory;
  category_key: string | null;
  covers: string[];
  /** "Also covers" keys taken off because they named the new home — Undo puts them back. */
  removedCovers: string[];
};

export function planSupplierMove(
  row: SupplierMoveRow,
  target: string,
  /** Keys to put back (Undo): each still validated by the caller; one naming the new home is dropped. */
  restoreCovers: readonly string[] = [],
): SupplierMovePlan | { refused: 'same_row' | 'no_target' } {
  const to = (typeof target === 'string' ? target.trim() : '') as WeddingTile;
  if (to.length === 0) return { refused: 'no_target' };
  const from = homeTileForRow(row);
  if (from === to) return { refused: 'same_row' };

  const category = categoryForTile(to);
  const category_key = tileForCategory(category) === to ? null : to;

  const covers: string[] = [];
  const removedCovers: string[] = [];
  const stored = Array.isArray(row.covers_plan_groups) ? row.covers_plan_groups : [];
  const restoring = new Set(restoreCovers);
  for (const key of [...stored, ...restoreCovers]) {
    if (typeof key !== 'string' || key.length === 0 || covers.includes(key)) continue;
    const t = tileForCover(key);
    if (t === to) {
      if (!removedCovers.includes(key) && stored.includes(key)) removedCovers.push(key);
      continue;
    }
    // The old home is implied, never a tick — unless Undo is handing back a
    // tick the move took off (moving off Food Truck puts its tick back).
    if (from && t === from && !restoring.has(key)) continue;
    covers.push(key);
  }
  return { from, to, category, category_key, covers, removedCovers };
}
