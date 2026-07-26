/**
 * Vendor external-visibility (SEO / GEO / AEO) tier plan — the ONE place that
 * turns a vendor's tier into "which structured-data enrichments does this page
 * emit, and what sitemap priority does this URL carry?".
 *
 * Spec: Vendor_Monetization_Model_LOCKED_2026-07-25 § 8 —
 *   • Basic indexability .............. FREE for every tier (also feeds our own SEO)
 *   • Enhanced SEO + GEO .............. Solo+
 *   • AEO + priority sitemap .......... Pro+
 *   • Top priority band ............... Enterprise · Custom ("Priority + AEO")
 *
 * PURE BY CONSTRUCTION: no env reads, no clock, no I/O. The activation flag is
 * passed IN as `gateOn` (resolved by the caller from
 * `isVendorSeoTierGateEnabled()` in lib/vendor-seo-tier-flag.ts), so every
 * branch — including the flag-OFF legacy branch — is directly unit-testable.
 *
 * FLAG-OFF IS THE LEGACY PLAN, NOT "the top tier's plan". That distinction
 * matters: LEGACY_SEO_PLAN reproduces exactly what every vendor page emits
 * today (all enrichments, flat 0.8 sitemap priority) for EVERY tier, so
 * `gateOn === false` is byte-identical to current production regardless of what
 * the tier ladder says. Asserted in vendor-seo-tier.test.ts.
 */
import { isTierAtLeast, vendorSeoLevel, type VendorSeoLevel } from './vendor-tier-caps';
import { vendorHoldsActivePaidSub } from './vendor-favorite-gate';

export interface VendorSeoPlan {
  /** The tier's bundled level (echoed for logging/telemetry + upsell copy). */
  level: VendorSeoLevel;
  /**
   * Page is crawlable and carries the core LocalBusiness identity graph
   * (name · url · description · image · city · isPartOf) + BreadcrumbList.
   * ALWAYS TRUE — basic indexability is free for all (§ 8). Modelled as a field
   * rather than an implicit assumption so that "we never de-index a vendor to
   * sell a tier" is a testable invariant, not a comment.
   */
  indexable: boolean;
  /**
   * GEO / local-entity enrichment: `knowsAbout` service entities that let
   * Google + local-pack surfaces match the vendor to category+place queries.
   * Solo+.
   */
  entityGraph: boolean;
  /**
   * AEO: the machine-answerable OFFER graph — `hasOfferCatalog` · `makesOffer`
   * · `priceRange` — the block AI answer engines quote when asked "who does X
   * in Manila and what do they charge?". Pro+.
   */
  offerGraph: boolean;
  /** `<priority>` for this vendor's URL in /sitemap-vendors.xml. */
  sitemapPriority: number;
}

/**
 * Sitemap priority per level. The spread is deliberately narrow (0.5 → 0.9):
 * `<priority>` is a RELATIVE hint about crawl ordering WITHIN one site, not a
 * ranking lever, so a wider spread would buy nothing and a free vendor at 0.5
 * still gets crawled.
 */
export const SEO_SITEMAP_PRIORITY: Record<VendorSeoLevel, number> = {
  basic: 0.5,
  enhanced: 0.7,
  aeo: 0.8,
  priority: 0.9,
};

/**
 * What every vendor gets today, before the ladder is switched on: the full
 * enrichment set and the flat 0.8 priority currently hardcoded in
 * app/sitemap-vendors.xml/route.ts. `level` is still the tier's real level so
 * telemetry/upsell copy can read it while enforcement stays off.
 */
export function legacySeoPlan(level: VendorSeoLevel): VendorSeoPlan {
  return {
    level,
    indexable: true,
    entityGraph: true,
    offerGraph: true,
    sitemapPriority: 0.8,
  };
}

/**
 * Resolve the plan for a vendor tier.
 *
 * @param tier   `vendor_profiles.tier_state` (anything unrecognized → 'free').
 * @param gateOn activation flag — pass `isVendorSeoTierGateEnabled()`. When
 *               false the LEGACY plan is returned for every tier (no behaviour
 *               change at all).
 */
