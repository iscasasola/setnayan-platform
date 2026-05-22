/**
 * Vendor packages + cascade-lock + consumable budget (owner directive
 * 2026-05-22).
 *
 * Types + helpers for the bundled multi-category vendor package pattern.
 * Filipino hotels sell "wedding packages" as one SKU that bundles
 * reception venue + catering + cake + lights/sound + photobooth + bridal
 * car under one price. Host locks the package → all six categories
 * cascade-create as locked event_vendors rows.
 *
 * Schema lives in migration 20260604110000_vendor_packages.sql:
 *   • vendor_packages          — the SKU itself
 *   • vendor_package_items     — line items inside the package
 *   • event_vendor_packages    — the booking row when a host locks one
 *   • event_vendors.event_vendor_package_id — back-link for cascade
 *
 * Cascade-lock + customization logic lives in server actions next to the
 * dashboard route. This module is types + the canonical_service →
 * vendor_category map + the small pricing math helpers.
 */

import type { VendorCategory } from '@/lib/vendors';

/* ──────────────────────────────────────────────────────────────────────── */
/* canonical_service → vendor_category mapping                              */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Maps the iteration-0044 canonical_service taxonomy strings (which
 * vendor_package_items uses) to the legacy `vendor_category` enum (which
 * event_vendors uses). The cascade-lock server action consumes this map
 * to convert each kept package item into an event_vendors row.
 *
 * Coverage: every canonical_service value that appears in vendor_package_items
 * seed data is mapped. Unmapped strings fall through to `'misc'` at
 * cascade time — the package still locks, the row still surfaces on the
 * planning-card grid (Logistics group), the host just sees the generic
 * Misc bucket instead of a specific planning group.
 */
export const PACKAGE_CANONICAL_TO_VENDOR_CATEGORY: Record<string, VendorCategory> = {
  // Venue + ceremony anchors
  reception_venue: 'venue',
  ceremony_venue: 'religious_venue',
  // Food + drink
  catering: 'catering',
  cake_desserts: 'cake_maker',
  mobile_bar: 'mobile_bar',
  // Photo + video
  photography: 'photographer',
  videography: 'videographer',
  // Music + entertainment
  band_dj: 'band_dj',
  host_emcee: 'host_emcee',
  string_quartet: 'string_quartet',
  choir: 'choir',
  // Production
  lights_sound: 'lights_and_sound',
  led_screens: 'led_screens',
  // Booths + extras
  photobooth: 'photobooth',
  // Floral + decor
  florals: 'florist',
  florist: 'florist',
  reception_decor: 'reception_decor',
  // Attire + glam
  bridal_hmua: 'makeup_artist',
  hair_makeup: 'makeup_artist',
  bridal_gown: 'gown_designer',
  groom_suit: 'suit_designer',
  rings: 'rings',
  // Stationery
  invitations_stationery: 'invitations_stationery',
  // Logistics
  transportation_bridal_car: 'transportation',
  transportation_guest_shuttle: 'transportation',
  security: 'security',
  // Sponsorship
  gifts_giveaways: 'gifts_and_giveaways',
  // Coordination
  wedding_coordinator: 'planner_coordinator',
  day_of_coordinator: 'planner_coordinator',
  // Officiant
  officiant: 'officiant',
};

/**
 * Resolve a canonical_service string into a vendor_category enum value.
 * Unmapped strings fall through to 'misc' — the row still cascades and
 * surfaces on the Logistics planning card, the host just sees a generic
 * label instead of a specific bucket.
 */
