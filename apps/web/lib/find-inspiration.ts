/**
 * find-inspiration.ts — 💡 THE INSPIRATION BOX IN SUPPLIERS › FIND, its pure rules (owner 2026-10-29, live: *"where
 * are the inspiration box"*; approved prototype "Find at scale" v2 — each open category carries a Services ·
 * Inspiration switch, and Inspiration is that category's supplier photos grouped by PART).
 *
 * Rulings: DECISION_LOG 2026-10-28 "INSPIRATION LIVES IN SUPPLIERS › FIND" and "INSPIRATION IN FIND — FINAL FRAMES
 * A–F APPROVED"; plan `EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` row 11 (R5); 2026-10-26 taxonomy — a PART hangs off
 * the supplier taxonomy and lives in Admin › Categories (`inspiration_parts` + `inspiration_part_services`), read by
 * `getInspirationParts()`. ONE SOURCE: nothing here names a part.
 *
 * 🔑 NO NEW READ AT OPEN. The parts of every category are worked out ONCE on the page's server render from the
 * snapshot the page already reads; opening a category or switching to Inspiration asks for nothing until the first
 * photos are needed — and then ONE ranged read per 24 over every part of that category (`fetchGalleryAssets`'
 * `slotKeys`), kept for the visit.
 */
import { partCategories, type InspirationPartsSnapshot } from './inspiration-parts';

/** One part a category's Inspiration box offers — key + the admin's own label. */
export type FindInspirationPart = { slotKey: string; label: string };

/** The two views of an open category (the prototype's `Services · Inspiration`). */
export const FIND_CATEGORY_VIEWS = ['services', 'inspiration'] as const;
export type FindCategoryView = (typeof FIND_CATEGORY_VIEWS)[number];

/**
 * Photos per page — the prototype's "24 at a time", which is also the gallery read's own ceiling
 * (`GALLERY_MAX_LIMIT` in `lib/moodboard-gallery.ts`; not imported — that module reaches the server taxonomy and this
 * one is read by a client component. `find-inspiration.test.ts` holds the two equal).
 */
export const FIND_INSPIRATION_PAGE = 24;

/** "All parts" in the Part ▾ menu. */
export const ALL_PARTS = '*';

/**
 * Every category's parts, from the snapshot (pure). A part belongs to a category when the category is one of the
 * categories that supply it (`partCategories` — home first, then "also from"); hidden and system parts are never
 * offered. Ordered by the admin's sort order. A category with no part is absent — it draws no switch.
 */
export function findInspirationPartsByTile(
  snapshot: InspirationPartsSnapshot,
  tiles?: readonly string[],
): Record<string, FindInspirationPart[]> {
  const want = tiles ? new Set(tiles) : null;
  const out: Record<string, FindInspirationPart[]> = {};
  const parts = [...snapshot.parts].filter((p) => p.kind === 'part' && !p.hidden).sort((a, b) => a.sortOrder - b.sortOrder);
  for (const p of parts) {
    for (const tile of partCategories(p)) {
      if (want && !want.has(tile)) continue;
      (out[tile] ??= []).push({ slotKey: p.slotKey, label: p.label });
    }
  }
  return out;
}

/** The part keys one read asks for: the picked part, or every part of the category (pure). */
export function inspirationReadKeys(parts: readonly FindInspirationPart[], picked: string): string[] {
  if (picked !== ALL_PARTS && parts.some((p) => p.slotKey === picked)) return [picked];
  return parts.map((p) => p.slotKey);
}

/** The visit cache's key for one page of one category's photos (pure). */
export function inspirationPageKey(eventId: string, tile: string, keys: readonly string[], offset: number): string {
  return `${eventId}|${tile}|${keys.join(',')}|${offset}`;
}

/** The count line under the Part ▾ row — honest: an unread total says nothing rather than "0". */
export function inspirationCountLine(total: number | null, partLabel: string | null, categoryLabel: string): string {
  if (total == null) return '';
  const what = total === 1 ? 'photo' : 'photos';
  return partLabel ? `${total} ${what} · ${partLabel}` : `${total} ${what} · ${categoryLabel}`;
}
