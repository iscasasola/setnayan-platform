import type { SupabaseClient } from '@supabase/supabase-js';

import { BRANCH_SKU_CODE } from './vendor-branches';
import { SEAT_SKU_CODE } from './vendor-seats';
import {
  canBuyExtraBookingsPerDate,
  canBuyExtraBranches,
  canBuyExtraCategories,
  canBuyExtraSeats,
  canBuyExtraServiceCards,
  canBuyExtraWaitlist,
  type TierCaps,
} from './vendor-tier-caps';

/**
 * ULTRA ADD-ONS — owner 2026-11-06, DECISION_LOG "ULTRA ADD-ON PRICES", verbatim: *"seat, branch + 990 / the rest is
 * +199"*. Per 4 weeks, Ultra only (Custom runs as Ultra): +1 team seat · +1 branch · +1 category · +1 service card ·
 * +1 wait list · +1 booking per date.
 *
 * 🔑 NO PRICE IS TYPED HERE. Every figure is the `vendor_billing_catalog` row (admin-managed — the only price a
 * supplier is charged). {@link ultraAddOns} reads them in the owner's order; a row that is missing or switched off is
 * simply not listed, and an unreadable catalogue answers `null` — never a fallback figure.
 *
 * The seat and the branch were already sold (team page · branch panel) and keep their own flows. The four NEW ones
 * are COUNT add-ons, built exactly the way the seat is (lib/vendor-seats.ts): an apply-then-pay order keyed
 * `<prefix><vendor_profile_id>` → paid → the sku-activation hook RECOMPUTES a count on `vendor_profiles` from the
 * paid orders (idempotent, self-healing, lowered again on a refund) → {@link applyAddOnExtras} adds that count to the
 * plan's allowance wherever the allowance is read (lib/vendor-effective-caps.ts).
 */

/** Every Ultra add-on, in the order the owner listed them for the For Suppliers block (2026-11-06). */
export const ULTRA_ADDON_ORDER = ['category', 'service_card', 'seat', 'branch', 'waitlist', 'booking_per_date'] as const;
export type UltraAddOnKind = (typeof ULTRA_ADDON_ORDER)[number];

/** The four add-ons that are a COUNT on `vendor_profiles`, bought through `buyUltraAddOn`. */
export const COUNT_ADDON_KINDS = ['category', 'service_card', 'waitlist', 'booking_per_date'] as const;
export type CountAddOnKind = (typeof COUNT_ADDON_KINDS)[number];

type CountAddOnDef = {
  /** The `vendor_billing_catalog` row the price is read from. */
  sku: string;
  /** Order service_key prefix; the suffix is the buying shop's vendor_profile_id. */
  servicePrefix: string;
  /** The paid count on `vendor_profiles` (recomputed by the activation hook, guarded against self-grant). */
  column: 'extra_parent_categories' | 'extra_services_per_leaf' | 'extra_waitlist_acceptances' | 'extra_bookings_per_date';
  /** The plan allowance one purchase raises by one. */
  capKey: 'parentCategories' | 'servicesPerLeaf' | 'waitlistAcceptances' | 'bookingsPerDatePerService';
  /** What the shop reads on the purchase row and the order. */
  label: string;
};

export const COUNT_ADDONS: Readonly<Record<CountAddOnKind, CountAddOnDef>> = Object.freeze({
  category: {
    sku: 'vendor_extra_category',
    servicePrefix: 'vendor_extra_category__',
    column: 'extra_parent_categories',
    capKey: 'parentCategories',
    label: '+1 category',
  },
  service_card: {
    sku: 'vendor_extra_service_card',
    servicePrefix: 'vendor_extra_service_card__',
    column: 'extra_services_per_leaf',
    capKey: 'servicesPerLeaf',
    label: '+1 service card per category',
  },
  waitlist: {
    sku: 'vendor_extra_waitlist',
    servicePrefix: 'vendor_extra_waitlist__',
    column: 'extra_waitlist_acceptances',
    capKey: 'waitlistAcceptances',
    label: '+1 wait list place per date',
  },
  booking_per_date: {
    sku: 'vendor_extra_booking_per_date',
    servicePrefix: 'vendor_extra_booking_per_date__',
    column: 'extra_bookings_per_date',
    capKey: 'bookingsPerDatePerService',
    label: '+1 booking per date per service card',
  },
});

