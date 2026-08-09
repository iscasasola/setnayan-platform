/**
 * Activation flag for the SEO/GEO/AEO tier ladder — DEFAULT OFF.
 *
 * Vendor_Monetization_Model_LOCKED_2026-07-25 § 8 bundles external visibility
 * into the subscription: Basic indexability free for all · Enhanced SEO+GEO
 * Solo+ · AEO + priority sitemap Pro+. Today every vendor gets the full
 * enrichment regardless of tier, so switching this on CHANGES WHAT CRAWLERS SEE
 * for free-tier vendors — the loudest possible side effect, and irreversible on
 * the crawler's own schedule (a de-enriched page can take weeks to re-enrich).
 *
 * WHY DARK: during free-during-launch every real vendor sits on a free tier
 * (`tier_state='free'`), so enabling this now would strip the offer graph from
 * effectively the whole marketplace and tank the SEO flywheel it is meant to
 * feed. Flip only once paid vendor subscriptions are live AND the owner has
 * signed off on the crawler-visible change.
 *
 * OFF ⇒ `vendorSeoPlan()` returns the LEGACY plan for every tier — byte-
 * identical structured data and byte-identical sitemap priority to today. The
 * identity is asserted directly in `vendor-seo-tier.test.ts`.
 *
 * Kept in its own module (no imports) so `lib/vendor-seo-tier.ts` stays a pure,
 * env-free, clock-free decision layer that runs under `tsx --test`.
 */
import { envFlagEnabled } from '@/lib/env-flag';

export function isVendorSeoTierGateEnabled(): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_VENDOR_SEO_TIER_GATE);
}
