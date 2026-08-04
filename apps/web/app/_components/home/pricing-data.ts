/**
 * Catalog-driven pricing data for the homepage + marketing-chrome nav overlays.
 *
 * WHAT IT SERVES TODAY: the Setnayan AI price line in the Prices overlay, the
 * Setnayan AI savings comparator (`setnayan-ai-story.tsx`), and the vendor tier
 * prices in the Vendors overlay. Every figure resolves from the live V2 catalog
 * by `service_code` and formats with `formatPeso`, falling back to a literal only
 * when the SKU is unreadable (a service-key-less CI build must degrade, not 500).
 *
 * Memory locks honored: NEVER hardcode prices (project_setnayan_pricing_admin_managed);
 * LIVE source = platform_retail_catalog_v2 (project_setnayan_pricing_collection).
 *
 * ── ⚠ IT USED TO SERVE A WHOLE PRICE LADDER, AND THAT IS HOW A LIE SURVIVED ──
 * `groups` (a Papic group, a Couple Website group, an à-la-carte group) and
 * `freeChips` were removed 2026-07-30 because NOTHING RENDERED THEM. The
 * 2026-07-04 overlay redesign turned the Prices popup into a summary plus one
 * line-link out to /pricing — which owns the real ladder, the estimator and the
 * à-la-carte catalog — and no consumer of `PricingData` has read either field
 * since. This module kept BUILDING them on every request anyway (including an
 * extra `papic_tier_config` round-trip), and `/api/home-pricing` kept publishing
 * them to anyone who asked.
 *
 * So when the two-type Papic lock landed (owner 2026-07-29 · Papic Pool =
 * unlimited cameras sharing one purse · Papic One = a dedicated camera with its
 * own flat shot bucket) these rows were not updated along with the surfaces that
 * show, and the payload went on advertising "First <N> cameras · unlimited shots
 * per day — Free" and "Papic One · unlimited shots per day — ₱50/guest·day".
 * Three false claims in two rows: a retired per-day meter, the POOL's free
 * shared-seat count quoted as a Papic One allowance, and a per-guest-per-day rate
 * for a product that is now flat per camera. (The count is written <N> rather
 * than spelled because the guard that forbids the literal is right to.)
 *
 * Deleting the dead payload is the fix rather than porting it: a second derived
 * ladder that nobody reads cannot be kept honest, it can only drift — and the
 * drift is invisible precisely because no one sees it. If the homepage ever wants
 * a ladder again, derive it from the two-type sources the way
 * `app/pricing/page.tsx` does (`papic_pass_tiers` / `papic_one_tiers` /
 * `papic_event_pool_config` + the live catalog) — never from
 * `papic_tier_config.points_per_day`, whose 'mini' row is NULL on prod and reads
 * as "unlimited" to every copy helper. `lib/papic-copy-guardrails.test.ts` pins
 * this file clean of Papic claims, so the next ladder has to be built that way.
 */
import { fetchV2CustomerCatalog, getVendorPrices, formatPeso } from '@/lib/v2-catalog';

export type PricingData = {
  /** Setnayan AI price string — one-time, wedding-anchored (owner 2026-07-10: "₱499"). */
  aiPrice: string;
  /** Legacy alias of aiPrice (one-time has no separate intro; kept for consumers). */
  aiIntroPrice: string;
  /** Raw catalog numbers for client-side math — the pop-up savings comparator
   *  computes intro + regular × cycles off THESE (never re-hardcoded client-side). */
  aiRegularPhp: number;
  aiIntroPhp: number;
  /** recurrence suffix for the AI tier (e.g. "/28 days" or "/mo") */
  aiPeriod: string;
  /** Vendor tier prices (28-day + annual), resolved from the live catalog —
   *  the "For vendors" overlay reads these so it never hardcodes a price. */
  vendor: Awaited<ReturnType<typeof getVendorPrices>>;
};

const peso = (n: number) => `₱${formatPeso(n)}`;

/**
 * Setnayan AI is a ONE-TIME, wedding-anchored purchase (owner 2026-07-10 · a
 * single ₱499 charge, access until the event date). The prior ₱499→₱799/28-day
 * subscription is retired, so there is no recurrence suffix.
 */
function aiPeriodSuffix(): string {
  return '';
}

export async function getHomePricingData(): Promise<PricingData> {
  // Parallel reads; helpers degrade on error so the overlay still renders.
  // getVendorPrices reuses the vendor catalog read (cache()d) for the tier prices.
  const [catalog, vendor] = await Promise.all([
    fetchV2CustomerCatalog(),
    getVendorPrices(),
  ]);

  // Setnayan AI is a ONE-TIME, wedding-anchored purchase (owner 2026-07-10): a
  // single ₱499 charge from the SETNAYAN_AI catalog row, access until the event
  // date. The ₱499→₱799/28-day subscription (and its SETNAYAN_AI_RENEW row) is
  // retired, so there is no intro/renewal split — aiRegularPhp === aiIntroPhp,
  // which collapses any legacy two-tier consumer to the single price. The ₱499
  // fallback renders only if the row is unreadable (CI / missing env), never a
  // fresh hardcode.
  const ai = catalog.find((s) => s.service_code === 'SETNAYAN_AI');
  const aiRaw = Number(ai?.retail_price_php);
  const aiIntroPhp = Number.isFinite(aiRaw) && aiRaw > 0 ? aiRaw : 499;
  const aiRegularPhp = aiIntroPhp;
  const aiIntroPrice = peso(aiIntroPhp);
  const aiPrice = aiIntroPrice;

  return {
    aiPrice,
    aiIntroPrice,
    aiRegularPhp,
    aiIntroPhp,
    aiPeriod: aiPeriodSuffix(),
    vendor,
  };
}
