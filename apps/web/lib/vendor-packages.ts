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
  // Venue + ceremony anchors.
  // `reception_venue` + `ceremony_venue_booking` became REAL canonicals on
  // 2026-07-21 (dead-tile fix); `ceremony_venue` is kept as a legacy alias
  // because it was in this map before the canonical existed and package seed
  // data may already carry the string.
  reception_venue: 'venue',
  ceremony_venue: 'religious_venue',
  ceremony_venue_booking: 'religious_venue',
  // Reception leaves — the ballroom/hall family that used to have to mis-tag
  // itself as `accommodation` to surface.
  function_hall: 'venue',
  events_place: 'venue',
  hotel_ballroom: 'venue',
  garden_reception_venue: 'venue',
  resort_reception_venue: 'venue',
  // Ceremony leaves — religious locations, one per faith_vocab key.
  catholic_church_venue: 'religious_venue',
  christian_church_venue: 'religious_venue',
  born_again_church_venue: 'religious_venue',
  inc_kapilya_venue: 'religious_venue',
  aglipayan_church_venue: 'religious_venue',
  orthodox_church_venue: 'religious_venue',
  sda_church_venue: 'religious_venue',
  kingdom_hall_venue: 'religious_venue',
  lds_temple_venue: 'religious_venue',
  mosque_venue: 'religious_venue',
  synagogue_venue: 'religious_venue',
  hindu_temple_venue: 'religious_venue',
  gurdwara_venue: 'religious_venue',
  buddhist_temple_venue: 'religious_venue',
  cultural_ceremony_site: 'religious_venue',
  // A civil ceremony is not religious, but `religious_venue` is the enum value
  // the CEREMONY plan group reads (`categories: ['religious_venue',
  // 'church_fees']` in wedding-plan-groups.ts) while `venue` routes to the
  // RECEPTION card. Functional placement wins over label purity: a city-hall
  // booking belongs on the ceremony card, not the reception one.
  civil_ceremony_venue: 'religious_venue',
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
  /**
   * Package CREDIT model (migration 20271006413374). The vendor's per-package
   * decision about leftover credit: 'expiring' (use it or lose it — today's
   * behaviour, and the column default) or 'refundable' (unspent credit comes
   * off the price). OPTIONAL because older SELECTs predate the column.
   * Honoured only by ./package-credit, behind ./package-credit-flag.
   *
   * ⚠ NOTHING WRITES THIS. There is no authoring control for it, so every
   * package in existence is the DB default 'expiring'. Keep it that way until
   * the owner confirms what 'refundable' means — read literally it refunds the
   * whole unspent pool INCLUDING `consumable_budget_centavos`, i.e. money the
   * sticker price already charged for. See the warning header in
   * ./package-credit.
   */
  unspent_credit_policy?: 'expiring' | 'refundable';
};

/**
 * The PostgREST select list for a package. Use this, never a literal.
 *
 * Centralised for the same reason as {@link PACKAGE_ITEM_OPTION_SELECT}: this
 * list was copy-pasted across four call sites, and the one time a name in a
 * list like this was wrong (`label` for `option_label`) every copy was wrong
 * together and every test stayed green.
 */
export const VENDOR_PACKAGE_SELECT =
  'package_id, vendor_profile_id, package_name, description, total_price_centavos, consumable_budget_centavos, is_consumable_flexible, unspent_credit_policy, primary_canonical_service, is_active, created_at, updated_at';

/**
 * The PostgREST select list for a package line.
 *
 * `is_required` is load-bearing twice over: `isRemovableItem` refuses to price
 * a removal without it, and the credit engine's whole invariant is that a
 * required line's value never enters the pool. Omitting it reads as FALSE.
 */
export const VENDOR_PACKAGE_ITEM_SELECT =
  'item_id, package_id, canonical_service, service_description, is_default_included, is_required, replacement_value_centavos, display_order, created_at';

