/**
 * Couple-side `vendor_category` ↔ canonical marketplace taxonomy bridge.
 *
 * The couple-side `event_vendors.category` column uses the legacy
 * `VendorCategory` vocabulary (lib/vendors.ts) — a coarse, couple-facing list
 * that predates the 10-parent / ~53-tile marketplace taxonomy (lib/taxonomy.ts
 * · service_categories). This module is the single source of truth that anchors
 * every couple-side category to that canonical taxonomy, so the couple side
 * "relies on" the same tree the marketplace + onboarding read.
 *
 * Three buckets (owner directive 2026-06-04 — "study the mapping, validate the
 * ones that need the validation of our taxonomy"):
 *
 *   A · clean 1:1    — the couple-side category is exactly one canonical tile
 *                      (photographer → Photo & Video). Anchored.
 *   B · coarse alias — one couple-side category spans several canonical tiles
 *                      (band_dj → Live Band + DJ; transportation → Bridal Car +
 *                      Guest Shuttle). Kept coarse couple-side, mapped
 *                      many-to-one.
 *   C · couple-only  — no marketplace equivalent, so EXEMPT from anchoring:
 *                        • officiant   — auto-resolves from the ceremony venue
 *                                        (marketplaceHidden in the canonical map)
 *                        • church_fees — a budget line, not a bookable vendor
 *                        • security    — no canonical tile exists for it
 *                        • misc        — catch-all bucket
 *
 * Drift protection is COMPILE-TIME first: the `Record<VendorCategory, …>` forces
 * every category to be classified (a new VendorCategory fails the build until
 * it's mapped), and every tile is typed to `WeddingTile`, so a renamed/removed
 * tile key fails `tsc --noEmit`. `validateVendorCategoryMapping()` adds the
 * RUNTIME check against the live DB snapshot — it catches an admin deleting or
 * re-keying a tile the couple-side still points to, which types alone can't see.
 */
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from './vendors';
import type { WeddingTile } from './taxonomy';
import type { TaxonomySnapshot } from './taxonomy-db';

/** Why a couple-side category has no marketplace tile (bucket C). */
export type ExemptReason =
  | 'auto_resolves_from_venue' // officiant — resolved from the ceremony venue
  | 'budget_line_not_vendor' //   church_fees — a cost line, not a vendor
  | 'no_canonical_tile' //         security — no marketplace tile exists
  | 'catch_all'; //                misc — generic bucket

export type CanonicalMapping =
  | { readonly kind: 'tile'; readonly tile: WeddingTile } // A
  | { readonly kind: 'tiles'; readonly tiles: readonly WeddingTile[] } // B
  | { readonly kind: 'exempt'; readonly reason: ExemptReason }; // C

/**
 * Authoritative couple-side → canonical mapping. Exhaustive over VendorCategory
 * (the Record enforces it) and tile-typed (the literal union enforces it), so
 * any divergence between the two vocabularies is a compile error, not a silent
 * runtime drift.
 */
export const VENDOR_CATEGORY_CANONICAL: Record<VendorCategory, CanonicalMapping> = {
  // ── A · clean 1:1 ──────────────────────────────────────────────────────────
  venue: { kind: 'tile', tile: 'reception' },
  religious_venue: { kind: 'tile', tile: 'ceremony_venue' },
  catering: { kind: 'tile', tile: 'catering' },
  photographer: { kind: 'tile', tile: 'photo_video' },
  videographer: { kind: 'tile', tile: 'photo_video' },
  florist: { kind: 'tile', tile: 'florist' },
  cake_maker: { kind: 'tile', tile: 'cake' },
  host_emcee: { kind: 'tile', tile: 'host_mc' },
  choir: { kind: 'tile', tile: 'choir' },
  // string_quartet + hair_stylist fold into a single broader canonical tile
  // (Choir / HMUA) — coarse couple-side, but a clean one-tile anchor.
  string_quartet: { kind: 'tile', tile: 'choir' },
  hair_stylist: { kind: 'tile', tile: 'hmua' },
  planner_coordinator: { kind: 'tile', tile: 'coordinator' },
  makeup_artist: { kind: 'tile', tile: 'hmua' },
  gown_designer: { kind: 'tile', tile: 'brides_attire' },
  suit_designer: { kind: 'tile', tile: 'grooms_attire' },
  rings: { kind: 'tile', tile: 'jewelleries_accessories' },
  invitations_stationery: { kind: 'tile', tile: 'printing' },
  lights_and_sound: { kind: 'tile', tile: 'lights_sound' },
  led_screens: { kind: 'tile', tile: 'led_wall' },
  photobooth: { kind: 'tile', tile: 'photo_booth' },
  mobile_bar: { kind: 'tile', tile: 'mobile_bar' },
  reception_decor: { kind: 'tile', tile: 'stylist_decorator' },
  gifts_and_giveaways: { kind: 'tile', tile: 'souvenir_giveaways' },
  accommodation: { kind: 'tile', tile: 'reception' },
  // ── B · coarse alias (many-to-one — genuinely spans tiles) ──────────────────
  band_dj: { kind: 'tiles', tiles: ['live_band', 'dj'] },
  transportation: { kind: 'tiles', tiles: ['bridal_car', 'guest_shuttle'] },
  // ── C · couple-only (exempt — no marketplace tile) ──────────────────────────
  officiant: { kind: 'exempt', reason: 'auto_resolves_from_venue' },
  church_fees: { kind: 'exempt', reason: 'budget_line_not_vendor' },
  security: { kind: 'exempt', reason: 'no_canonical_tile' },
  misc: { kind: 'exempt', reason: 'catch_all' },
};