/** The two add-ons that were already sold, with their own purchase surfaces. */
const SHIPPED_ADDONS: Readonly<Record<'seat' | 'branch', { sku: string; label: string; href: string }>> = Object.freeze({
  seat: { sku: SEAT_SKU_CODE, label: '+1 team seat', href: '/vendor-dashboard/team' },
  branch: { sku: BRANCH_SKU_CODE, label: '+1 branch', href: '/vendor-dashboard/profile#where' },
});

/** The catalogue sku_code of each Ultra add-on. */
export function ultraAddOnSku(kind: UltraAddOnKind): string {
  return kind === 'seat' || kind === 'branch' ? SHIPPED_ADDONS[kind].sku : COUNT_ADDONS[kind].sku;
}

/** Every Ultra add-on SKU, in the owner's order. */
export const ULTRA_ADDON_SKUS: readonly string[] = Object.freeze(ULTRA_ADDON_ORDER.map(ultraAddOnSku));

/** Every count add-on's service_key prefix — joined into the vendor-surface and vendor-pays-Setnayan registries. */
export const COUNT_ADDON_SERVICE_KEY_PREFIXES: readonly string[] = Object.freeze(
  COUNT_ADDON_KINDS.map((k) => COUNT_ADDONS[k].servicePrefix),
);

export function isCountAddOnKind(raw: unknown): raw is CountAddOnKind {
  return typeof raw === 'string' && (COUNT_ADDON_KINDS as readonly string[]).includes(raw);
}

/** May this plan buy this add-on? Ultra (and Custom) only, for every one of the six. */
export function canBuyUltraAddOn(kind: UltraAddOnKind, tier: string | null | undefined): boolean {
  switch (kind) {
    case 'category':
      return canBuyExtraCategories(tier);
    case 'service_card':
      return canBuyExtraServiceCards(tier);
    case 'seat':
      return canBuyExtraSeats(tier);
    case 'branch':
      return canBuyExtraBranches(tier);
    case 'waitlist':
      return canBuyExtraWaitlist(tier);
    case 'booking_per_date':
      return canBuyExtraBookingsPerDate(tier);
  }
}

/** `vendor_extra_category__<vendor_profile_id>` and its siblings. */
export function countAddOnServiceKey(kind: CountAddOnKind, vendorProfileId: string): string {
  return `${COUNT_ADDONS[kind].servicePrefix}${vendorProfileId}`;
}

/** The add-on and the shop a count add-on's service_key names; null for any other key. */
export function parseCountAddOnServiceKey(
  serviceKey: string | null | undefined,
): { kind: CountAddOnKind; vendorProfileId: string } | null {
  if (typeof serviceKey !== 'string') return null;
  for (const kind of COUNT_ADDON_KINDS) {
    const p = COUNT_ADDONS[kind].servicePrefix;
    if (serviceKey.startsWith(p)) {
      const id = serviceKey.slice(p.length);
      return id.length > 0 ? { kind, vendorProfileId: id } : null;
    }
  }
  return null;
}

/** Paid count → the number stored. Null / negative / NaN floor at 0. Pure (the seat's `extraSeatsFromPaidCount`). */
export function addOnCountFromPaid(count: number | null | undefined): number {
  const n = Number(count);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** What a shop has bought, per count add-on. */
export type AddOnExtras = Readonly<Record<CountAddOnKind, number>>;
export const NO_EXTRAS: AddOnExtras = Object.freeze({ category: 0, service_card: 0, waitlist: 0, booking_per_date: 0 });

/**
 * THE PURCHASE RAISES THE CAP — the plan's allowance plus what the shop bought, per count add-on. Pure.
 * An unlimited (`Infinity`) allowance stays unlimited; a ZERO allowance stays zero (an add-on raises a number, it never
 * conjures a feature a plan does not have — the same rule as the waitlist's zero arm in SQL).
 */
export function applyAddOnExtras(caps: TierCaps, extras: AddOnExtras | null | undefined): TierCaps {
  if (!extras) return caps;
  const out: TierCaps = { ...caps };
  for (const kind of COUNT_ADDON_KINDS) {
    const key = COUNT_ADDONS[kind].capKey;
    const base = caps[key];
    const extra = addOnCountFromPaid(extras[kind]);
    if (extra === 0 || !Number.isFinite(base) || base <= 0) continue;
    out[key] = base + extra;
  }
  return out;
}

/**
 * Read what a shop has bought. Soft: any read failure (columns not migrated yet, RLS) answers {@link NO_EXTRAS}, so the
 * allowance degrades to the PLAN's number — withholding a purchase's extra room, never granting room nobody paid for.
 */
export async function fetchAddOnExtras(supabase: SupabaseClient, vendorProfileId: string): Promise<AddOnExtras> {
  try {
    const cols = COUNT_ADDON_KINDS.map((k) => COUNT_ADDONS[k].column).join(',');
    const { data, error } = await supabase
      .from('vendor_profiles')
      .select(cols)
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error) {
      // Withholding, never granting: the plan's own number stands while the bought count is unreadable.
      console.error('[supabase-error] vendor-ultra-addons: add-on counts (using the plan’s number)', error);
      return NO_EXTRAS;
    }
    if (!data) return NO_EXTRAS;
    const row = data as unknown as Record<string, number | null>;
    return {
      category: addOnCountFromPaid(row.extra_parent_categories),
      service_card: addOnCountFromPaid(row.extra_services_per_leaf),
      waitlist: addOnCountFromPaid(row.extra_waitlist_acceptances),
      booking_per_date: addOnCountFromPaid(row.extra_bookings_per_date),
    };
  } catch {
    return NO_EXTRAS;
  }
}