export function vendorSeoPlan(
  tier: string | null | undefined,
  gateOn: boolean,
): VendorSeoPlan {
  const level = vendorSeoLevel(tier);
  if (!gateOn) return legacySeoPlan(level);

  const rank = SEO_SITEMAP_PRIORITY[level];
  return {
    level,
    // Never gated — basic indexability is free for all (§ 8).
    indexable: true,
    entityGraph: level !== 'basic', // Solo+
    offerGraph: level === 'aeo' || level === 'priority', // Pro+
    sitemapPriority: rank,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Lapse-awareness — the row-level entry point every render site MUST use.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * The subscription-bearing slice of `vendor_profiles` this module needs.
 *
 * `tier_state` is deliberately OPTIONAL, and the difference between `undefined`
 * and `null` is LOAD-BEARING:
 *   • `undefined` — the column was NOT IN THE SELECT (schema skew, or a legacy
 *     fallback select). The tier is UNKNOWN, which is NOT the same as free.
 *   • `null` / a string — the column WAS read; that is the vendor's real tier.
 */
export type VendorSeoSubRow = {
  tier_state?: string | null;
  tier_expires_at?: string | null;
};

/**
 * Collapse a LAPSED paid tier to `'free'`.
 *
 * WHY THIS EXISTS: tier lapse in this codebase is LOGIN-DRIVEN —
 * `sweep_vendor_tier_expiry` only fires from the vendor dashboard layout. A
 * public `/v/[slug]` render and a crawler hitting `/sitemap-vendors.xml` are
 * exactly the two paths where nobody is logged in, so a vendor whose
 * subscription ended three months ago still carries `tier_state='pro'` in the
 * row we read. Reading `tier_state` alone would hand them the paid SEO
 * entitlement forever. `tier_expires_at` is therefore checked EXPLICITLY, the
 * same way `vendor-favorite-gate.ts` and `enterprise-vendor-gate.ts` do.
 *
 * Free tiers (`free` / `verified`) pass through untouched — they cannot lapse.
 * A NULL expiry means "never expires" (admin-granted / off-platform comp tier).
 *
 * `now` is injected so this stays clock-free under test.
 */
export function effectiveSeoTier(
  row: VendorSeoSubRow,
  now: number = Date.now(),
): string | null {
  const tier = row.tier_state ?? null;
  if (!isTierAtLeast(tier, 'solo')) return tier; // free tiers can't lapse
  return vendorHoldsActivePaidSub(
    { tier_state: tier, tier_expires_at: row.tier_expires_at ?? null },
    now,
  )
    ? tier
    : 'free';
}

/**
 * Resolve the SEO plan for a vendor ROW — the function render sites call.
 *
 * Two things it does that `vendorSeoPlan(tier, gateOn)` cannot:
 *   1. It collapses a LAPSED paid tier to free (see {@link effectiveSeoTier}).
 *   2. It distinguishes an UNREAD tier column from a free tier. When
 *      `tier_state` is `undefined` the caller could not read the column at all
 *      (schema skew / legacy fallback select), so we return the LEGACY plan —
 *      every enrichment, flat 0.8 priority. That is the only safe direction:
 *      every other fallback in this codebase degrades toward HIDING something,
 *      but here degrading toward "free" would silently strip a *currently
 *      paying* vendor of an entitlement they bought. Withholding a purchased
 *      entitlement because of OUR deploy skew is the worse failure, and it is
 *      not a security boundary — the enrichments are public marketing data.
 */
export function vendorSeoPlanForVendor(
  row: VendorSeoSubRow,
  gateOn: boolean,
  now: number = Date.now(),
): VendorSeoPlan {
  if (row.tier_state === undefined) return legacySeoPlan(vendorSeoLevel(null));
  // Gate dark ⇒ EXACT passthrough of `vendorSeoPlan(tier, false)`, lapse logic
  // included: even the echoed `level` must not move while the flag is off.
  if (!gateOn) return legacySeoPlan(vendorSeoLevel(row.tier_state));
  return vendorSeoPlan(effectiveSeoTier(row, now), true);
}

/* ────────────────────────────────────────────────────────────────────────────
 * /sitemap-vendors.xml query planner — pure, so the fallback ladder is testable
 * without a database.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Columns the sitemap always needs. */
export const SITEMAP_BASE_COLS = 'business_slug, updated_at';
/** …plus the subscription columns, read ONLY while the gate is on. */
export const SITEMAP_TIER_COLS = 'business_slug, updated_at, tier_state, tier_expires_at';

export interface VendorSitemapQuery {
  /** PostgREST select list. */
  cols: string;
  /**
   * Whether `verification_state='verified'` AND `is_demo IS NOT TRUE` are
   * applied. These are PRIVACY/CORRECTNESS filters, not enrichment: dropping
   * them republishes demo fixtures and unverified vendors to crawlers.
   */
  visibilityFilters: boolean;
  /** Whether the result rows carry `tier_state` / `tier_expires_at`. */
  tierColumns: boolean;
}

export function firstVendorSitemapQuery(gateOn: boolean): VendorSitemapQuery {
  return {
    cols: gateOn ? SITEMAP_TIER_COLS : SITEMAP_BASE_COLS,
    visibilityFilters: true,
    tierColumns: gateOn,
  };
}

/**
 * Given the query that just failed and its PostgREST error message, decide what
 * to retry — or `null` to give up.
 *
 * THE INVARIANT THIS ENCODES: a missing TIER column may only cost us the tier
 * columns. It must NEVER cost us the visibility filters. PostgREST answers a
 * select naming an unknown column with 42703 and fails the whole query, so
 * before this planner a `tier_state` skew fell into the pre-existing
 * `is_demo | verification_state` fallback and republished every demo and
 * unverified vendor to Google. The two skews are now classified separately and
 * each drops only its own thing.
 *
 * Strictly narrowing (`tierColumns` true→false, then `visibilityFilters`
 * true→false), so the retry loop is bounded at three attempts.
 */
export function nextVendorSitemapQuery(
  current: VendorSitemapQuery,
  errorMessage: string | null | undefined,
): VendorSitemapQuery | null {
  if (!errorMessage) return null;

  // Visibility skew is checked FIRST: if BOTH are missing, only the visibility
  // fallback can succeed, and it drops the tier columns anyway.
  if (/(is_demo|verification_state)/i.test(errorMessage)) {
    if (!current.visibilityFilters) return null;
    return { cols: SITEMAP_BASE_COLS, visibilityFilters: false, tierColumns: false };
  }

  if (/(tier_state|tier_expires_at)/i.test(errorMessage)) {
    if (!current.tierColumns) return null;
    // Drop ONLY the tier columns — every visibility filter is preserved.
    return {
      cols: SITEMAP_BASE_COLS,
      visibilityFilters: current.visibilityFilters,
      tierColumns: false,
    };
  }

  return null; // not a schema skew — a real error, don't paper over it
}
