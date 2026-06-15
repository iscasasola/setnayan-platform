/**
 * shortlist-taxonomy.ts — the data model for the couple Shortlist tab.
 *
 * Owner 2026-06-16: the Shortlist (Explore takeover · "the bench") must present
 * the COMPLETE taxonomy for the event's type, faith-scoped — not the 22 curated
 * planning buckets. So this builds folders → ALL taxonomy tiles (the same ~53
 * tiles the Explore marketplace shows), filtered by:
 *   • event type — `passesEventTypeFilter` on the tile's applicable_event_types.
 *   • faith — a tile shows unless EVERY canonical service under it is faith-
 *     tagged-incompatible with the couple's rite(s) (`passesFaithFilter`,
 *     include-only: untagged/"universal" tiles always show). Same predicates the
 *     marketplace + dashboard category search use (lib/taxonomy-filters.ts), so
 *     the surfaces can never disagree.
 *
 * Each tile carries the couple's CONSIDERED vendors in that tile as a read-only
 * carousel (tap → detail) + a "Find" jump into the marketplace tile. Lock /
 * Build / Compare are NOT here — those are their own takeover tabs; the Shortlist
 * is the browse-the-bench surface, so this model is deliberately decoupled from
 * the plan-group lock/build machinery (it can't destabilize those tabs).
 *
 * Picks are stored by the 28-value `VendorCategory` enum, finer-grained tiles
 * are ~53 — so `CATEGORY_TO_TILE` bridges every enum value to a tile (sourced
 * from PLAN_GROUPS' catalogTile + a supplement for the few groups with no tile).
 * The bridge is EXHAUSTIVE over the enum, so a considered vendor is never lost.
 */

import { type VendorCategory } from '@/lib/vendors';
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import {
  WEDDING_FOLDER_ORDER,
  WEDDING_FOLDER_LABEL,
  WEDDING_FOLDER_SLUG,
  WEDDING_TILES_BY_PARENT,
  WEDDING_TILE_LABEL,
  WEDDING_TILE_SLUG,
  TAXONOMY_MAP,
  type WeddingFolder,
  type WeddingTile,
} from '@/lib/taxonomy';
import { passesFaithFilter, passesEventTypeFilter } from '@/lib/taxonomy-filters';
import type { TaxonomySnapshot } from '@/lib/taxonomy-db';
import type { EventVendorRowInput } from '@/lib/wedding-plan-groups';
import type { VendorEnrichment } from '@/lib/vendors-plan-budget';

const LOCKED_STATUSES = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);

/**
 * Every `VendorCategory` → its taxonomy tile. Built from PLAN_GROUPS (each
 * group's `categories` → its `catalogTile`, first-writer-wins so the bridge is
 * stable), then a SUPPLEMENT for the categories whose plan group has no
 * `catalogTile` (Attire / Band-DJ-Performer / Logistics span several tiles). The
 * union is exhaustive over the enum so a considered pick always lands on a tile.
 */
const CATEGORY_TO_TILE: Partial<Record<VendorCategory, WeddingTile>> = (() => {
  const m: Partial<Record<VendorCategory, WeddingTile>> = {};
  for (const g of PLAN_GROUPS) {
    if (!g.catalogTile) continue;
    for (const c of g.categories) if (!(c in m)) m[c] = g.catalogTile;
  }
  // Categories whose plan group has no single catalogTile — pin each to its
  // most-specific tile so the pick surfaces in the right place.
  const supplement: Partial<Record<VendorCategory, WeddingTile>> = {
    gown_designer: 'brides_attire',
    suit_designer: 'grooms_attire',
    band_dj: 'live_band',
    string_quartet: 'orchestra',
    choir: 'choir',
    security: 'escort',
    gifts_and_giveaways: 'souvenir_giveaways',
    misc: 'escort',
  };
  for (const [c, t] of Object.entries(supplement)) {
    if (!(c in m)) m[c as VendorCategory] = t as WeddingTile;
  }
  return m;
})();

/** The tile a considered vendor belongs to (null only for an unknown category). */
export function tileForCategory(category: VendorCategory): WeddingTile | null {
  return CATEGORY_TO_TILE[category] ?? null;
}

/**
 * Inverse bridge: a tile → a representative `VendorCategory` to store a
 * MANUALLY-added vendor under (the "Add manually" affordance writes
 * event_vendors.category). First category that maps to the tile wins; tiles
 * with no backing enum value (finer than the 28-value enum) fall back to 'misc'
 * — the couple's typed record is preserved either way.
 */
const TILE_TO_CATEGORY: Partial<Record<WeddingTile, VendorCategory>> = (() => {
  const m: Partial<Record<WeddingTile, VendorCategory>> = {};
  for (const [cat, tile] of Object.entries(CATEGORY_TO_TILE)) {
    if (tile && !(tile in m)) m[tile] = cat as VendorCategory;
  }
  return m;
})();

export function categoryForTile(tile: WeddingTile): VendorCategory {
  return TILE_TO_CATEGORY[tile] ?? ('misc' as VendorCategory);
}

/** One considered vendor in a tile's carousel (read-only — view, don't lock). */
export type ShortlistVendor = {
  vendorId: string;
  name: string;
  /** 'locked' once contracted/paid/delivered/complete, else 'considering'. */
  status: 'considering' | 'locked';
  totalCostPhp: number | null;
  /** Best available image: manual photo → service photo → marketplace logo. */
  photoUrl: string | null;
  city: string | null;
  rating: number | null;
  reviewCount: number | null;
  isVerified: boolean;
  isSetnayan: boolean;
  href: string;
};