/**
 * The live price of one count add-on — the active catalogue row, or NULL when it is missing, off or unreadable.
 * 🔑 Null, never a fallback figure: an add-on with no readable price is not sold (the buy action refuses).
 */
export async function fetchCountAddOnPricePhp(supabase: SupabaseClient, kind: CountAddOnKind): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('vendor_billing_catalog')
      .select('price_php')
      .eq('sku_code', COUNT_ADDONS[kind].sku)
      .eq('is_active', true)
      .maybeSingle();
    if (error) {
      console.error('[supabase-error] vendor-ultra-addons: add-on price', error);
      return null;
    }
    const price = Number((data as { price_php?: number | string } | null)?.price_php);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

export type UltraAddOnRow = {
  kind: UltraAddOnKind;
  sku: string;
  /** What the add-on gives, e.g. "+1 category". */
  label: string;
  /** The catalogue's own title for the row. */
  title: string;
  /** The live catalogue price, per 4 weeks. */
  pricePhp: number;
  /** Where it is bought: the shipped seat / branch surfaces; null for the count add-ons (bought on the Plan page). */
  buyHref: string | null;
};

/**
 * EVERY ULTRA ADD-ON, FROM THE CATALOGUE, in the owner's order — categories · service cards · team seat · branches ·
 * wait list · bookings per date. The one read behind "Only Ultra can add these" wherever it is shown (the Plan page
 * here; the For Suppliers page should render it too — see the PR that added this).
 *
 * `null` = the catalogue could not be read (say so; do not show an empty list as if there were no add-ons). A row
 * that is missing or not on sale is left out — never priced from code.
 */
export async function ultraAddOns(supabase: SupabaseClient): Promise<UltraAddOnRow[] | null> {
  try {
    const { data, error } = await supabase
      .from('vendor_billing_catalog')
      .select('sku_code, title, price_php, is_active')
      .in('sku_code', [...ULTRA_ADDON_SKUS]);
    if (error) {
      console.error('[supabase-error] vendor-ultra-addons: ultraAddOns', error);
      return null;
    }
    return ultraAddOnsFromRows((data ?? []) as CatalogRow[]);
  } catch {
    return null;
  }
}

type CatalogRow = { sku_code: string; title: string | null; price_php: number | string | null; is_active: boolean | null };

/** Pure half of {@link ultraAddOns}: catalogue rows → the owner's order, active and priced rows only. */
export function ultraAddOnsFromRows(rows: readonly CatalogRow[]): UltraAddOnRow[] {
  const bySku = new Map(rows.map((r) => [r.sku_code, r]));
  const out: UltraAddOnRow[] = [];
  for (const kind of ULTRA_ADDON_ORDER) {
    const sku = ultraAddOnSku(kind);
    const r = bySku.get(sku);
    if (!r || r.is_active !== true) continue;
    const pricePhp = Number(r.price_php);
    if (!Number.isFinite(pricePhp) || pricePhp <= 0) continue;
    const shipped = kind === 'seat' || kind === 'branch' ? SHIPPED_ADDONS[kind] : null;
    out.push({
      kind,
      sku,
      label: shipped ? shipped.label : COUNT_ADDONS[kind as CountAddOnKind].label,
      title: (r.title ?? '').trim() || sku,
      pricePhp,
      buyHref: shipped ? shipped.href : null,
    });
  }
  return out;
}
