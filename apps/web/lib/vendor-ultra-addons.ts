import type { SupabaseClient } from '@supabase/supabase-js';

import { BRANCH_SKU_CODE } from './vendor-branches';
import { fetchLiveTierCaps } from './vendor-plan-contents';
import { SEAT_SKU_CODE } from './vendor-seats';
import {
  canBuyExtraBookingsPerDate,
  canBuyExtraBranches,
  canBuyExtraCategories,
  canBuyExtraSeats,
  canBuyExtraServiceCards,
  canBuyExtraWaitlist,
  canBuyTheUltraAddOn,
  holdsBoughtExtras,
  STORAGE_GB,
  ULTRA_ADDON_GIVES,
  WAITLIST_SETTING_MAX,
  type TierCaps,
} from './vendor-tier-caps';

/**
 * ULTRA ADD-ONS — owner 2026-11-06, DECISION_LOG "ULTRA ADD-ON PRICES", verbatim: *"seat, branch + 990 / the rest is
 * +199"*. Per 4 weeks, Ultra only: +1 team seat · +1 branch · +1 category · +1 service card ·
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
 * plan's allowance wherever the allowance is read ({@link fetchCapsWithAddOns}).
 */

/*
 * 🛒 THE ULTRA ADD-ON (owner 2026-11-19: *"just 1 pack"* · *"Ultra Addon"* · *"2490"* · *"they only buy the … pack"*):
 * the ONE thing a shop buys on top of a plan — +1 branch · +15 live cards · +3 people · +50 GB per 28 days, Ultra only,
 * and it may be bought more than once. One count raises FOUR allowances ({@link ULTRA_ADDON_GIVES}).
 *
 * ⏳ IT LASTS 28 DAYS PER PAYMENT (review 2026-11-19: "one ₱2,490 payment keeps the Ultra Add-on forever"). Unlike the
 * four "+1" add-ons below there is NO stored count: each paid `vendor_ultra_addon__<id>` order carries its own window
 * (`orders.expires_at`, stamped paid + 28 days by the activation hook — the paid branch's pattern), and the live number
 * is the database's `vendor_live_ultra_addons` — paid orders whose window covers now. The two database gates add it;
 * the app reads it through `vendor_live_ultra_addons_for` ({@link fetchLiveUltraAddOns}). A refund or a lapsed window
 * drops out by itself.
 */
export { ULTRA_ADDON_GIVES };

/** Every Ultra add-on, in the order shown — the Ultra Add-on first (2026-11-19), then the six of 2026-11-06. */
export const ULTRA_ADDON_ORDER = ['ultra', 'category', 'service_card', 'seat', 'branch', 'waitlist', 'booking_per_date'] as const;
export type UltraAddOnKind = (typeof ULTRA_ADDON_ORDER)[number];

/** The add-ons that are a COUNT on `vendor_profiles`, bought through `buyUltraAddOn`. Only `ultra` is on sale (2026-11-19). */
export const COUNT_ADDON_KINDS = ['ultra', 'category', 'service_card', 'waitlist', 'booking_per_date'] as const;
export type CountAddOnKind = (typeof COUNT_ADDON_KINDS)[number];

type CountAddOnDef = {
  /** The `vendor_billing_catalog` row the price is read from. */
  sku: string;
  /** Order service_key prefix; the suffix is the buying shop's vendor_profile_id. */
  servicePrefix: string;
  /** The paid count on `vendor_profiles` (recomputed by the activation hook, guarded against self-grant). */
  /** The stored count, or null for the Ultra Add-on (counted live from its paid, in-window orders). */
  column:
    | null
    | 'extra_parent_categories'
    | 'extra_services_per_leaf'
    | 'extra_waitlist_acceptances'
    | 'extra_bookings_per_date';
  /**
   * The plan allowance one purchase raises by one. `null` = it raises nothing any more: bookings per date stopped being
   * a plan limit on 2026-11-18 (ruling 17), so a "+1 booking per date" bought before then has no cap left to raise —
   * the shop's own number governs, with no plan ceiling over it. The Ultra Add-on is `null` too: it raises FOUR
   * allowances at once ({@link ULTRA_ADDON_GIVES}), applied in {@link applyAddOnExtras}.
   */
  capKey: 'parentCategories' | 'serviceCardsTotal' | 'waitlistAcceptances' | null;
  /** What the shop reads on the purchase row and the order. */
  label: string;
};

