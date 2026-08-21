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

import { customColumnKey, CUSTOM_COLUMN_KEY_PREFIX } from './custom-columns';

// The RENDER-BLOCK identities of the reorderable content run — distinct from the
// EditorialSections visibility map (some share a key: kwento/watchFilm). The
// locked-close sections (couple's words + song) are NOT here: they pin to the end.
export type EditorialOrderKey =
  | 'chapters' // "As the Day Unfolded" / "Moments" (gated by the `gallery` toggle)
  | 'kwento' // "What They Whispered"
  | 'guestColumns' // "Letters to the Editor" (Guest Columns · GUEST_COLUMNS_ENABLED)
  | 'gallery' // "From the Day" photo gallery (gated by the `gallery` toggle)
  | 'fromVendors' // "From Your Vendors"
  | 'liveWall' // "Live Photo Wall"
  | 'videoGuestbook' // "Video Guestbook"
  | 'watchFilm' // "Watch the Film"
  | 'reviews' // "What They Said"
  | 'poweredBy' // "Powered by Setnayan"
  | 'vendorsWeLoved'; // "Vendors We Loved"

/**
 * A column the couple wrote themselves, as `custom:<id>`.
 *
 * 🔑 DELIBERATELY *NOT* A MEMBER OF `EditorialOrderKey`. The renderer builds a
 * `Record<EditorialOrderKey, ReactNode>` and relies on that record being
 * EXHAUSTIVE — add a template-literal member and the record needs an index
 * signature, which silently gives up the compiler check that every shipped
 * section has a node. The shipped set stays closed; the render order is the
 * union below.
 */
export type CustomColumnKey = `${typeof CUSTOM_COLUMN_KEY_PREFIX}${string}`;

/** What the resolver returns: a shipped section, or one of the couple's own. */
export type RenderOrderKey = EditorialOrderKey | CustomColumnKey;

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
  'guestColumns',
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
  /**
   * The ids of the couple's OWN columns, from `readCustomColumns(draft_json)`.
   *
   * 🔒 IT IS A WHITELIST, AND OMITTING IT MUST STAY SAFE. Every existing caller
   * passes nothing, so a `custom:` key keeps being dropped exactly as it is
   * today — a resolver that admitted the namespace on sight would render an
   * empty block for a column the couple had deleted, or for anything a
   * hand-written draft_json cared to name. The order list is not the record of
   * which columns exist; `customColumns` is. This says where they go.
   */
  customIds: readonly string[] = [],
): RenderOrderKey[] {
  const orderable = new Set<string>(EDITORIAL_ORDERABLE_KEYS);
  const customKeys = new Set<string>(customIds.map(customColumnKey));
  const out: RenderOrderKey[] = [];
  const seen = new Set<string>();
  for (const raw of saved ?? []) {
    if (typeof raw !== 'string') continue;
    if (seen.has(raw)) continue; // dupes
    // drops locked-close + unknown + a custom key with no column behind it
    if (!orderable.has(raw) && !customKeys.has(raw)) continue;
    seen.add(raw);
    out.push(raw as RenderOrderKey);
  }
  for (const key of EDITORIAL_ORDERABLE_KEYS) {
    if (!seen.has(key)) out.push(key);
  }
  // A column the couple wrote but never dragged has no saved position. It
  // appends after the shipped run rather than vanishing — the same rule the
  // shipped keys above already follow, for the same reason.
  for (const id of customIds) {
    const key = customColumnKey(id);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key as CustomColumnKey);
    }
  }
  return out;
}

/**
 * The shipped sections of a resolved order, with the couple's own columns
 * dropped.
 *
 * 🔑 THIS EXISTS BECAUSE THE COMPILER ASKED FOR IT. Widening the resolver's
 * return type made four call sites fail to typecheck — the gallery-anchor
 * chooser and its tests — and each one was a place that reasons about the
 * SHIPPED run and would have had to answer "what does a couple's column mean
 * here?" with a guess. It means nothing there. Narrowing at the boundary is the
 * honest answer, and it is checked rather than asserted.
 */
export function shippedSections(order: readonly RenderOrderKey[]): EditorialOrderKey[] {
  const shipped = new Set<string>(EDITORIAL_ORDERABLE_KEYS);
  return order.filter((k): k is EditorialOrderKey => shipped.has(k));
}
