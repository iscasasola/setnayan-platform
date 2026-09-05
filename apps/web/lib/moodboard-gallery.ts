/**
 * lib/moodboard-gallery.ts — THE SUPPLIER GALLERY CHAIN (MB10).
 *
 * One photo, three places it has to stay itself:
 *
 *   moodboard_library_assets   a supplier's own portfolio shot, tagged with the
 *   (asset_type =              inspiration slot it belongs in and the shop that
 *    'supplier_gallery')       owns it
 *          │  the couple picks it
 *          ▼
 *   event_inspiration_assets   the board tile, carrying library_asset_id and
 *   (source_kind =             source_kind = 'gallery_pick' — so the credit
 *    'gallery_pick')           survives the copy
 *          │  counted per shop
 *          ▼
 *   the vendor list            "You saved 2 of their photos"
 *
 * That third step is the point of the other two. A gallery whose photos cannot
 * be traced back to a shop is a stock-photo library; the reason a florist
 * uploads at all is that the couple who saves their bouquet can find them.
 *
 * ── THE SLOT → TRADE MAP IS A LOOKUP, NOT A LIST ───────────────────────────
 * `lib/taxonomy.ts` already carries every trade — `florist`, `cake`,
 * `stylist_decorator`, `brides_attire`, `filipiniana_barongs`, all of it. So
 * MOODBOARD_SLOT_TRADES names TILE KEYS from that union and nothing else:
 *
 *   · the `Record<MoodboardSlotKey, …>` makes a new inspiration slot a COMPILE
 *     ERROR until somebody says which trades supply it (the same mechanism
 *     lib/moodboard-render-parts.ts uses for render parts);
 *   · every value is typed `WeddingTile`, so renaming or removing a tile in
 *     taxonomy.ts fails `tsc --noEmit` here instead of silently emptying a
 *     picker;
 *   · the canonical service keys underneath a tile are DERIVED
 *     (canonicalServicesForSlot → canonicalServicesForTile), never restated.
 *     MB11's upload gate reads that function; a second hand-kept list of
 *     "trades that may upload" is exactly the drift this avoids.
 *
 * ⚠ AN EMPTY ARRAY IS AN ANSWER. `palette` has no supplying trade — a colour
 * reference is not anybody's portfolio — and the picker renders no button for
 * it rather than an empty shelf. Guessing a trade would be worse than silence:
 * it would send a couple to florists for a paint chip.
 */

import { MOODBOARD_SLOT_KEYS, type MoodboardSlotKey } from './moodboard-slots';
import { WEDDING_TILE_LABEL, type WeddingTile } from './taxonomy';
import { canonicalServicesForTile } from './vendor-counts';

/**
 * `moodboard_library_assets.asset_type` for a supplier's own portfolio photo.
 *
 * DEFINED in lib/moodboard-gallery-pure.ts and re-exported here so every server
 * caller keeps its import path. The literal moved because MB11's upload FORM is
 * a client component and this module reaches `lib/supabase/admin.ts` through
 * the taxonomy — the boundary this file's closing note already warns about.
 */
export { SUPPLIER_GALLERY_ASSET_TYPE } from './moodboard-gallery-pure';

/**
 * Which marketplace trades supply each inspiration slot.
 *
 * Ordered MOST characteristic first: the first tile a shop matches is the one
 * printed on the credit, so `flowers` leads with `florist` and `table` leads
 * with `stylist_decorator` (a stylist dresses the table; a florist supplies
 * one thing on it).
 */
export const MOODBOARD_SLOT_TRADES: Readonly<
  Record<MoodboardSlotKey, readonly WeddingTile[]>
