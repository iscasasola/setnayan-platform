/**
 * apps/web/lib/promo-free-windows.ts
 *
 * Reader for admin-scheduled "free this weekend" promo windows
 * (public.promo_free_windows · migration 20270908268882).
 *
 * MODEL — entitlement-OR, not a ₱0 order. A live window (is_active AND now within
 * [starts_at, ends_at)) makes its covered SKUs resolve as OWNED for the audience,
 * ORed into eventSkuActive / eventActiveSkus in lib/entitlements.ts exactly like
 * comp_grants and founder_seats. No order, no checkout, no BIR receipt. The unlock
 * is EPHEMERAL — it reverts when the window closes unless the couple separately
 * bought the SKU. (Claim-to-keep — mint a real comp grant on first use during a
 * window — is a deliberate follow-up, not V1.)
 *
 * GATE — env PROMO_FREE_WINDOWS_ENABLED (default OFF). While off, every reader
 * short-circuits BEFORE touching the DB, so entitlements + banner are byte-
 * identical to today. The owner flips the flag the day a promo should go live
 * (belt-and-suspenders over is_active + the date window).
 *
 * AUDIENCES — 'all_couples' is global: the same free SKU set for every couple
 * UNLESS the window also carries an event-date filter (event_date_from /
 * event_date_to, migration 20271208727445), in which case it is global among
 * couples whose event falls in that date range — still no per-event ROW
 * scoping (no comp_grant, no join to a specific event_id) and no cross-account
 * leak to guard, just a date predicate the caller evaluates against the one
 * event it already has in scope (see coupleWindowCoversEvent below, and
 * lib/entitlements.ts for the caller-fetches-the-facts pattern this mirrors
 * from the vendor side). The two VENDOR audiences ('all_vendors' ·
 * 'new_verified_vendors') are resolved PER VENDOR against three facts on their
 * vendor_profiles row — see the vendor section below. 'segment' is
 * schema-forward and resolves for nobody.
 *
 * Reads through the service-role admin client (promo_free_windows is admin-only
 * RLS); graceful-degrades to empty on any error / missing env, so a promo read
 * NEVER blocks a render or a gate. Mirrors the v2-catalog reader contract.
 */

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { tierRank, type VendorTier } from '@/lib/vendor-tier-caps';
import { envFlagEnabled } from '@/lib/env-flag';

/** The paid tiers a vendor free window can promote every vendor to. */
export type PromotedVendorTier = 'solo' | 'pro' | 'enterprise';

/**
 * The two VENDOR audiences. Owner rulings 2026-09-05, verbatim: *"for all
 * vendors"* (= every VERIFIED vendor) and *"for any vendor who registers and
 * submits documents on X-X"*. Both are tier promotions (a vendor SKU can never
 * be ₱0 — DB CHECK price_php > 0), so both REQUIRE promoted_vendor_tier (DB
 * CHECK promo_free_windows_vendor_tier, migration 20271207345427).
 */
export const VENDOR_DEAL_AUDIENCES = ['all_vendors', 'new_verified_vendors'] as const;
export type VendorDealAudience = (typeof VENDOR_DEAL_AUDIENCES)[number];

export type PromoAudience = 'all_couples' | VendorDealAudience | 'segment';

export function isVendorDealAudience(raw: unknown): raw is VendorDealAudience {
  return (
    typeof raw === 'string' && (VENDOR_DEAL_AUDIENCES as readonly string[]).includes(raw)
  );
}

export type PromoFreeWindow = {
  promo_window_id: string;
  title: string;
  blurb: string | null;
  covered_service_keys: string[];
  audience_type: PromoAudience;
  promoted_vendor_tier: PromotedVendorTier | null;
  starts_at: string;
  ends_at: string;
  show_banner: boolean;
  /**
   * How long EACH qualifying vendor keeps the deal, in days from the moment
   * they qualified. null = until ends_at (the window's own end). Vendor
   * audiences only; ignored for couples.
   */
  deal_length_days: number | null;
  /**
   * Inclusive event-date bounds (bare 'YYYY-MM-DD'), meaningful ONLY for
   * audience_type='all_couples' — DB CHECK
   * promo_free_windows_event_date_couples_only keeps both NULL for every
   * vendor/segment audience. Both NULL = applies to any event (unchanged
   * pre-G5 behavior). See coupleWindowCoversEvent below.
   */
  event_date_from: string | null;
  event_date_to: string | null;
};

const SELECT_COLS =
  'promo_window_id, title, blurb, covered_service_keys, audience_type, promoted_vendor_tier, starts_at, ends_at, show_banner, deal_length_days, event_date_from, event_date_to';

