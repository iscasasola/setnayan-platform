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
 * Picks are stored by the 45-value `VendorCategory` enum, finer-grained tiles
 * are ~67 — so `CATEGORY_TO_TILE` bridges every enum value to a tile (sourced
 * from PLAN_GROUPS' catalogTile + a supplement for the few groups with no tile
 * + a final fill from the admin-blessed canonical bridge). The bridge is
 * EXHAUSTIVE over the enum, so a considered vendor is never lost.
 */

import { VENDOR_CATEGORIES, type VendorCategory } from '@/lib/vendors';
import { primaryTileForVendorCategory } from '@/lib/vendor-category-taxonomy';
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
 * Every `VendorCategory` → its taxonomy tile. THREE passes, first-writer-wins:
 * PLAN_GROUPS (each group's `categories` → its `catalogTile`), then a
 * SUPPLEMENT for the categories whose plan group has no `catalogTile` (Attire /
 * Band-DJ-Performer / Logistics span several tiles), then a final fill from the
 * canonical bridge. Only after that third pass is the union EXHAUSTIVE over all
 * 45 enum values (asserted in shortlist-taxonomy-coverage.test.ts) — before
 * 2026-07-21 this docstring claimed exhaustiveness while silently missing the 14
 * non-wedding gap leaves, and `buildShortlistFolders` DROPPED those picks.
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
  // Final fill (2026-07-21): anything still unmapped takes the ADMIN-blessed
  // anchor from VENDOR_CATEGORY_CANONICAL — the compile-time-exhaustive
  // Record<VendorCategory, …> in lib/vendor-category-taxonomy.ts. This is how
  // the 14 non-wedding gap leaves (tour_guide, referee_official, …) land: each
  // anchors 1:1 to its SAME-NAMED tier-2 tile under EXPERIENCE / DINING /
  // LOGISTICS & SAFETY / INSURANCE / SPECIALTY / PROGRAM — not forced onto a
  // wedding tile. Event-type scope (passesEventTypeFilter on the tile's
  // applicable_event_types, seeded by 20270825054104) is what keeps a Tour Guide
  // tile off a wedding Shortlist; a null bridge was never the right mechanism
  // for that and only ever dropped the pick. Runs LAST so the two passes above
  // keep first-writer-wins: the six deliberate Shortlist-specific placements
  // (officiant/church_fees → ceremony_venue, security/misc → escort,
  // string_quartet → orchestra, reception_decor → florist) stand, and the four
  // canonically-EXEMPT categories keep a home instead of going null.
  for (const c of VENDOR_CATEGORIES) {
    if (c in m) continue;
    const t = primaryTileForVendorCategory(c);
    if (t) m[c] = t;
  }
  return m;
})();

/** The tile a considered vendor belongs to (null only for a category outside
 *  the enum — e.g. a raw DB string; every valid `VendorCategory` maps). */
export function tileForCategory(category: VendorCategory): WeddingTile | null {
  return CATEGORY_TO_TILE[category] ?? null;
}

