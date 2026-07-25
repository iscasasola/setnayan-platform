/**
 * Merit-first ranking + capped paid boost + labeled Featured slots — FLAG.
 *
 * Vendor_Monetization_Model_LOCKED_2026-07-25 § 5 (owner-insisted):
 *   • Organic rank = MERIT for everyone including Free (match to need, reviews,
 *     responsiveness, completed bookings, proximity). A better free vendor is
 *     NEVER buried.
 *   • Paid buys a CAPPED boost + clearly-labeled Featured/Sponsored slots —
 *     it amplifies quality, never manufactures it.
 *
 * Today's marketplace ladder floats EVERY `ad_rank > 0` vendor above the entire
 * review-ranked pool with no ceiling and no quality floor — that is the exact
 * pay-to-win shape § 5 forbids. This flag swaps that unbounded tier for the
 * bounded model in `lib/vendor-rank-boost.ts`.
 *
 * Default OFF → the owner-locked 2026-05-31 ladder (favorites → boosted →
 * top-10 reviews → tail) is byte-identical to today, and no Featured/Sponsored
 * chip renders anywhere. Set `NEXT_PUBLIC_VENDOR_RANK_BOOST_ENABLED=true` to
 * activate.
 *
 * NEXT_PUBLIC_ so the server search action and the client listing overlay agree
 * on one value (the overlay only ever renders a chip for a slot the server
 * already marked, so a skew can only under-render, never mislabel).
 *
 * 🚫 This flag deliberately does NOT touch `VENDOR_TIER_SEARCH_GATE` — that gate
 * hides Free vendors from search entirely, which contradicts the merit rule.
 * Never couple the two.
 */
export function isVendorRankBoostEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_VENDOR_RANK_BOOST_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