function mapWindow(row: Record<string, unknown>): PromoFreeWindow {
  return {
    promo_window_id: row.promo_window_id as string,
    title: row.title as string,
    blurb: (row.blurb as string | null) ?? null,
    covered_service_keys: Array.isArray(row.covered_service_keys)
      ? (row.covered_service_keys as string[])
      : [],
    audience_type: row.audience_type as PromoFreeWindow['audience_type'],
    promoted_vendor_tier: (row.promoted_vendor_tier as PromotedVendorTier | null) ?? null,
    starts_at: row.starts_at as string,
    ends_at: row.ends_at as string,
    show_banner: Boolean(row.show_banner),
    deal_length_days:
      typeof row.deal_length_days === 'number' && row.deal_length_days > 0
        ? row.deal_length_days
        : null,
    event_date_from: (row.event_date_from as string | null) ?? null,
    event_date_to: (row.event_date_to as string | null) ?? null,
  };
}

/**
 * Master kill-switch. Server-only env (the gate + banner are server-side), so no
 * NEXT_PUBLIC_ needed. Default OFF — the feature is fully inert until flipped.
 */
export function isPromoFreeWindowsEnabled(): boolean {
  return envFlagEnabled(process.env.PROMO_FREE_WINDOWS_ENABLED);
}

/**
 * The couple-audience windows that are LIVE right now (is_active, within their
 * date range, audience_type='all_couples'). cache()d per request. Returns [] when
 * the flag is off, the admin client is unavailable (CI build), or on any DB error.
 */
export const getLiveCoupleFreeWindows = cache(
  async (): Promise<PromoFreeWindow[]> => {
    if (!isPromoFreeWindowsEnabled()) return [];
    return fetchLiveWindows('all_couples');
  },
);

/**
 * Shared live-window fetch for one audience. Admin-client read; graceful-degrade
 * to [] on any error. Callers are cache()d, so this runs at most once per
 * (audience) per request. NOT flag-guarded itself — the cached callers are.
 */
async function fetchLiveWindows(
  audienceType: PromoFreeWindow['audience_type'],
): Promise<PromoFreeWindow[]> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from('promo_free_windows')
    .select(SELECT_COLS)
    .eq('is_active', true)
    .eq('audience_type', audienceType)
    .lte('starts_at', nowIso)
    .gt('ends_at', nowIso)
    .order('ends_at', { ascending: true });

  if (error || !data) return [];
  return data.map((row) => mapWindow(row as Record<string, unknown>));
}

/**
 * Does this couple WINDOW cover an event on `eventDate`? Pure predicate,
 * mirroring vendorQualifiedAt's shape/rigor on the couple side.
 *
 * Logic:
 *   • both event_date_from/to NULL → true for ANY event (including a null
 *     eventDate) — this is (c) "any event", the pre-G5 unfiltered behavior.
 *   • either bound set + eventDate falsy → FALSE. An event with no locked
 *     event_date (apps/web/lib/checklist.ts: event_date stays NULL until
 *     locked) is UNKNOWN, and unknown is excluded, never assumed included —
 *     get this backwards and an unlocked event silently qualifies for every
 *     dated promo, which is the wrong direction to be wrong in.
 *   • otherwise, lexicographic string comparison of the bare 'YYYY-MM-DD' day
 *     (`.slice(0, 10)` on both sides, defensively, in case a stray time
 *     component ever rides along) against whichever bound(s) are set.
 *     ISO 'YYYY-MM-DD' strings compare correctly as plain strings.
 */
export function coupleWindowCoversEvent(
  w: Pick<PromoFreeWindow, 'event_date_from' | 'event_date_to'>,
  eventDate: string | null | undefined,
): boolean {
  if (!w.event_date_from && !w.event_date_to) return true;
  if (!eventDate) return false;
  const day = eventDate.slice(0, 10);
  if (w.event_date_from && day < w.event_date_from.slice(0, 10)) return false;
  if (w.event_date_to && day > w.event_date_to.slice(0, 10)) return false;
  return true;
}

/**
 * The flattened set of couple service_codes that are FREE right now via any
 * live promo window COVERING `eventDate` (see coupleWindowCoversEvent — pass
 * undefined/null when there is no specific event in scope, which only matches
 * windows with no date filter). The entitlement-OR consults this in
 * eventSkuActive / eventActiveSkus. Empty set when the flag is off or nothing
 * is live/covering. cache()d per (eventDate) argument value within a request —
 * getLiveCoupleFreeWindows itself takes no args and is separately cache()d, so
 * the underlying window-list fetch is still deduped regardless of how many
 * distinct eventDates are queried in one request.
 */