/**
 * The canonical tile(s) a couple-side category surfaces under — ready to drive
 * a "shop this category" deep-link from the couple's vendor list into the
 * marketplace. Empty for exempt (bucket C) categories.
 */
export function tilesForVendorCategory(category: VendorCategory): WeddingTile[] {
  const m = VENDOR_CATEGORY_CANONICAL[category];
  if (m.kind === 'tile') return [m.tile];
  if (m.kind === 'tiles') return [...m.tiles];
  return [];
}

/** True when the couple-side category has no marketplace equivalent (bucket C). */
export function isExemptVendorCategory(category: VendorCategory): boolean {
  return VENDOR_CATEGORY_CANONICAL[category].kind === 'exempt';
}

/**
 * The PRIMARY canonical tile a couple-side category anchors to — the single
 * tier-2 `service_categories.id` written to `event_vendors.category_key` (the
 * taxonomy-keyed column, migration 20260815000000). Mirrors that migration's
 * backfill semantics exactly: bucket A → the one tile; bucket B (coarse alias)
 * → the FIRST tile; bucket C (exempt) → null. Use this to dual-write
 * `category_key` alongside the legacy `category` enum at every event_vendors
 * insert (expand-phase PR-2 of the enum→key migration).
 */
export function primaryTileForVendorCategory(
  category: VendorCategory,
): WeddingTile | null {
  const m = VENDOR_CATEGORY_CANONICAL[category];
  if (m.kind === 'tile') return m.tile;
  if (m.kind === 'tiles') return m.tiles[0] ?? null;
  return null;
}

/**
 * The DISPLAY label for a couple/vendor-side category, sourced live from the
 * admin taxonomy. The stored vocabulary is UNCHANGED — this only swaps the
 * human-readable text shown in the picker so a vendor sees the same label an
 * admin set on the tile (e.g. an admin renames the "Photo & Video" tile and the
 * picker follows). Resolution order, fallback-safe by construction:
 *
 *   1. the live tile label of the category's PRIMARY anchor tile
 *      (`tax.tileLabel[primaryTileForVendorCategory(cat)]`), when present;
 *   2. otherwise the in-code `VENDOR_CATEGORY_LABEL[cat]` literal.
 *
 * Exempt (bucket C) categories have no anchor tile → always fall back to the
 * literal. Because `getTaxonomy()` itself falls back to the lib/taxonomy.ts
 * constant when the DB is unseeded, this is safe to call before any migration:
 * with no DB edits it returns the same labels as today.
 *
 * NOTE: this is purely cosmetic. It does NOT touch the WIRE/stored vocabulary —
 * the `<input name="category">` value and parseCategory/CATEGORY_SET validation
 * still use the legacy VendorCategory enum key.
 */
export function labelForVendorCategory(
  category: VendorCategory,
  tax: TaxonomySnapshot,
): string {
  const tile = primaryTileForVendorCategory(category);
  const dbLabel = tile ? tax.tileLabel[tile] : undefined;
  return dbLabel ?? VENDOR_CATEGORY_LABEL[category];
}

export type VendorCategoryDrift = {
  category: VendorCategory;
  /** Tiles this category maps to that no longer exist in the live DB tree. */
  missingTiles: WeddingTile[];
};

/**
 * Runtime drift check against the live taxonomy snapshot. Every non-exempt
 * couple-side category must map to tiles that still exist in the DB tree; this
 * surfaces categories whose anchor tile was deleted or re-keyed by an admin
 * edit (which the compile-time guard — bound to the constant union — can't see).
 * Empty array = the couple-side is fully anchored to the live taxonomy.
 */
export function validateVendorCategoryMapping(
  tax: TaxonomySnapshot,
): VendorCategoryDrift[] {
  const liveTiles = new Set<string>(tax.tileOrder);
  const drift: VendorCategoryDrift[] = [];
  for (const category of Object.keys(VENDOR_CATEGORY_CANONICAL) as VendorCategory[]) {
    const missing = tilesForVendorCategory(category).filter((t) => !liveTiles.has(t));
    if (missing.length > 0) drift.push({ category, missingTiles: missing });
  }
  return drift;
}
