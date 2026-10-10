/**
 * supplier-sheet-ask.ts — ONE INQUIRY, EVERY CATEGORY TICKED.
 *
 * Owner, 2026-10-10: "when they inquire, we also show what other categories
 * they offer. so when they inquire, they will inquire for all the categories
 * they want to know. it will be counted as 1 inquiry."
 *
 * The supplier sheet lists a supplier's other categories ("The rest of their
 * portfolio"). The couple ticks the ones they want to know about and presses
 * the sheet's one ask button; this module turns those ticks into the service
 * cards the ONE inquiry carries (`startServiceInquiry`'s `alsoServiceIds`, each
 * recorded as a `thread_service_interests` row on the one thread).
 *
 * PURE, and the SAME reading the sheet's list was built from: `sheetOthers`
 * shows a category because one of the supplier's active cards resolves to it
 * here, so a row the couple could tick always has a card to carry — unless the
 * supplier switched it off in between, which is reported, never dropped.
 *
 * Server files only (the sheet's read, the inquiry action): it carries the
 * whole taxonomy map, which the sheet's own bundle must not.
 */
import { TAXONOMY_MAP, WEDDING_TILE_LABEL, type WeddingTile } from '@/lib/taxonomy';
import type { SheetOther } from '@/lib/supplier-sheet';

/** A service card's category → the Suppliers-page row it sits under, or null
 *  when it has none (left out rather than guessed). */
export function sheetOtherForCategory(category: string): SheetOther | null {
  const tile = TAXONOMY_MAP[category]?.tile ?? (category in WEDDING_TILE_LABEL ? (category as WeddingTile) : null);
  return tile ? { tile, label: WEDDING_TILE_LABEL[tile] } : null;
}

/** One of the supplier's ACTIVE service cards. */
export type AskCard = {
  vendor_service_id: string;
  category: string | null;
  created_at: string | null;
};

/**
 * The card each ticked category is asked about: the supplier's EARLIEST active
 * card in that category (then by id) — the same "first active card" the anchor
 * of an inquiry has always meant, and the same order the sheet lists them in.
 *
 *   · a category ticked twice is asked once;
 *   · a category whose card IS the anchor is already in the inquiry — skipped,
 *     not an error;
 *   · a category with no active card any more comes back in `unresolved`, so
 *     the caller can say so instead of sending an inquiry that quietly leaves
 *     out something the couple ticked.
 */
export function serviceIdsForTickedTiles(
  cards: readonly AskCard[],
  tiles: readonly string[],
  anchorServiceId: string,
): { serviceIds: string[]; unresolved: string[] } {
  const ordered = [...cards].sort((a, b) => {
    const at = a.created_at ?? '';
    const bt = b.created_at ?? '';
    if (at !== bt) return at < bt ? -1 : 1;
    return a.vendor_service_id < b.vendor_service_id ? -1 : a.vendor_service_id > b.vendor_service_id ? 1 : 0;
  });
  const firstByTile = new Map<string, string>();
  for (const c of ordered) {
    if (!c.category) continue;
    const tile = sheetOtherForCategory(c.category)?.tile;
    if (tile && !firstByTile.has(tile)) firstByTile.set(tile, c.vendor_service_id);
  }
  const serviceIds: string[] = [];
  const unresolved: string[] = [];
  for (const tile of new Set(tiles.map((t) => String(t).trim()).filter(Boolean))) {
    const id = firstByTile.get(tile);
    if (!id) unresolved.push(tile);
    else if (id !== anchorServiceId && !serviceIds.includes(id)) serviceIds.push(id);
  }
  return { serviceIds, unresolved };
}