export const promoFreeSkusForCouples = cache(
  async (eventDate?: string | null): Promise<Set<string>> => {
    const windows = await getLiveCoupleFreeWindows();
    const set = new Set<string>();
    for (const w of windows) {
      if (!coupleWindowCoversEvent(w, eventDate)) continue;
      for (const code of w.covered_service_keys) set.add(code);
    }
    return set;
  },
);

/**
 * Convenience predicate for a single SKU — is it free right now via a live
 * promo covering `eventDate` (or any event, for a window with no date filter)?
 */
export async function isSkuFreeForCouplesNow(
  serviceCode: string,
  eventDate?: string | null,
): Promise<boolean> {
  return (await promoFreeSkusForCouples(eventDate)).has(serviceCode);
}

/**
 * The banner windows to surface to couples — live AND show_banner=true. The
 * banner component renders the first (soonest-ending) one.
 */
export async function getCoupleFreeWindowBanners(): Promise<PromoFreeWindow[]> {
  return (await getLiveCoupleFreeWindows()).filter((w) => w.show_banner);
}

// ─────────────────────────────────────────────────────────────────────────
// Vendor audiences — a live vendor deal PROMOTES a qualifying vendor to a paid
// tier for free (resolveVendorTier ORs it in). Vendor "free" can't be a ₱0
// subscription (DB CHECK price_php > 0), so it's a tier promotion, not a comp.
//
// 🔑 RESOLVED PER VENDOR, STATELESSLY, FROM THREE FACTS on vendor_profiles:
//   verification_state — 'verified' or nothing applies (owner 2026-09-05:
//                        "all vendors" means all VERIFIED vendors; never
//                        tier_state, whose own legacy 'verified' is a trap)
//   created_at         — the sign-up moment
//   last_verified_at   — the doc-approval moment (admin/verify writes it)
// No per-vendor row, no job, no trigger. The same window row serves every
// vendor; what differs is when (and whether) each of them qualified.
// ─────────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/**
 * Which paid tier a vendor_billing_catalog row unlocks, or null for an add-on /
 * token pack. The tier rows are `solo|pro|enterprise_vendor_monthly|annual`
 * (seeded by 20260631000000 · 20260712000000 · 20270221294989 ·
 * 20270426213000). A vendor deal is a TIER promotion, so these are the only
 * catalog rows a deal can make free today — an add-on (Papic Challenges, 3D
 * Booth, Deep Search, seats, branches, the portfolio pack) has its own
 * resolver with no shared choke point, and nothing here reaches those.
 */
export function vendorTierOfSku(skuCode: string): PromotedVendorTier | null {
  const m = /^(solo|pro|enterprise)_vendor_(monthly|annual)$/.exec(skuCode);
  return m ? (m[1] as PromotedVendorTier) : null;
}

/** The three vendor_profiles facts a vendor deal is resolved against. */
export type VendorDealFacts = {
  verification_state: string | null | undefined;
  created_at: string | null | undefined;
  last_verified_at: string | null | undefined;
};

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * The moment this vendor QUALIFIED for a window, as epoch ms — or null when
 * they never do. Pure.
 *
 *   all_vendors           verified, and verified before the window closes.
 *                         Qualifies at the later of window start / approval.
 *                         A verified vendor with no approval timestamp (rows
 *                         backfilled before last_verified_at existed) counts
 *                         as approved before the window.
 *   new_verified_vendors  verified, AND sign-up AND approval both inside
 *                         [starts_at, ends_at). Qualifies at the later of the
 *                         two. Missing either timestamp → never qualifies.
 *   anything else         null — couples windows and 'segment' promote nobody.
 */
export function vendorQualifiedAt(
  w: Pick<PromoFreeWindow, 'audience_type' | 'starts_at' | 'ends_at'>,
  facts: VendorDealFacts,
): number | null {
  if (facts.verification_state !== 'verified') return null;
  const start = ms(w.starts_at);
  const end = ms(w.ends_at);
  if (start === null || end === null) return null;

  if (w.audience_type === 'all_vendors') {
    const verifiedAt = ms(facts.last_verified_at) ?? start;
    const q = Math.max(start, verifiedAt);
    return q < end ? q : null;
  }
  if (w.audience_type === 'new_verified_vendors') {
    const createdAt = ms(facts.created_at);
    const verifiedAt = ms(facts.last_verified_at);
    if (createdAt === null || verifiedAt === null) return null;
    const inside = (t: number) => t >= start && t < end;
    if (!inside(createdAt) || !inside(verifiedAt)) return null;
    return Math.max(createdAt, verifiedAt);
  }
  return null;
}

/**
 * When a vendor who qualified at `qualifiedAtMs` LOSES the deal, as epoch ms.
 * deal_length_days counts from qualification; null means the window's own end.
 * Pure.
 */