export type VendorPackageItemRow = {
  item_id: string;
  package_id: string;
  canonical_service: string;
  service_description: string;
  is_default_included: boolean;
  replacement_value_centavos: number;
  display_order: number;
  created_at: string;
  /**
   * Package CREDIT model (migration 20271006413374). TRUE = the line cannot
   * be removed AND its replacement value never enters the available-credit
   * pool. OPTIONAL here because no shipped SELECT requests the column yet —
   * `computeCustomization` below deliberately ignores it, so today's flag-OFF
   * behaviour is unchanged. The credit engine that honours it lives in
   * ./package-credit and is gated by ./package-credit-flag.
   *
   * ⚠ NOT the same thing as `is_default_included`, which only means "ticked
   * by default" and never stopped anyone unticking the line.
   */
  is_required?: boolean;
  /**
   * The alternatives on this line. **A line is a CHOICE iff this is non-empty**
   * — there is no `is_choice` column, and adding one would be a second source
   * of truth that could disagree with the rows.
   *
   * OPTIONAL because most SELECTs do not join the options table; `undefined`
   * means "not fetched", which reads the same as "not a choice" everywhere it
   * matters. Only fetch it where a couple can actually pick.
   */
  options?: ReadonlyArray<VendorPackageItemOptionRow>;
};

/**
 * One alternative on a CHOICE line (migration 20271006413374). A line is a
 * choice iff it carries at least one of these.
 *
 * ⚠ The DB column is `option_label`, NOT `label`. The authoring surface asked
 * for `label` in two SELECTs and wrote `label` in its INSERT; PostgREST 400s on
 * an unknown column, so no vendor could save or reload a choice option at all.
 * This type and {@link PACKAGE_ITEM_OPTION_COLUMNS} exist so the name is
 * written down once, in one place, instead of in free-text query strings —
 * `vendor-packages.columns.test.ts` checks it against the migration.
 */
export type VendorPackageItemOptionRow = {
  option_id: string;
  item_id: string;
  option_label: string;
  /** EXTRA over the default. The DB pins the default option to 0. */
  price_delta_centavos: number;
  is_default: boolean;
  is_available: boolean;
  display_order: number;
};

/**
 * The columns of `vendor_package_item_options` this app reads or writes, spelled
 * as the database spells them. NOT the full table — `option_description`,
 * `created_at` and `updated_at` exist in the migration and are deliberately
 * absent here because nothing consumes them yet.
 *
 * Every name in this list is asserted to be a real column by the columns test.
 */
export const PACKAGE_ITEM_OPTION_COLUMNS = [
  'option_id',
  'item_id',
  'option_label',
  'price_delta_centavos',
  'is_default',
  'is_available',
  'display_order',
] as const;

/** The PostgREST select list for a choice option. Use this, never a literal. */
export const PACKAGE_ITEM_OPTION_SELECT =
  'option_id, item_id, option_label, price_delta_centavos, is_default, is_available';

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
  /**
   * The option the host picked on each CHOICE line — a flat list of
   * `vendor_package_item_options.option_id`, at most one per line, matching
   * `computePackageCredit`'s `chosenOptionIds`.
   *
   * Absent means "every choice line stays on its default", which is what the
   * package price already assumes (the DB pins the default's delta to 0).
   *
   * Rides inside the existing `customizations_json JSONB` column — **no
   * migration needed.** Never trust the price attached to one of these ids:
   * the server re-reads every `price_delta_centavos` from the DB.
   */
  chosen_option_ids?: string[];
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
/**
 * Can the host drop this line?
 *
 * Two INDEPENDENT reasons a line is not removable, and both must hold for a
 * removal to be worth money:
 *
 *   • `is_required` — the vendor marked it mandatory. Owner-locked 2026-07-26:
 *     "the vendor can place required so this is something they have to pick and
 *     cannot be unpicked."
 *   • `!is_default_included` — the line is an optional ADD-ON that was never
 *     inside `total_price_centavos`. "Removing" it must refund nothing, because
 *     nothing was ever charged for it. Treating it as removable is how the
 *     pre-fix code paid the host for a line the vendor never billed.
 *
 * `is_required` is optional on the row type only because the column post-dates
 * it; every SELECT on the lock path now includes it, and the DB default is
 * FALSE, so it is a real boolean in practice.
 */
