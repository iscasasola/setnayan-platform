/**
 * HOW THE PRICE LIST CLUSTERS — pure, no I/O, no React.
 *
 * ⚖ OWNER 2026-08-29, looking at the shipped list: *"why are there still so many
 * old prices"* → *"i think it would be better to fix the clustering of the
 * prices since there are only a few and we can organize them neatly."*
 *
 * ── WHAT WAS ACTUALLY WRONG, MEASURED ──────────────────────────────────────
 * Nothing was old. The list showed 44 on-sale prices sorted by PRICE ASCENDING,
 * and 17 of the 26 customer rows are ONE product — the Papic credit ladder — in
 * 17 sizes. Sorted by price, those 17 thread through the owner's nine actual
 * products, so a short list reads as an endless one.
 *
 * 🔑 AND THE LADDER HAS ITS OWN TAB. "Papic credit prices" edits it as a ladder,
 * with its anchors and its discount curve. Repeating all 17 rungs in the main
 * list adds no capability and buries everything else.
 *
 * ⚠ THE VOCABULARY IS CREDITS, NOT SHOTS (owner 2026-08-29). It is not only a
 * word: a photo costs 1 credit and a ten-second clip costs 8, so "100 shots"
 * tells a customer they get 100 pictures when what they hold is 100 credits.
 * The old word oversells the product.
 */

/** The shelf a row sits under. Customer rows cluster by what a person buys. */
export type PriceCluster =
  | 'Papic'
  | 'Setnayan AI'
  | 'The celebration page'
  | 'Film and music'
  | 'Planning tools'
  | 'Bundles'
  | 'Vendor plans'
  | 'Vendor add-ons';

/**
 * Which cluster a customer product belongs to.
 *
 * ⚠ MATCHED ON THE CODE, NEVER THE TITLE. A title is edited from the very screen
 * this groups; keying on it would let a rename silently move a product into
 * another shelf — or out of every shelf.
 */
export function clusterForRetail(serviceCode: string): PriceCluster {
  const c = serviceCode.toUpperCase();
  if (c.startsWith('PAPIC')) return 'Papic';
  if (c.startsWith('SETNAYAN_AI')) return 'Setnayan AI';
  if (c === 'COUPLE_WEBSITE_PRO' || c === 'CUSTOM_QR_GUEST' || c === 'SEATING_3D') {
    return 'The celebration page';
  }
  if (c === 'PAKANTA' || c === 'ANIMATED_MONOGRAM' || c === 'PATIKTOK_COMPILER' || c === 'LIVE_STUDIO') {
    return 'Film and music';
  }
  return 'Planning tools';
}

/** Vendor rows split by what the shop is actually buying. */
export function clusterForVendor(offeringType: string | null | undefined): PriceCluster {
  const o = (offeringType ?? '').toLowerCase();
  if (o.startsWith('subscription')) return 'Vendor plans';
  return 'Vendor add-ons';
}

/** The order shelves appear in — deliberate, not alphabetical. */
export const CLUSTER_ORDER: readonly PriceCluster[] = [
  'Papic',
  'Setnayan AI',
  'The celebration page',
  'Film and music',
  'Planning tools',
  'Bundles',
  'Vendor plans',
  'Vendor add-ons',
];

/**
 * True for a row that is one rung of the Papic credit ladder.
 *
 * 🔑 THE LADDER IS COLLAPSED, NOT HIDDEN. Every rung still exists, is still
 * searchable, and still opens — it simply stops occupying 17 of the list's 26
 * customer slots. `PAPIC_ADDON_*` and the camera rows are NOT rungs and keep
 * their own lines.
 */
export function isCreditLadderRung(serviceCode: string): boolean {
  return /^PAPIC_GUEST(_|$)/i.test(serviceCode);
}

export type LadderSummary = {
  rungs: number;
  lowestPhp: number;
  highestPhp: number;
};

/**
 * The one line that stands in for the whole ladder.
 *
 * Returns null for an empty set so a caller can never render "₱Infinity – ₱-Infinity",
 * which is what `Math.min()` of nothing produces — the same shape that once
 * printed `Infinity` to the public on /vendors.
 */
export function summariseLadder(
  rungs: readonly { pricePhp: number }[],
): LadderSummary | null {
  const priced = rungs.filter((r) => Number.isFinite(r.pricePhp));
  if (priced.length === 0) return null;
  const amounts = priced.map((r) => r.pricePhp);
  return {
    rungs: priced.length,
    lowestPhp: Math.min(...amounts),
    highestPhp: Math.max(...amounts),
  };
}