/**
 * Inverse bridge: a tile → a representative `VendorCategory` to store a
 * MANUALLY-added vendor under (the "Add manually" affordance writes
 * event_vendors.category). First category that maps to the tile wins; tiles
 * with no backing enum value (finer than the 45-value enum) fall back to 'misc'
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
  /** Fit-badge · service-radius reach (2026-07-09). TRUE = the vendor's tier
   *  radius reaches this event's venue ("✓ Reaches your venue"); FALSE = out of
   *  range ("travel fee likely"); NULL = unknown (no coords / unscoped tier /
   *  manual vendor) → the badge is hidden. Fail-open: unknown never reads FALSE. */
  reachesVenue: boolean | null;
  /** The vendor's tier service radius in km (Verified 20 · Pro 50) when finite,
   *  else null (Free/unscoped or Enterprise/nationwide) — drives the reach label. */
  serviceRadiusKm: number | null;
  /** Fit-badge · budget fit (2026-07-09). 'fits' = the vendor's price basis is
   *  within the event's remaining budget (total − locked commitments); 'over' =
   *  it exceeds it; NULL = no budget set or no price basis → hidden. Locked picks
   *  never carry a budget badge (they're already committed + already counted). */
  budgetFit: 'fits' | 'over' | null;
  /** TRUE when `budgetFit` was computed from the service's "starts at"
   *  (starting_price_php) rather than a real quote (total_cost_php) — the badge
   *  renders an "est." qualifier so an estimate never reads as a firm number. */
  budgetEstimated: boolean;
  /** Fit-badge · date availability (2026-07-09 · fast-follow to reach+budget).
   *  'free' = the vendor's calendar has no block on the event's COMMITTED
   *  (day-precision) date; 'booked' = a block covers that day; NULL = no signal
   *  (no committed date, vendor isn't marketplace-connected, or the check didn't
   *  run — bench off) → the badge is hidden. Locked picks never carry it (they're
   *  already committed for this event). Fail-open: a calendar flake reads 'free',
   *  never a false 'booked' (mirrors reach's no-false-out-of-range rule). */
  dateFit: 'free' | 'booked' | null;
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
  /** TRUE when this category is in the couple's onboarding plan
   *  (events.style_preferences.interested_categories). Drives the "Your plan"
   *  strip + the "In your plan" marker on the Shortlist. */
  planned: boolean;
};