export function resolveVendorCategory(
  canonicalService: string,
): VendorCategory {
  return PACKAGE_CANONICAL_TO_VENDOR_CATEGORY[canonicalService] ?? 'misc';
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Types                                                                    */
/* ──────────────────────────────────────────────────────────────────────── */

export type VendorPackageRow = {
  package_id: string;
  vendor_profile_id: string;
  package_name: string;
  description: string | null;
  total_price_centavos: number;
  consumable_budget_centavos: number;
  is_consumable_flexible: boolean;
  primary_canonical_service: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type VendorPackageItemRow = {
  item_id: string;
  package_id: string;
  canonical_service: string;
  service_description: string;
  is_default_included: boolean;
  replacement_value_centavos: number;
  display_order: number;
  created_at: string;
};

export type VendorPackageWithItems = VendorPackageRow & {
  items: ReadonlyArray<VendorPackageItemRow>;
};

export type EventVendorPackageStatus = 'considering' | 'locked' | 'released';

export type EventVendorPackageRow = {
  booking_id: string;
  event_id: string;
  package_id: string;
  primary_event_vendor_id: string | null;
  status: EventVendorPackageStatus;
  customizations_json: PackageCustomizations;
  remaining_consumable_centavos: number;
  total_locked_centavos: number;
  locked_at: string | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Persisted customization payload — exactly the shape submitted by the
 * customization modal. Re-rendered on the manage page so the host can
 * see what they originally chose.
 *
 * removed_item_ids: list of vendor_package_items.item_id the host
 *   unchecked. Cascade-lock skips these.
 *
 * consumable_allocations: optional notes from the host about how they
 *   want to spend the consumable budget pool. Free-text mapping
 *   category-label → centavos. Informational only — actual money flow
 *   stays in remaining_consumable_centavos.
 */
export type PackageCustomizations = {
  removed_item_ids?: string[];
  consumable_allocations?: Record<string, number>;
};

/* ──────────────────────────────────────────────────────────────────────── */
/* PHP centavos formatter                                                   */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Format centavos as PHP with thousands separators, no decimals.
 * Mirrors the existing `formatPhp` from @/lib/vendors but operates on
 * centavos (integer) instead of `numeric` peso values. Used on the
 * package detail surfaces.
 */
export function formatCentavosPhp(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return '—';
  const peso = Math.round(centavos / 100);
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(peso);
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Customization math                                                       */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Compute the live customization state given a package's items + the
 * host's choices. Used by both the customization modal (live preview as
 * the host toggles checkboxes) and the cascade-lock server action
 * (canonical computation persisted to event_vendor_packages).
 *
 * When is_consumable_flexible is TRUE: removing items grows the
 * consumable pool by their replacement values; total_locked stays at
 * the package's total_price (money stays in the package, redirected).
 *
 * When is_consumable_flexible is FALSE: removing items reduces
 * total_locked dollar-for-dollar by their replacement values; the
 * consumable pool stays at vendor_packages.consumable_budget_centavos
 * (no flex; host saves money instead).
 */
export function computeCustomization(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
): {
  remainingConsumableCentavos: number;
  totalLockedCentavos: number;
  removedTotalCentavos: number;
} {
  const removedSet = new Set(removedItemIds);
  const removedTotalCentavos = pkg.items
    .filter((item) => removedSet.has(item.item_id))
    .reduce((sum, item) => sum + item.replacement_value_centavos, 0);

  if (pkg.is_consumable_flexible) {
    return {
      remainingConsumableCentavos:
        pkg.consumable_budget_centavos + removedTotalCentavos,
      totalLockedCentavos: pkg.total_price_centavos,
      removedTotalCentavos,
    };
  }

  return {
    remainingConsumableCentavos: pkg.consumable_budget_centavos,
    totalLockedCentavos: Math.max(
      0,
      pkg.total_price_centavos - removedTotalCentavos,
    ),
    removedTotalCentavos,
  };
}

/**
 * Items that survived the host's customization — the ones that cascade
 * into event_vendors rows on lock.
 */
export function keptItems(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
): ReadonlyArray<VendorPackageItemRow> {
  const removedSet = new Set(removedItemIds);
  return pkg.items.filter((item) => !removedSet.has(item.item_id));
}
