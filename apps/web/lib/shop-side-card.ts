/**
 * shop-side-card.ts — the words the verified shop's desktop SIDE CARD shows (v16 S4; prototype
 * `shop_website_two_looks_2026-11-15/site.src.html` `<aside><div class="bk">`; DECISION_LOG 2026-11-15 rows "THE OWNER
 * APPROVES THE SUPPLIER WEBSITE DESIGN…" and "SHOP WEBSITE MENU…": "desktop uses the side card").
 *
 * Pure: every number comes from a read the page already made — the shop's live cards and their prices
 * (`quotePriceOf`, the S3 rule: a hidden or unset price is never ₱0), the cards' best offer (`pickBestDiscount`, the
 * ONE function every card and Find use), and the trusted review stat behind the Free-tier star gate.
 * 🔒 lib/the-shop-side-card-follows-v16-s4.test.ts
 */
import { formatCount } from './format-number';
import { formatPhpRounded } from './php';
import { quotePriceOf } from './shop-quote';
import { pickBestDiscount, type PickBestDiscountOptions } from './vendor-service-public';

type PricedRow = { vendor_service_id: string; starting_price_php: number | null };

/**
 * "from ₱45,000" — the lowest price the page SHOWS on a live card — and that card's best offer ("₱5,000 off · first
 * booking"). null when no card shows a price (hidden, unset): the card then draws no price line, never "from ₱0".
 */
export function sideCardPrice(
  rows: readonly PricedRow[],
  hidePrices: boolean,
  discountsByService: ReadonlyMap<string, Parameters<typeof pickBestDiscount>[0]>,
  opts: PickBestDiscountOptions = {},
): { from: string; offer: string | null } | null {
  let best: { row: PricedRow; php: number } | null = null;
  for (const row of rows) {
    const php = quotePriceOf(row, hidePrices);
    if (php !== null && (!best || php < best.php)) best = { row, php };
  }
  if (!best) return null;
  const offer = pickBestDiscount(discountsByService.get(best.row.vendor_service_id), best.php, opts);
  return { from: `from ${formatPhpRounded(best.php)}`, offer: offer?.label ?? null };
}

/**
 * "Setnayan Verified · ★ 4.9 · 38 reviews" (prototype `.vline`). The stars follow the page's own Free-tier gate and the
 * TRUSTED stat (receipt-backed); with no trusted review, or the gate shut, the line is just "Setnayan Verified".
 */
export function sideCardVerifiedLine(
  starsCounted: boolean,
  trusted: { trusted_avg_rating: number | null; trusted_review_count: number | null } | null,
): string {
  const count = trusted?.trusted_review_count ?? 0;
  const avg = trusted?.trusted_avg_rating ?? 0;
  if (!starsCounted || !(count > 0) || !(avg > 0)) return 'Setnayan Verified';
  return `Setnayan Verified · ★ ${avg.toFixed(1)} · ${formatCount(count)} review${count === 1 ? '' : 's'}`;
}

/** The mini month's own words (prototype): the hint under it and the door to the whole calendar. */
export const SIDE_CARD_WORDS = {
  heading: 'Check a date',
  hint: 'Tap a green day to see what you can book.',
  everyMonth: 'See every month →',
  unreadable: 'Couldn’t load this month’s days — See every month to try again.',
} as const;