export function vendorDealEndsAt(
  w: Pick<PromoFreeWindow, 'ends_at' | 'deal_length_days'>,
  qualifiedAtMs: number,
): number {
  if (w.deal_length_days && w.deal_length_days > 0) {
    return qualifiedAtMs + w.deal_length_days * DAY_MS;
  }
  return ms(w.ends_at) ?? qualifiedAtMs;
}

/**
 * The windows currently GRANTING this vendor something at `nowMs` — qualified
 * already, deal not yet over. Pure over an already-fetched list.
 */
export function vendorDealWindowsFor(
  windows: readonly PromoFreeWindow[],
  facts: VendorDealFacts,
  nowMs: number = Date.now(),
): PromoFreeWindow[] {
  const out: PromoFreeWindow[] = [];
  for (const w of windows) {
    const q = vendorQualifiedAt(w, facts);
    if (q === null || nowMs < q) continue;
    if (nowMs >= vendorDealEndsAt(w, q)) continue;
    out.push(w);
  }
  return out;
}

/**
 * The HIGHEST paid tier any window grants this vendor at `nowMs` (by tier
 * rank), or null. Two overlapping deals (Solo + Pro) → the vendor gets the
 * better one. Pure.
 */
export function resolveVendorDealTier(
  windows: readonly PromoFreeWindow[],
  facts: VendorDealFacts,
  nowMs: number = Date.now(),
): PromotedVendorTier | null {
  let best: PromotedVendorTier | null = null;
  for (const w of vendorDealWindowsFor(windows, facts, nowMs)) {
    const t = w.promoted_vendor_tier;
    if (t && (best === null || tierRank(t) > tierRank(best))) best = t;
  }
  return best;
}

/**
 * The latest moment any vendor could still be holding this window's deal:
 * ends_at, plus deal_length_days when set (a vendor who qualified on the last
 * day keeps it that much longer). Windows past this are dead for everyone.
 */
function vendorDealHorizonMs(w: PromoFreeWindow): number {
  const end = ms(w.ends_at) ?? 0;
  return w.deal_length_days ? end + w.deal_length_days * DAY_MS : end;
}

/**
 * Every vendor-audience window that could be granting SOMEBODY right now:
 * is_active, already started, horizon not passed. cache()d per request; []
 * when the flag is off / the admin client is unavailable / any DB error. The
 * per-vendor decision is made by resolveVendorDealTier over this list.
 */
export const getVendorDealWindows = cache(async (): Promise<PromoFreeWindow[]> => {
  if (!isPromoFreeWindowsEnabled()) return [];
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const { data, error } = await admin
    .from('promo_free_windows')
    .select(SELECT_COLS)
    .eq('is_active', true)
    .in('audience_type', [...VENDOR_DEAL_AUDIENCES])
    .lte('starts_at', nowIso)
    .order('ends_at', { ascending: true });
  if (error || !data) return [];
  return data
    .map((row) => mapWindow(row as Record<string, unknown>))
    .filter((w) => vendorDealHorizonMs(w) > now);
});

/**
 * The tier a live vendor deal promotes THIS vendor to right now, or null.
 * resolveVendorTier reads this and upgrades the vendor to it (never a
 * downgrade). Short-circuits to null BEFORE any read while
 * PROMO_FREE_WINDOWS_ENABLED is off — `loadWindows` is injectable so a test
 * can prove it is never consulted while the flag is off.
 */
export async function getPromotedVendorTierFor(
  facts: VendorDealFacts,
  loadWindows: () => Promise<readonly PromoFreeWindow[]> = getVendorDealWindows,
): Promise<PromotedVendorTier | null> {
  if (!isPromoFreeWindowsEnabled()) return null;
  return resolveVendorDealTier(await loadWindows(), facts, Date.now());
}

/**
 * Promote a vendor's real tier by a resolved deal tier (never a downgrade).
 * Pure over the resolved promo tier so resolveVendorTier stays a one-liner.
 * Returns realTier unchanged when no promo outranks it.
 */
export function applyVendorTierPromotion(
  realTier: VendorTier,
  promoted: PromotedVendorTier | null,
): VendorTier {
  if (promoted && tierRank(promoted) > tierRank(realTier)) return promoted;
  return realTier;
}

/**
 * Banner windows for THIS vendor — granting them right now AND show_banner.
 * An unverified vendor is told nothing: the deal is not theirs.
 */
export async function getVendorFreeWindowBannersFor(
  facts: VendorDealFacts,
): Promise<PromoFreeWindow[]> {
  if (!isPromoFreeWindowsEnabled()) return [];
  return vendorDealWindowsFor(await getVendorDealWindows(), facts).filter((w) => w.show_banner);
}