export function isRemovableItem(item: VendorPackageItemRow): boolean {
  return item.is_default_included === true && item.is_required !== true;
}

/**
 * A line is a CHOICE iff it carries at least one alternative. Mirrors
 * `isChoiceLine` in ./package-credit, which types the same rule for the credit
 * engine's own structural item type.
 */
export function isChoiceLine(item: VendorPackageItemRow): boolean {
  return Array.isArray(item.options) && item.options.length > 0;
}

/**
 * The option a choice line falls back to when the host has picked nothing: the
 * one the vendor marked standard, which `total_price_centavos` already pays for.
 *
 * `undefined` for a plain line, and also for the malformed case of a choice line
 * with no available default. The authoring validator refuses to save that
 * (`choice_needs_exactly_one_default` + `choice_default_unavailable`) and the DB
 * enforces at-most-one via a partial unique index — but the DB does NOT enforce
 * *at least* one, so a row written outside the validator can still land here.
 * Callers must treat `undefined` as "unresolved", never as "free".
 */
export function defaultOptionFor(
  item: VendorPackageItemRow,
): VendorPackageItemOptionRow | undefined {
  return item.options?.find((o) => o.is_default && o.is_available);
}

/**
 * The option actually in force on a line, given what the host picked.
 *
 * Resolution order: the picked id (only if it belongs to THIS line and is still
 * available) → the standard option → `undefined`. Scoping the lookup to the
 * line's own options is what stops a client sending some other line's cheaper
 * option id and being priced by it.
 */
export function resolveChosenOption(
  item: VendorPackageItemRow,
  chosenOptionIds: ReadonlyArray<string>,
): VendorPackageItemOptionRow | undefined {
  const picked = item.options?.find(
    (o) => chosenOptionIds.includes(o.option_id) && o.is_available,
  );
  return picked ?? defaultOptionFor(item);
}

/**
 * What the host's choices ADD to the package price, in centavos.
 *
 * Only lines that are still kept can add anything — a removed line's upgrade is
 * not charged. Prices come from the item rows the CALLER fetched, so on the
 * server this must be called with DB-read options, never client-supplied ones.
 */
export function chosenOptionsSurchargeCentavos(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
  chosenOptionIds: ReadonlyArray<string>,
): number {
  const removedSet = new Set(removedItemIds);
  return pkg.items.reduce((sum, item) => {
    if (removedSet.has(item.item_id) && isRemovableItem(item)) return sum;
    if (!item.is_default_included) return sum;
    if (!isChoiceLine(item)) return sum;
    const chosen = resolveChosenOption(item, chosenOptionIds);
    return sum + (chosen?.price_delta_centavos ?? 0);
  }, 0);
}

export function computeCustomization(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
): {
  remainingConsumableCentavos: number;
  totalLockedCentavos: number;
  removedTotalCentavos: number;
} {
  const removedSet = new Set(removedItemIds);
  // Only removals the host was actually ALLOWED to make move money. An id for a
  // required or never-included line is ignored rather than rejected, so a stale
  // client cannot both crash the lock and cannot profit from it.
  const removedTotalCentavos = pkg.items
    .filter((item) => removedSet.has(item.item_id) && isRemovableItem(item))
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
  return pkg.items.filter((item) => {
    // Never inside the price → never cascades into an event_vendors row. There
    // is no purchase path for add-ons yet, so shipping them as booked services
    // would hand the host a vendor they did not pay for.
    if (!item.is_default_included) return false;
    // A required line survives regardless of what the client sent.
    if (item.is_required) return true;
    return !removedSet.has(item.item_id);
  });
}
