/**
 * 🤝 TRUST AS AN ORDERING KEY — owner 21 Nov 2026, specs DECISION_LOG "TRUSTED SHOPS RANK HIGHER IN SEARCH".
 *
 *   (1) the more distinct shops trust a shop, the higher it ranks in supplier search, Explore and the marketplace;
 *   (2) it never beats fit: it is a SORT KEY over rows that already fit (the kind of work, the area or reach, the date),
 *       so it can only reorder them — it never adds a row, and a shop that does not fit is never pulled in;
 *   (4) it never comes from anything bought or granted by a plan: the step comes from `shop_trust_counts`, derived from
 *       the ONE reader (lib/vendor-trusted-by.ts `fetchTrustSearchSteps`), which reads no plan, tier or payment to us;
 *   (5) more counts more, with DIMINISHING RETURNS: the database turns the counted trust into a STEP — how many of
 *       1 · b · b² · … it reaches — where b is the owner's admin number (`platform_settings.trust_search_step`). Blank
 *       means every step is 0, so trust lifts nobody until the owner sets it. No strength number lives in code.
 *
 * Every shipped supplier ordering is a SORT CHAIN (Explore/Discover `MarketplaceView`, Find's tier ladder in
 * `searchCategoryVendors`, the whole-marketplace box `searchMarketplaceForBench`) — not a weighted score. So trust is
 * one more KEY in each chain, right after its fit keys. Shops on the same step fall through to the chain's next key.
 * A sort the couple PICKED (Highest rated, a lens) stays theirs: there trust only breaks ties.
 */

/**
 * Comparator key: the higher trust step first. 0 when both shops sit on the same step, so the chain's next key decides.
 * Pass the step map from `fetchTrustSearchSteps`; when that read was refused the caller passes `null` and every shop
 * reads 0 — the order stays exactly as it was (nobody lifted, nobody sunk by a count nobody read).
 */
export function compareTrust(
  steps: ReadonlyMap<string, number> | null,
  a: string,
  b: string,
): number {
  if (!steps) return 0;
  return (steps.get(b) ?? 0) - (steps.get(a) ?? 0);
}
