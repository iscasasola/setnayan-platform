/**
 * 🤝 TRUST AS AN ORDERING KEY — owner 21 Nov 2026, specs DECISION_LOG "TRUSTED SHOPS RANK HIGHER IN SEARCH".
 *
 *   (1) the more distinct shops trust a shop, the higher it ranks in supplier search, Explore and the marketplace;
 *   (2) it never beats fit: it is a SORT KEY over rows that already fit (the kind of work, the area or reach, the date),
 *       so it can only reorder them — it never adds a row, and a shop that does not fit is never pulled in;
 *   (4) it never comes from anything bought or granted by a plan: the count is `shop_qualified_trust_counts`
 *       (lib/vendor-trusted-by.ts `fetchQualifiedTrustCounts`, the ONE reader) and reads no plan, tier or payment;
 *   (5) more counts more, with DIMINISHING RETURNS, so a long tail of trust cannot bury fit or new shops.
 *
 * ── HOW THE CURVE MAPS TO THE SHIPPED ORDERING (RULE 0: extend it, never add a second ranking) ──
 * Every shipped supplier ordering is a SORT CHAIN (Explore/Discover `MarketplaceView`, Find's tier ladder in
 * `searchCategoryVendors`, the whole-marketplace box `searchMarketplaceForBench`) — not a weighted score. So trust is
 * one more KEY in each chain, right after its fit keys, and there is no strength weight to set. Diminishing returns
 * are the key itself: the count is read in doubling steps — 0 · 1 · 2–3 · 4–7 · 8–15 · … — so each step needs twice
 * the trust of the one below, and shops in the same step fall through to the chain's next key unchanged.
 * ⚠ The step shape (doubling) is OWNER TO CONFIRM (21 Nov ruling (5)); it is the only choice made here.
 */

/** The trust step for a count: 0 → 0, 1 → 1, 2–3 → 2, 4–7 → 3, 8–15 → 4 … (doubling; diminishing returns). */
export function trustStep(count: number | null | undefined): number {
  const n = Number(count ?? 0);
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.floor(Math.log2(n)) + 1;
}

/**
 * Comparator key: higher trust step first. 0 when both shops sit in the same step, so the chain's next key decides.
 * Pass the count map from `fetchQualifiedTrustCounts`; when that read was refused the caller passes `null` and every
 * shop reads 0 — the order stays exactly as it was (nobody lifted, nobody sunk by a count nobody read).
 */
export function compareTrust(
  counts: ReadonlyMap<string, number> | null,
  a: string,
  b: string,
): number {
  if (!counts) return 0;
  return trustStep(counts.get(b)) - trustStep(counts.get(a));
}