> = {
  // ── the place ──
  venue: ['ceremony_venue'],
  reception_venue: ['reception'],
  // ── what the room is dressed with ──
  backdrop: ['stylist_decorator', 'led_wall'],
  tunnel: ['stylist_decorator'],
  stage: ['stylist_decorator', 'av_production', 'lights_sound'],
  table: ['stylist_decorator', 'florist'],
  ceiling: ['stylist_decorator', 'lights_sound'],
  flowers: ['florist', 'stylist_decorator'],
  cocktail: ['mobile_bar', 'mocktail', 'coffee_espresso'],
  cake: ['cake', 'dessert'],
  overall: ['reception', 'stylist_decorator', 'lights_sound', 'coordinator'],
  // 🔑 NOT A TRADE. A palette source is a photo the couple sampled colours
  // from — a wall, a fabric, a sunset. No shop's portfolio answers it.
  palette: [],
  // ── what people wear. HMUA rides with `bride` because a bridal-hair photo
  //    and a gown photo are the same picture. ──
  bride: ['brides_attire', 'filipiniana_barongs', 'hmua'],
  groom: ['grooms_attire', 'mens_attire', 'filipiniana_barongs'],
  principal_sponsor: ['womens_attire', 'mens_attire', 'filipiniana_barongs'],
  entourage: ['womens_attire', 'mens_attire', 'filipiniana_barongs'],
  parents: ['womens_attire', 'mens_attire', 'filipiniana_barongs'],
  guests: ['womens_attire', 'mens_attire', 'filipiniana_barongs'],
};

/** The trades that supply a slot — empty when no shop's portfolio answers it. */
export function tradesForSlot(slot: string): readonly WeddingTile[] {
  return MOODBOARD_SLOT_TRADES[slot as MoodboardSlotKey] ?? [];
}

/** TRUE when a supplier gallery is meaningful for this slot at all. */
export function slotHasSupplierTrade(slot: string): boolean {
  return tradesForSlot(slot).length > 0;
}

/** Every inspiration slot a supplier gallery can exist for — derived. */
export const GALLERY_SLOT_KEYS: readonly MoodboardSlotKey[] = MOODBOARD_SLOT_KEYS.filter(
  (k) => MOODBOARD_SLOT_TRADES[k].length > 0,
);

/**
 * The canonical service keys a slot's trades cover, de-duped.
 *
 * DERIVED from the tiles above via lib/vendor-counts. MB11's "which trades may
 * upload to this slot" gate reads exactly this — never its own copy.
 */
export function canonicalServicesForSlot(slot: string): string[] {
  const out = new Set<string>();
  for (const tile of tradesForSlot(slot)) {
    for (const canonical of canonicalServicesForTile(tile)) out.add(canonical);
  }
  return [...out];
}

/**
 * The trade printed after a shop's name — "Bloom & Vine · Florist".
 *
 * Resolved from the SHOP's own `vendor_profiles.services[]` intersected with
 * the slot's trades, in the slot's order, so the label names the trade that is
 * actually why this photo is here. Two deliberate refusals:
 *
 *   · a shop whose services do not reach this slot's trades gets NO trade
 *     label — never the slot's first tile as a stand-in. Printing "Florist"
 *     under a caterer because the photo sat in the flowers slot is a
 *     fabrication, and it is the kind nobody would ever notice.
 *   · a shop with no services at all gets no label either. `null` means "we
 *     do not know this shop's trade", and the credit then renders as the name
 *     alone — which is true.
 */
export function tradeLabelForCredit(
  slot: string,
  vendorServices: readonly string[] | null | undefined,
): string | null {
  if (!vendorServices || vendorServices.length === 0) return null;
  const owned = new Set<WeddingTile>();
  for (const canonical of vendorServices) {
    for (const tile of tradesForSlot(slot)) {
      if (canonicalServicesForTile(tile).includes(canonical)) owned.add(tile);
    }
  }
  for (const tile of tradesForSlot(slot)) {
    if (owned.has(tile)) return WEDDING_TILE_LABEL[tile];
  }
  return null;
}

