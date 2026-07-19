// ============================================================================
// Editorial section ORDER — pure, client-safe module (Editorial PRO)
// ============================================================================
//
// The reorderable-section registry + order resolver, kept OUT of data.ts because
// data.ts imports `server-only` (lib/uploads). The couple-dashboard editor is a
// CLIENT component and must import these runtime values without pulling the whole
// server-only data module into the browser bundle. data.ts re-exports everything
// here, so existing `from './data'` imports keep working.
//
// Nothing here touches the network, Supabase, or `server-only`; it's pure data +
// a total function, safe on both the client and the render path.
// ============================================================================

// The RENDER-BLOCK identities of the reorderable content run — distinct from the
// EditorialSections visibility map (some share a key: kwento/watchFilm). The
// locked-close sections (couple's words + song) are NOT here: they pin to the end.
export type EditorialOrderKey =
  | 'chapters' // "As the Day Unfolded" / "Moments" (gated by the `gallery` toggle)
  | 'kwento' // "What They Whispered"
  | 'gallery' // "From the Day" photo gallery (gated by the `gallery` toggle)
  | 'fromVendors' // "From Your Vendors"
  | 'liveWall' // "Live Photo Wall"
  | 'videoGuestbook' // "Video Guestbook"
  | 'watchFilm' // "Watch the Film"
  | 'reviews' // "What They Said"
  | 'poweredBy' // "Powered by Setnayan"
  | 'vendorsWeLoved'; // "Vendors We Loved"

/**
 * Canonical default order of the REORDERABLE content sections — the exact run
 * they render in today (fromTheCouple + song excluded: those pin to the end). A
 * saved draft_json.sectionOrder reorders WITHIN this set; unknown/missing keys
 * append in this default order so an older editorial (no sectionOrder) or a new
 * key added later never drops a section.
 */
export const EDITORIAL_ORDERABLE_KEYS: ReadonlyArray<EditorialOrderKey> = [
  'chapters',
  'kwento',
  'gallery',
  'fromVendors',
  'liveWall',
  'videoGuestbook',
  'watchFilm',
  'reviews',
  'poweredBy',
  'vendorsWeLoved',
];

/** The two locked-close keys, pinned to the end of the run in this order. They are
 *  NOT reorderable and must never appear in draft_json.sectionOrder (the editor
 *  never offers them and saveEditorial drops them defensively). */
export const EDITORIAL_LOCKED_CLOSE_KEYS = ['fromTheCouple', 'song'] as const;

/**
 * Resolve a saved sectionOrder into the full render order of the reorderable run:
 * saved known keys first (deduped, locked-close keys stripped), then any orderable
 * key not in the saved list appended in canonical order. `null`/empty → the plain
 * canonical order. Pure + total — safe on the render path.
 */
export function resolveSectionOrder(
  saved: readonly string[] | null | undefined,
): EditorialOrderKey[] {
  const orderable = new Set<string>(EDITORIAL_ORDERABLE_KEYS);
  const out: EditorialOrderKey[] = [];
  const seen = new Set<string>();
  for (const raw of saved ?? []) {
    if (typeof raw !== 'string') continue;
    if (!orderable.has(raw) || seen.has(raw)) continue; // drops locked-close + unknown + dupes
    seen.add(raw);
    out.push(raw as EditorialOrderKey);
  }
  for (const key of EDITORIAL_ORDERABLE_KEYS) {
    if (!seen.has(key)) out.push(key);
  }
  return out;
}
