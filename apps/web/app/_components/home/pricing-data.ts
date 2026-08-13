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
  /** The REGULAR Setnayan AI price string — what it costs after sign-up. */
  aiPrice: string;
  /** The SIGN-UP price string — what it costs if you take it while creating your
   *  event. Equals `aiPrice` when the catalog row carries no sign-up price. */
  aiIntroPrice: string;
  /** Raw catalog numbers for client-side math (never re-hardcoded client-side). */
  aiRegularPhp: number;
  aiIntroPhp: number;
  /** True only when the two genuinely differ — the one thing a surface should
   *  branch on. Derived here so no consumer re-invents the comparison, and so
   *  "there is a sign-up price" can never be inferred from a stale literal. */
  aiHasSignupPrice: boolean;
  /** recurrence suffix for the AI tier (e.g. "/28 days" or "/mo") */
  aiPeriod: string;
  /** Vendor tier prices (28-day + annual), resolved from the live catalog —
   *  the "For vendors" overlay reads these so it never hardcodes a price. */
  vendor: Awaited<ReturnType<typeof getVendorPrices>>;
};

const peso = (n: number) => `₱${formatPeso(n)}`;

/** Just the two fields this resolver cares about — so a test can pass a row
 *  without inventing a whole `V2CustomerSku`. */
export type AiPriceRow = {
  retail_price_php?: number | null;
  onboarding_price_php?: number | null;
};

/**
 * THE ONE PLACE THE TWO SETNAYAN AI PRICES ARE DECIDED — used by this module and
 * by `/pricing` directly, so the public page and the nav overlay can never
 * disagree about whether there is a sign-up price.
 *
 * Four rules, each of which failed a different way before it was written down:
 *
 *  1 · NULL SIGN-UP MEANS "NO DISCOUNT ON THIS SERVICE", NEVER FREE. Most catalog
 *      rows carry no `onboarding_price_php`. Reading NULL as 0 would hand the
 *      product away, so it falls back to the regular price and never to zero —
 *      deliberately the same rule, in the same words, as the checkout resolver
 *      in `lib/setnayan-ai-event-pricing.ts`.
 *  2 · A SIGN-UP PRICE AT OR ABOVE THE REGULAR ONE IS IGNORED. Showing it would
 *      punish buying early. The checkout ladder already refuses that crossing in
 *      `lib/setnayan-ai-price-display-matches-charge.test.ts`; display must not
 *      be laxer than the charge.
 *  3 · AN UNREADABLE ROW YIELDS ZERO, NOT A PESO GUESS. The `?? 499` that used to
 *      live here was five times off the live ₱2,499 by the time anyone looked.
 *      Callers render no figure at all rather than a confident wrong one.
 *  4 · `hasSignupPrice` IS DERIVED HERE, not re-compared by each surface, so a
 *      page can never claim a sign-up price it is not showing.
 */
export function resolveAiPrices(row: AiPriceRow | null | undefined): {
  regularPhp: number;
  introPhp: number;
  hasSignupPrice: boolean;
} {
  const usable = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v > 0;

  const regularPhp = usable(row?.retail_price_php) ? row.retail_price_php : 0;
  const signup = row?.onboarding_price_php;
  const introPhp =
    usable(signup) && regularPhp > 0 && signup < regularPhp ? signup : regularPhp;

  return { regularPhp, introPhp, hasSignupPrice: regularPhp > 0 && introPhp < regularPhp };
}

/**
 * Setnayan AI is a ONE-TIME, wedding-anchored purchase (owner 2026-07-10): one
 * charge, access until the event date. The prior ₱499→₱799/28-day subscription
 * is retired, so there is no recurrence suffix.
 *
 * ⚠ The figure that used to be quoted in this docblock is deliberately gone. It
 * said ₱499 while the live catalog said ₱2,499 — a price written into a comment
 * is a promise nobody re-reads, and this one had been wrong for weeks.
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

  // Setnayan AI is a ONE-TIME, wedding-anchored purchase (owner 2026-07-10):
  // one charge, access until the event date. There is no renewal.
  //
  // 🔑 BUT THERE ARE TWO PRICES AGAIN, FOR A DIFFERENT REASON (owner 2026-08-12):
  // a SIGN-UP price if you take it while creating your event, and a regular
  // price afterwards. `aiIntroPhp`/`aiRegularPhp` were built for the retired
  // ₱499→₱799 cadence and had been collapsed to one value with a comment saying
  // there was no split. The comment was true of the old cadence and false of the
  // live catalog: `onboarding_price_php` has been populated and CHARGED since
  // 2026-08-12, while every public surface showed one number, because
  // fetchV2CustomerCatalog never selected the column.
  //
  // ⚠ NULL MEANS "NO SIGN-UP PRICE ON THIS SERVICE", NEVER FREE — so the sign-up
  // figure falls back to the regular one and never to zero. Same rule as the
  // checkout resolver in lib/setnayan-ai-event-pricing.ts, deliberately worded
  // the same way so the two cannot drift apart in meaning.
  //
  // ⚠ NO PESO FALLBACK. The old `?? 499` was FIVE TIMES off the live ₱2,499 by
  // the time it was found, and nothing checked it because it was declared as a
  // non-SKU literal. An unreadable catalog now yields null and the caller
  // renders no figure at all — a missing price is recoverable; a confidently
  // wrong one on the page where somebody decides to pay is not.
  const ai = catalog.find((s) => s.service_code === 'SETNAYAN_AI');
  const { regularPhp, introPhp, hasSignupPrice } = resolveAiPrices(ai);

  return {
    aiPrice: regularPhp > 0 ? peso(regularPhp) : '',
    aiIntroPrice: introPhp > 0 ? peso(introPhp) : '',
    aiRegularPhp: regularPhp,
    aiIntroPhp: introPhp,
    aiHasSignupPrice: hasSignupPrice,
    aiPeriod: aiPeriodSuffix(),
    vendor,
  };
}
