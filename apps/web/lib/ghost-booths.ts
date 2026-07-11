/**
 * lib/ghost-booths — PURE logic for "3D Booth Ads · Part A" (slice 9, owner-locked
 * 2026-07-08): dashed "ghost booths" for the vendor categories a couple hasn't
 * booked yet, rendered ONLY in the couple's own 3D planning lab (never on a
 * guest page). Tapping a ghost booth deep-links to that category's marketplace
 * grid (`/explore?tile=<slug>`, where Boosted/Pro vendors already rank first) —
 * a native, in-room "you still need a caterer → here are caterers" ad.
 *
 * This file is deliberately React/DOM-free so the selection logic is 100%
 * unit-testable; the 3D render + tap wiring live in the lab component, and the
 * dismissal/master-toggle state persists on `event_floor_plan` (a later phase).
 *
 * Locked rules honoured here:
 *  · ON by default (the `enabled` master toggle defaults true at the call site).
 *  · per-booth dismissible (a dismissed category never returns).
 *  · couple-room ONLY (the guest venue walk never imports this).
 */

import { type VendorCategory, VENDOR_CATEGORY_LABEL } from './vendors';
import { primaryTileForVendorCategory } from './vendor-category-taxonomy';
import { WEDDING_TILE_SLUG } from './taxonomy';

/**
 * The DOMAIN of ghost booths — the core reception-floor vendor categories that
 * (a) read as a physical BOOTH at a wedding, (b) are prime ad inventory, and
 * (c) have a booth template. Ordered by typical prominence (the render places
 * the earliest ones first). Deliberately EXCLUDES non-booth categories — venue /
 * religious_venue (they ARE the room), officiant / church_fees / choir
 * (ceremony), rings / invitations / gifts / accommodation / transportation /
 * security / crew_meals / misc (no floor presence), and the attire boutiques
 * (gown/suit designers are shops, not reception booths).
 *
 * ⚠ OWNER-TWEAKABLE: which categories get a ghost booth is a product/ad-inventory
 * decision — adjust this one array to add/remove/reorder. Surfaced for sign-off.
 */
export const GHOST_BOOTH_CATEGORIES: readonly VendorCategory[] = [
  'catering',
  'photographer',
  'videographer',
  'band_dj',
  'florist',
  'cake_maker',
  'photobooth',
  'mobile_bar',
  'makeup_artist',
  'hair_stylist',
  'host_emcee',
  'reception_decor',
];

/** One ghost booth to render: the empty-slot category + its display label +
 *  the marketplace deep-link target. */
export type GhostBoothCategory = {
  category: VendorCategory;
  /** e.g. "Caterer" — the UI frames it as "No Caterer yet". */
  label: string;
  /** The marketplace tile slug → `/explore?tile=<slug>`. */
  tileSlug: string;
};

/**
 * The ghost booths to show for one event: every DOMAIN category the couple has
 * NOT booked and has NOT dismissed — in domain order, with its label + tile
 * slug resolved. Empty when the master toggle is off. Pure: the caller passes
 * the booked categories (from `event_vendors.category`), the dismissed set, and
 * the toggle.
 *
 * A category whose taxonomy bridge yields no marketplace tile is skipped (it
 * has no `/explore` target to sell), so the result is always tappable.
 */
export function unbookedGhostCategories(input: {
  bookedCategories: readonly VendorCategory[];
  dismissed: readonly VendorCategory[];
  enabled: boolean;
}): GhostBoothCategory[] {
  if (!input.enabled) return [];
  const booked = new Set(input.bookedCategories);
  const dismissed = new Set(input.dismissed);
  const out: GhostBoothCategory[] = [];
  for (const category of GHOST_BOOTH_CATEGORIES) {
    if (booked.has(category) || dismissed.has(category)) continue;
    const tile = primaryTileForVendorCategory(category);
    if (!tile) continue; // no marketplace target → nothing to sell
    out.push({ category, label: VENDOR_CATEGORY_LABEL[category], tileSlug: WEDDING_TILE_SLUG[tile] });
  }
  return out;
}

/** The `/explore` deep-link for a ghost booth (Boosted/Pro ranked first there). */
export function ghostBoothExploreHref(tileSlug: string): string {
  return `/explore?tile=${encodeURIComponent(tileSlug)}`;
}