/** One taxonomy tile (a category) inside a folder. */
export type ShortlistTile = {
  tile: WeddingTile;
  label: string;
  slug: string;
  vendors: ShortlistVendor[];
  /** Marketplace jump for this tile (the "Find" card / empty-state CTA). */
  exploreHref: string;
  /** VendorCategory to store an "Add manually" vendor under for this tile. */
  category: string;
};

/** One folder section: its sticky head + the tiles under it. */
export type ShortlistFolder = {
  folder: WeddingFolder;
  label: string;
  slug: string;
  tiles: ShortlistTile[];
  /** Considered vendors across all tiles in this folder (the head subline). */
  pickCount: number;
};

/** Does any canonical service under `tile` pass the couple's faith filter?
 *  A tile with no faith-tagged canonicals is universal → always shows. */
function tilePassesFaith(
  tile: WeddingTile,
  faithSet: ReadonlySet<string>,
  map: Record<string, { tile?: WeddingTile; faith?: string }>,
): boolean {
  if (faithSet.size === 0) return true;
  let sawFaithTagged = false;
  for (const entry of Object.values(map)) {
    if (entry.tile !== tile) continue;
    if (!entry.faith) return true; // a universal canonical → tile shows
    sawFaithTagged = true;
    if (passesFaithFilter(entry.faith, faithSet)) return true;
  }
  // No canonical mapped to this tile, OR every one was faith-incompatible.
  return !sawFaithTagged;
}

/**
 * Build the Shortlist's folders → tiles, faith + event-type scoped, with the
 * couple's considered vendors attached to their tile. Pure — call server-side.
 */
export function buildShortlistFolders(args: {
  vendorRows: ReadonlyArray<EventVendorRowInput>;
  enrichmentByVendorId?: ReadonlyMap<string, VendorEnrichment>;
  eventType: string | null;
  faithSet: ReadonlySet<string>;
  taxonomy?: TaxonomySnapshot;
  eventId: string;
}): ShortlistFolder[] {
  const { vendorRows, enrichmentByVendorId, eventType, faithSet, taxonomy, eventId } = args;

  const folderOrder = taxonomy?.folderOrder ?? WEDDING_FOLDER_ORDER;
  const folderLabelMap = taxonomy?.folderLabel ?? WEDDING_FOLDER_LABEL;
  const folderSlugMap = taxonomy?.folderSlug ?? WEDDING_FOLDER_SLUG;
  const tilesByParent = taxonomy?.tilesByParent ?? WEDDING_TILES_BY_PARENT;
  const tileLabelMap = taxonomy?.tileLabel ?? WEDDING_TILE_LABEL;
  const tileSlugMap = taxonomy?.tileSlug ?? WEDDING_TILE_SLUG;
  const tileEventTypes = taxonomy?.tileEventTypes ?? {};
  const map = taxonomy?.map ?? TAXONOMY_MAP;

  // Bucket considered vendors by tile (exhaustive bridge → never dropped).
  const byTile = new Map<WeddingTile, ShortlistVendor[]>();
  for (const v of vendorRows) {
    const tile = tileForCategory(v.category);
    if (!tile) continue;
    const ext = enrichmentByVendorId?.get(v.vendor_id);
    const vendor: ShortlistVendor = {
      vendorId: v.vendor_id,
      name: v.vendor_name,
      status:
        v.status && LOCKED_STATUSES.has(v.status) ? 'locked' : 'considering',
      totalCostPhp:
        typeof v.total_cost_php === 'number'
          ? v.total_cost_php
          : v.total_cost_php != null
            ? Number(v.total_cost_php)
            : null,
      photoUrl:
        v.manual_vendor_photo_url ??
        v.service_primary_photo_url ??
        v.marketplace_logo_url ??
        null,
      city: v.marketplace_city ?? null,
      rating: ext?.rating ?? null,
      reviewCount: ext?.review_count ?? null,
      isVerified: ext?.is_verified ?? false,
      isSetnayan: ext?.is_setnayan_service ?? false,
      href: `/dashboard/${eventId}/vendors/${v.vendor_id}`,
    };
    const arr = byTile.get(tile);
    if (arr) arr.push(vendor);
    else byTile.set(tile, [vendor]);
  }

  const folders: ShortlistFolder[] = [];
  for (const folder of folderOrder) {
    const tileIds = (tilesByParent[folder] ?? []) as WeddingTile[];
    const tiles: ShortlistTile[] = [];
    let pickCount = 0;
    for (const tile of tileIds) {
      // Event-type scope (tile-grain primary control) + faith scope.
      if (!passesEventTypeFilter(tileEventTypes[tile] ?? null, eventType)) continue;
      if (!tilePassesFaith(tile, faithSet, map)) continue;
      const vendors = byTile.get(tile) ?? [];
      pickCount += vendors.length;
      const slug = tileSlugMap[tile] ?? tile;
      tiles.push({
        tile,
        label: tileLabelMap[tile] ?? tile,
        slug,
        vendors,
        exploreHref: `/explore?tile=${encodeURIComponent(slug)}`,
        category: categoryForTile(tile),
      });
    }
    if (tiles.length === 0) continue;
    folders.push({
      folder,
      label: folderLabelMap[folder] ?? folder,
      slug: folderSlugMap[folder] ?? folder,
      tiles,
      pickCount,
    });
  }
  return folders;
}
