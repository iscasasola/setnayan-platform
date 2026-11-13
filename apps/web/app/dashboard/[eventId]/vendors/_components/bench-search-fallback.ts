/**
 * 🔎 WHEN THE SHORTLIST HAS NO MATCH (walk 13 Nov 2026). The Suppliers box searched the couple's own shortlist only:
 * "SetnaProd" (a real marketplace shop) and "Mobile bar" (a real category, not yet on the event) both offered nothing
 * but "Add … as your own supplier". Below "Nothing in your shortlist matches" the bench now also offers:
 *
 *   · the CATEGORIES not on the event whose name matches — pressed, the same as the "Add a category" picker
 *     (`restoreTileToPlan` → its row opens);
 *   · the marketplace SHOPS whose name matches — the shipped whole-marketplace read (`searchMarketplaceForBench`, the
 *     findable rule and the demo scope included) — pressed, the shop's category row opens and searches it by name, so
 *     its card and its "Ask for a quote" are right there. Nothing leaves the page (owner 2026-10-24).
 *
 * PURE — the bench draws, this decides.
 */

/** At most this many category rows under the line. */
export const CATEGORY_HITS_MAX = 4;

/** Categories (not on the event) whose name holds every typed word, in the list's own order. */
export function categoryHitsFor<T extends { label: string }>(query: string, rows: readonly T[]): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return rows.filter((r) => words.every((w) => r.label.toLowerCase().includes(w))).slice(0, CATEGORY_HITS_MAX);
}

/**
 * The category row a shop hit opens: the first of its services already on the event, else the first this page can
 * draw at all. Null when the page draws none of them (the hit is then not offered — never a dead row).
 */
export function shopHitTile(
  shopTiles: readonly string[] | null | undefined,
  onEvent: ReadonlySet<string>,
  onPage: ReadonlySet<string>,
): string | null {
  const tiles = (shopTiles ?? []).filter(Boolean);
  return tiles.find((t) => onEvent.has(t)) ?? tiles.find((t) => onPage.has(t)) ?? null;
}