/** "Bloom & Vine · Florist", or just the name when the trade is unknown. */
export function creditLine(shopName: string, tradeLabel: string | null): string {
  const name = shopName.trim();
  if (!name) return tradeLabel ?? '';
  return tradeLabel ? `${name} · ${tradeLabel}` : name;
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGING — capped, and capped on the SERVER
   ══════════════════════════════════════════════════════════════════════════

   🛑 THE UNBOUNDED QUERY IS THE THING THIS SESSION WAS WARNED ABOUT TWICE.
   `template-gallery.tsx` used to receive the ENTIRE moodboard_theme_templates
   table as a prop — survivable at 100 rows, a real cost at 2,600 — and PR
   #5113 had to kill it. The supplier gallery grows with every shop that
   uploads, i.e. faster and with no ceiling anybody controls.

   So the cap is not a client-supplied `limit` the caller may or may not pass:
   `normalizeGalleryQuery` clamps whatever arrives (including nothing, NaN,
   Infinity and a negative) and the server action puts its result through
   `.range()` unconditionally. A client that asks for a million rows gets
   GALLERY_MAX_LIMIT. There is no code path that reads the table unbounded.
*/

/** ~6 photos a screen — the same "about six large choices" the theme gallery uses. */
export const GALLERY_PAGE_SIZE = 6;

/** Hard ceiling on one page, whatever the caller asks for. */
export const GALLERY_MAX_LIMIT = 24;

/** Hard ceiling on how deep "Show more" can walk. */
export const GALLERY_MAX_OFFSET = 600;

export type GalleryQuery = {
  slotKey: MoodboardSlotKey;
  limit: number;
  offset: number;
};

/**
 * Clamp an untrusted page request. `null` = this slot has no supplier trade,
 * or the key is not a slot at all — the caller must not query.
 */
export function normalizeGalleryQuery(input: {
  slotKey?: unknown;
  limit?: unknown;
  offset?: unknown;
}): GalleryQuery | null {
  const slotKey = input.slotKey;
  if (typeof slotKey !== 'string') return null;
  if (!(MOODBOARD_SLOT_KEYS as readonly string[]).includes(slotKey)) return null;
  if (!slotHasSupplierTrade(slotKey)) return null;

  const rawLimit = Number(input.limit ?? GALLERY_PAGE_SIZE);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(GALLERY_MAX_LIMIT, Math.max(1, Math.floor(rawLimit)))
    : GALLERY_PAGE_SIZE;

  const rawOffset = Number(input.offset ?? 0);
  const offset = Number.isFinite(rawOffset)
    ? Math.min(GALLERY_MAX_OFFSET, Math.max(0, Math.floor(rawOffset)))
    : 0;

  return { slotKey: slotKey as MoodboardSlotKey, limit, offset };
}

/** One browsable supplier photo, already credited server-side. */
export type GalleryAsset = {
  assetId: string;
  imageUrl: string;
  /** Free-text label the supplier gave the photo; may be empty. */
  label: string;
  /** "Bloom & Vine · Florist" — never empty, never fabricated. */
  credit: string;
  /** So a couple can walk from the photo to the shop. */
  vendorProfileId: string;
  /** The 6 sampled colours written onto the board row when this is picked. */
  swatches: string[];
  /**
   * TRUE for a photo delivered on a celebration the shop was actually booked
   * for; FALSE for the shop's own back-catalogue (MB22). Read off the
   * `is_event_linked` generated column — never `source_event_id` itself,
   * which stays revoked from the couple-facing client (MB11, see
   * migration 20271204967268's header for why a boolean is safe where the
   * raw event id is not).
   */
  isEventLinked: boolean;
};

export type GalleryPage = {
  /** The showable photos in this page — never every approved row (see below). */
  assets: GalleryAsset[];
  /** Approved, un-retired gallery rows for this slot. The paging denominator. */
  total: number;
  /**
   * 🔑 THE SECOND ZERO. Rows inside the range we fetched that we deliberately
   * did NOT show, for one of two reasons:
   *
   *   · the SHOP is not publicly readable — `vendor_profiles`' public policy
   *     wants `public_visibility = 'verified' AND verification_state =
   *     'verified'`, so an unapproved shop's photo comes back with a null
   *     embed. An uncredited gallery photo is a stock photo, and showing it
   *     would break the only promise the gallery makes;
   *   · the asset carries NO sampled colours, so there is nothing honest to
   *     write into the board row's six NOT NULL `sampled_hex_*` columns. The
   *     apply-a-template path already refuses this case for the same reason
   *     ("no real color to write — skip, don't invent one"), and the Canvas
   *     extractor cannot rescue it: a cross-origin image taints the canvas and
   *     `extractPaletteFromImage` then returns CREAM DEFAULTS rather than
   *     throwing — a fabricated palette that renders exactly like a real one.
   *
   * `total > 0` with an empty `assets` is therefore a real and different
   * answer from `total === 0`, and the picker says something different for
   * each. Collapsing them tells a couple "no supplier has added photos" while
   * suppliers have.
   */
  withheld: number;
  offset: number;
  limit: number;
  /** Offset paging, NOT `assets.length` — a page may legitimately drop rows. */
  hasMore: boolean;
};

/** A row as the gallery query returns it, before shaping. */
export type RawGalleryRow = {
  asset_id: string;
  label: string | null;
  storage_path: string;
  vendor_profile_id: string | null;
  /** The embedded shop. `null` when RLS refused it — see GalleryPage.withheld. */
  shop: { business_name: string | null; services: string[] | null } | null;
  ranges: ReadonlyArray<{ slot_id: number; sampled_hex: string }>;
  /** The generated column, not `source_event_id` — see GalleryAsset.isEventLinked. */
  is_event_linked: boolean | null;
};

/**
 * Shape one fetched range into showable photos, and count what was withheld.
 *
 * PURE — no Supabase, so every withholding rule unit-tests in milliseconds.
 * The six hexes are the asset's own sampled colours in slot order, cycled to
 * six when it carries fewer (the same `i % length` fill the template path
 * uses); a row with none is withheld rather than padded with invented colour.
 */
export function shapeGalleryPage(
  slot: string,
  rows: readonly RawGalleryRow[],
): { assets: GalleryAsset[]; withheld: number } {
  const assets: GalleryAsset[] = [];
  let withheld = 0;
  for (const row of rows) {
    const vendorProfileId = row.vendor_profile_id;
    const shopName = row.shop?.business_name?.trim() ?? '';
    if (!vendorProfileId || !shopName) {
      withheld += 1;
      continue;
    }
    const hexes = [...row.ranges]
      .sort((a, b) => a.slot_id - b.slot_id)
      .map((r) => r.sampled_hex);
    if (hexes.length === 0) {
      withheld += 1;
      continue;
    }
    assets.push({
      assetId: row.asset_id,
      imageUrl: row.storage_path,
      label: row.label?.trim() ?? '',
      credit: creditLine(shopName, tradeLabelForCredit(slot, row.shop?.services ?? null)),
      vendorProfileId,
      swatches: Array.from({ length: 6 }, (_, i) => hexes[i % hexes.length]!),
      isEventLinked: row.is_event_linked === true,
    });
  }
  return { assets, withheld };
}

/* ══════════════════════════════════════════════════════════════════════════
   THE MARKER — "You saved 2 of their photos"
   ══════════════════════════════════════════════════════════════════════════ */

/** One board row's provenance, as the tally reads it. */
export type SavedGalleryRow = {
  library_asset_id: string | null;
  vendor_profile_id: string | null;
};

/**
 * Count this event's saved gallery photos per shop.
 *
 * Rows with no provenance (the couple's own uploads) and rows whose asset has
 * no shop are skipped rather than bucketed under a blank key — a shop keyed on
 * '' would collect every uncredited photo in the event and then print the total
 * against whichever vendor happened to have no id.
 */
export function tallySavedGalleryPhotos(
  rows: readonly SavedGalleryRow[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) {
    if (!row.library_asset_id) continue;
    const vendor = row.vendor_profile_id;
    if (!vendor) continue;
    out.set(vendor, (out.get(vendor) ?? 0) + 1);
  }
  return out;
}

/**
 * ⚠ THE MARKER'S COPY LIVES IN THE COMPONENT, NOT HERE — see
 * `app/dashboard/[eventId]/vendors/_components/saved-photo-marker.tsx`.
 * This module imports `lib/taxonomy.ts` (a ~1,300-line constant map) for the
 * slot→trade lookup, and the marker is rendered by a CLIENT component: an
 * import of one four-line string helper from here would drag the whole vendor
 * taxonomy into the browser bundle. Everything this module exports is either
 * server-side or a `type` (erased at build), and it must stay that way.
 */
