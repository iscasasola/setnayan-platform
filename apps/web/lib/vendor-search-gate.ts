/**
 * Phase C searchability gate — FLAG-DARK feature flag (vendor-tier-caps).
 *
 * The tier matrix says FREE vendors are NOT marketplace-searchable
 * (`tierCaps('free').marketplaceSearchable === false`). But enforcing that
 * with a raw `.neq('tier_state','free')` filter on the live marketplace would
 * EMPTY it today: the one real founder vendor + every demo vendor are
 * `tier_state='free'`. So the gate ships behind this flag, default OFF —
 * production behavior is unchanged until the owner flips it on once paid tiers
 * exist in prod.
 *
 * Default OFF → the marketplace query is identical to before (no filter). Set
 * `VENDOR_TIER_SEARCH_GATE=true` (env) to activate the FREE-exclusion filter.
 *
 * NOTE: when ON, the marketplace query must read a `tier_state` column on the
 * `vendor_market_stats` view — migration
 * `20260929000000_vendor_market_stats_tier_state.sql` adds it. The filter is
 * additionally suppressed in demo mode (admins browsing demo vendors must still
 * see them regardless of tier) — see the call site in /vendors/page.tsx.
 */
export function isVendorSearchGateEnabled(): boolean {
  return process.env.VENDOR_TIER_SEARCH_GATE === 'true';
}
