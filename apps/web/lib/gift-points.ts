/**
 * 🎁 GIFT POINTS — what one gift counts toward the Gifts given badge (owner 15 Nov 2026, DECISION_LOG "GIFT POINTS =
 * ONE POINT PER ₱10 OF THE GIFT'S PRICE, ROUNDED OFF" and "Gift points · Event Pro = 600"; bc148e4e: "1 point per ₱10
 * of the gift's regular price, counted once the event is complete").
 *
 * A gift's REGULAR price (`platform_retail_catalog_v2.retail_price_php` — never a typed figure) is rounded off to a
 * round figure — one significant figure — then one point per ₱10. That one rule reproduces every value the owner
 * ruled: ₱99 → 10 · ₱499 → 50 · ₱999 → 100 · ₱2,990 → 300 · ₱5,690 → 600 · ₱9,990 → 1,000.
 *
 * A missing or non-positive price answers NULL — never a guessed number.
 *
 * The badge's counter is SQL (`shop_gift_points`, migration award_flow_gift_points_and_auto_claim), which calls the
 * SQL twin `gift_points_for_price`; the db test holds the two equal. PURE.
 */

/** Points for one gift at `pricePhp` (its regular price). Null when the price is missing or not positive. */
export function giftPointsForPrice(pricePhp: number | null | undefined): number | null {
  if (pricePhp == null || !Number.isFinite(pricePhp) || pricePhp <= 0) return null;
  const magnitude = 10 ** Math.floor(Math.log10(pricePhp));
  const rounded = Math.round(pricePhp / magnitude) * magnitude;
  return Math.round(rounded / 10);
}