/** One folder section: its sticky head + the tiles under it. */
export type ShortlistFolder = {
  folder: WeddingFolder;
  label: string;
  slug: string;
  tiles: ShortlistTile[];
  /** Considered vendors across all tiles in this folder (the head subline). */
  pickCount: number;
  /** Tiles in this folder that are in the couple's onboarding plan. */
  plannedCount: number;
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
  /** Category ids from the couple's onboarding plan (style_preferences.
   *  interested_categories) — the tiles to mark as "in your plan". */
  plannedTiles?: ReadonlySet<string>;
  /** The event's total budget in PHP whole pesos (estimated_budget_centavos /
   *  100), or null when unset. Drives the per-vendor budget-fit badge: remaining
   *  = total − Σ locked commitments; a considered vendor "fits" when its price
   *  basis ≤ remaining. Null → no budget badge anywhere (calm by default). */
  totalBudgetPhp?: number | null;
  /** Per-vendor date-availability fit for the event's COMMITTED (day-precision)
   *  date (2026-07-09 · fast-follow to reach+budget). vendor_id → 'free' | 'booked'.
   *  Computed once, batched, upstream (page.tsx) via the same calendar path the
   *  Compare tab uses. Absent / no committed date → no date badges. Locked picks
   *  are skipped here (they're already committed for this event). */
  dateFitByVendorId?: ReadonlyMap<string, 'free' | 'booked'>;
}): ShortlistFolder[] {
  const {
    vendorRows,
    enrichmentByVendorId,
    eventType,
    faithSet,
    taxonomy,
    eventId,
    plannedTiles,
    totalBudgetPhp,
    dateFitByVendorId,
  } = args;

  // Budget-fit remaining (2026-07-09): total − Σ locked commitments. Only LOCKED
  // picks (contracted/deposit_paid/delivered/complete) count as spent — a
  // considered vendor isn't committed, so it's measured AGAINST the remaining,
  // not subtracted from it. Null total → remaining null → no budget badges.
  const remainingBudgetPhp = (() => {
    if (totalBudgetPhp == null) return null;
    let lockedSpent = 0;
    for (const v of vendorRows) {
      if (!(v.status && LOCKED_STATUSES.has(v.status))) continue;
      const cost =
        typeof v.total_cost_php === 'number'
          ? v.total_cost_php
          : v.total_cost_php != null
            ? Number(v.total_cost_php)
            : 0;
      if (Number.isFinite(cost)) lockedSpent += cost;
    }
    return totalBudgetPhp - lockedSpent;
  })();

  const folderOrder = taxonomy?.folderOrder ?? WEDDING_FOLDER_ORDER;
  const folderLabelMap = taxonomy?.folderLabel ?? WEDDING_FOLDER_LABEL;
  const folderSlugMap = taxonomy?.folderSlug ?? WEDDING_FOLDER_SLUG;
  const tilesByParent = taxonomy?.tilesByParent ?? WEDDING_TILES_BY_PARENT;
  const tileLabelMap = taxonomy?.tileLabel ?? WEDDING_TILE_LABEL;
  const tileSlugMap = taxonomy?.tileSlug ?? WEDDING_TILE_SLUG;
  const tileEventTypes = taxonomy?.tileEventTypes ?? {};
  const hiddenCategories = taxonomy?.hiddenCategories ?? {};
  const map = taxonomy?.map ?? TAXONOMY_MAP;

  // Bucket considered vendors by tile (exhaustive bridge → never dropped).
  const byTile = new Map<WeddingTile, ShortlistVendor[]>();
  for (const v of vendorRows) {
    const tile = tileForCategory(v.category);
    if (!tile) continue;
    const ext = enrichmentByVendorId?.get(v.vendor_id);
    const isLocked = !!(v.status && LOCKED_STATUSES.has(v.status));
    const totalCostPhp =
      typeof v.total_cost_php === 'number'
        ? v.total_cost_php
        : v.total_cost_php != null
          ? Number(v.total_cost_php)
          : null;

    // Fit-badge · budget (2026-07-09). Basis = a real quote first, else the
    // service's "starts at" anchor (owner: "service cards has a starts at
    // range"). Locked picks skip the badge — they're committed + already netted
    // out of `remainingBudgetPhp`, so measuring them against it would double-count.
    const budgetBasis = totalCostPhp ?? ext?.starting_price_php ?? null;
    const budgetFit: 'fits' | 'over' | null =
      isLocked || remainingBudgetPhp == null || budgetBasis == null
        ? null
        : budgetBasis <= remainingBudgetPhp
          ? 'fits'
          : 'over';
    const budgetEstimated = budgetFit != null && totalCostPhp == null;

    const vendor: ShortlistVendor = {
      vendorId: v.vendor_id,
      name: v.vendor_name,
      status: isLocked ? 'locked' : 'considering',
      totalCostPhp,
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
      // Fit-badge · reach. `within_radius` is undefined for manual vendors / when
      // coords or tier are unknown → NULL (badge hidden, never a false "out of
      // range"). serviceRadiusKm feeds the "within N km" label.
      reachesVenue: ext?.within_radius ?? null,
      serviceRadiusKm: ext?.service_radius_km ?? null,
      budgetFit,
      budgetEstimated,
      // Fit-badge · date. Skipped for locked picks (already committed for this
      // event — their own booking would block that day, so a "Booked that day"
      // read on your OWN chosen vendor would be misleading) — same "locked skips"
      // discipline as budget above. Absent map / no committed date → null.
      dateFit: isLocked ? null : dateFitByVendorId?.get(v.vendor_id) ?? null,
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
    let plannedCount = 0;
    for (const tile of tileIds) {
      const vendors = byTile.get(tile) ?? [];
      // Tile-level marketplace_hidden (admin-only tile) — dropped from the
      // couple-facing Shortlist (it deep-links to /explore, where the tile is
      // also hidden) UNLESS the couple already has a vendor of their own
      // shortlisted/booked under it. A couple's existing pick must never
      // vanish from their own Shortlist just because an admin later hid the
      // tile from marketplace browsing. No tile is hidden today (no-op).
      if (hiddenCategories[tile] && vendors.length === 0) continue;
      // Event-type scope (tile-grain primary control) + faith scope.
      if (!passesEventTypeFilter(tileEventTypes[tile] ?? null, eventType)) continue;
      if (!tilePassesFaith(tile, faithSet, map)) continue;
      pickCount += vendors.length;
      const planned = plannedTiles?.has(tile) ?? false;
      if (planned) plannedCount += 1;
      const slug = tileSlugMap[tile] ?? tile;
      tiles.push({
        tile,
        label: tileLabelMap[tile] ?? tile,
        slug,
        vendors,
        exploreHref: `/explore?tile=${encodeURIComponent(slug)}`,
        category: categoryForTile(tile),
        planned,
      });
    }
    if (tiles.length === 0) continue;
    folders.push({
      folder,
      label: folderLabelMap[folder] ?? folder,
      slug: folderSlugMap[folder] ?? folder,
      tiles,
      pickCount,
      plannedCount,
    });
  }
  return folders;
}