export const COUNT_ADDONS: Readonly<Record<CountAddOnKind, CountAddOnDef>> = Object.freeze({
  ultra: {
    sku: 'vendor_ultra_addon',
    servicePrefix: 'vendor_ultra_addon__',
    column: null,
    capKey: null,
    label: 'Ultra Add-on: +1 branch · +15 live cards · +3 people · +50 GB',
  },
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
    // Was +1 per category; since 2026-11-18 cards are counted in total (ruling 23/39), so a past purchase adds one card
    // to the total. Retired from sale 2026-11-14 — this only honours what was already bought.
    capKey: 'serviceCardsTotal',
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
    capKey: null,
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

/** May this plan buy this add-on? Only the Ultra Add-on is sold (Ultra only, 2026-11-19); every other one answers false. */
export function canBuyUltraAddOn(kind: UltraAddOnKind, tier: string | null | undefined): boolean {
  switch (kind) {
    case 'ultra':
      return canBuyTheUltraAddOn(tier);
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

/**
 * 🔁 RENEWING ONE ULTRA ADD-ON (controller ruling on PR #8019, 20 Nov, option A). A renewal is its own order keyed
 * `vendor_ultra_addon_renew__<the add-on's order_id>`; on approval the database's `ultra_addon_apply_renewal` moves THAT
 * add-on's window to its own live end + 28 days, and nothing else. The key deliberately does NOT start with the add-on's
 * prefix (`vendor_ultra_addon__`), so the live count never counts a renewal as a second add-on.
 */
export const ULTRA_ADDON_RENEW_PREFIX = 'vendor_ultra_addon_renew__';

export function ultraAddOnRenewalServiceKey(addOnOrderId: string): string {
  return `${ULTRA_ADDON_RENEW_PREFIX}${addOnOrderId}`;
}

/** The add-on order a renewal key names; null for any other key. Pure. */
export function parseUltraAddOnRenewalServiceKey(serviceKey: string | null | undefined): string | null {
  if (typeof serviceKey !== 'string' || !serviceKey.startsWith(ULTRA_ADDON_RENEW_PREFIX)) return null;
  const id = serviceKey.slice(ULTRA_ADDON_RENEW_PREFIX.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id.toLowerCase() : null;
}

/** One Ultra Add-on the shop holds now: its order and when its 28 days end. */
export type LiveUltraAddOn = { orderId: string; expiresAt: string };

/**
 * The shop's live Ultra Add-on ORDERS — each one the Plan page can renew. Read with the caller's own client (a shop
 * reads its own orders). `null` = UNREAD, said as such; never an empty list that would hide a Renew button.
 */
export async function fetchLiveUltraAddOnOrders(
  supabase: SupabaseClient,
  vendorProfileId: string,
  nowMs: number = Date.now(),
): Promise<LiveUltraAddOn[] | null> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('order_id, expires_at')
      .eq('service_key', countAddOnServiceKey('ultra', vendorProfileId))
      .eq('status', 'paid')
      .gt('expires_at', new Date(nowMs).toISOString())
      .order('expires_at', { ascending: true });
    if (error) {
      console.error('[supabase-error] vendor-ultra-addons: live Ultra Add-on orders', error);
      return null;
    }
    return ((data ?? []) as { order_id: string; expires_at: string | null }[])
      .filter((r) => typeof r.expires_at === 'string')
      .map((r) => ({ orderId: r.order_id, expiresAt: r.expires_at as string }));
  } catch (e) {
    console.error('[supabase-error] vendor-ultra-addons: live Ultra Add-on orders', e);
    return null;
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
export const NO_EXTRAS: AddOnExtras = Object.freeze({ ultra: 0, category: 0, service_card: 0, waitlist: 0, booking_per_date: 0 });

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
    if (key === null) continue;
    const base = caps[key];
    const extra = addOnCountFromPaid(extras[kind]);
    if (extra === 0 || !Number.isFinite(base) || base <= 0) continue;
    // The wait list never goes past its column's own ceiling (the database's trigger holds the same LEAST(…, 10)).
    out[key] = key === 'waitlistAcceptances' ? Math.min(base + extra, WAITLIST_SETTING_MAX) : base + extra;
  }
  // 🛒 The Ultra Add-on raises four allowances per purchase (owner 2026-11-19). Unlike the "+1" add-ons it ADDS to a
  // zero (Ultra's branches are never zero, but the rule is the owner's "+1 branch", not "more of what you have").
  const ultra = addOnCountFromPaid(extras.ultra);
  if (ultra > 0) {
    const add = (n: number, by: number) => (Number.isFinite(n) ? n + by * ultra : n);
    out.branchesIncluded = add(out.branchesIncluded, ULTRA_ADDON_GIVES.branches);
    out.serviceCardsTotal = add(out.serviceCardsTotal, ULTRA_ADDON_GIVES.liveCards);
    out.agentAccounts = add(out.agentAccounts, ULTRA_ADDON_GIVES.people);
    out.storageBytes = out.storageBytes === null ? null : out.storageBytes + ULTRA_ADDON_GIVES.storageGb * STORAGE_GB * ultra;
  }
  return out;
}

/**
 * Read what a shop has bought. Soft: any read failure (columns not migrated yet, RLS) answers {@link NO_EXTRAS}, so the
 * allowance degrades to the PLAN's number — withholding a purchase's extra room, never granting room nobody paid for.
 */
export async function fetchAddOnExtras(supabase: SupabaseClient, vendorProfileId: string): Promise<AddOnExtras> {
  try {
    const cols = COUNT_ADDON_KINDS.map((k) => COUNT_ADDONS[k].column).filter((c): c is NonNullable<typeof c> => c !== null).join(',');
    const [{ data, error }, ultra] = await Promise.all([
      supabase.from('vendor_profiles').select(cols).eq('vendor_profile_id', vendorProfileId).maybeSingle(),
      fetchLiveUltraAddOns(supabase, vendorProfileId),
    ]);
    if (error) {
      // Withholding, never granting: the plan's own number stands while the bought count is unreadable.
      console.error('[supabase-error] vendor-ultra-addons: add-on counts (using the plan’s number)', error);
      return NO_EXTRAS;
    }
    if (!data) return NO_EXTRAS;
    const row = data as unknown as Record<string, number | null>;
    return {
      ultra,
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
 * ⏳ THE ULTRA ADD-ONS A SHOP HOLDS NOW — paid `vendor_ultra_addon__<id>` orders whose 28-day window covers today, from
 * the database's own count (`vendor_live_ultra_addons_for`: the caller's own shop, Setnayan or the service role). Soft:
 * any failure answers 0 — withholding the bought room, never granting room nobody paid for.
 */
export async function fetchLiveUltraAddOns(supabase: SupabaseClient, vendorProfileId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('vendor_live_ultra_addons_for', { p_vendor_profile_id: vendorProfileId });
    if (error) {
      console.error('[supabase-error] vendor-ultra-addons: live Ultra Add-ons (using the plan’s number)', error);
      return 0;
    }
    return addOnCountFromPaid(typeof data === 'number' ? data : Number(data));
  } catch {
    return 0;
  }
}

/** The window one add-on payment buys, in days (owner 2026-11-19: "2490 / 4 weeks"; 2026-11-06: "per 4 weeks"). */
export const ULTRA_ADDON_PERIOD_DAYS = 28;

/** When one add-on payment approved at `approvedAtMs` stops counting — approval + 28 days, ISO. Pure. */
export function addOnWindowEnd(approvedAtMs: number): string {
  return new Date(approvedAtMs + ULTRA_ADDON_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** The Ultra Add-on's window — the same 28 days as every add-on ({@link addOnWindowEnd}). */
export const ultraAddOnWindowEnd = addOnWindowEnd;

/**
 * ⏳ DOES THIS PAID PERIOD STILL COVER NOW? — the rule `recomputeVendorAddOnCount` and the database's
 * `recount_vendor_count_addons()` / `vendor_live_ultra_addons()` all apply: a window that ends AFTER now counts; one
 * that has ended, or an order with no window at all, does not (withholding, never granting). Pure.
 */
export function addOnPeriodCoversNow(expiresAt: string | null | undefined, nowMs: number): boolean {
  if (typeof expiresAt !== 'string' || expiresAt.length === 0) return false;
  const end = Date.parse(expiresAt);
  return Number.isFinite(end) && end > nowMs;
}

/**
 * THE PLAN'S ALLOWANCES PLUS WHAT THE SHOP BOUGHT — the one read every allowance check uses (service cards, categories,
 * coverage, the wait list, bookings per date). For every plan but Ultra this is exactly `tierCaps(tier)` and nothing
 * is read; only Ultra can buy add-ons. (It replaces `lib/vendor-effective-caps.ts`, deleted with the Custom plan on
 * 2026-11-06 — that file's Custom overlay is gone and stays gone; this adds only the bought counts.)
 */
export async function fetchCapsWithAddOns(
  supabase: SupabaseClient,
  vendorProfileId: string,
  tier: string | null | undefined,
): Promise<TierCaps> {
  // 🧮 The plan's allowances as the admin last set them (vendor_plan_contents, owner 2026-11-13), the code values
  // when unread — lib/vendor-plan-contents.ts. Every create gate reads its caps through here.
  const base = await fetchLiveTierCaps(supabase, tier);
  if (!holdsBoughtExtras(tier)) return base;
  return applyAddOnExtras(base, await fetchAddOnExtras(supabase, vendorProfileId));
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
    // Only what is SOLD is listed (2026-11-19: only the Ultra Add-on). A retired row still priced for renewals —
    // the single seat and branch — is not offered.
    if (!canBuyUltraAddOn(kind, 'enterprise')) continue;
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
