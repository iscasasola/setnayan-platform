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
import { vendorSeoLevel, type VendorSeoLevel } from './vendor-tier-caps';

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
