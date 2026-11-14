/**
 * 💰 THE COUPLE'S EVENT PLANS — the one place every surface reads a plan's price and its included Papic credits
 * (truth sweep, owner 2026-11-13: "update all pricing … no typed prices"). Pure, no I/O: the caller hands in rows from
 * `fetchV2CustomerCatalog` (`platform_retail_catalog_v2`, ACTIVE rows only), so the front door, /pricing and the
 * in-app plan screen cannot disagree about the same row.
 *
 * Free · Event Plus · Event Pro · Event Ultra. Event Pro IS `COUPLE_WEBSITE_PRO`. A missing, inactive, unread or
 * non-positive row is null — the card then names no price and no credit count, never a remembered one.
 *
 * 💎 Event Ultra (`EVENT_ULTRA`, PR #7601): upgrading to it from Plus or Pro pays the difference (owner 13 Nov).
 */

/** The service codes the plan cards read. 💎 Event Ultra: owner 2026-11-13 (#7601). */
export const PLAN_PRICE_CODES = { plus: 'EVENT_PLUS', pro: 'COUPLE_WEBSITE_PRO', ultra: 'EVENT_ULTRA' } as const;

/** Event Plus, Event Pro and Event Ultra, in pesos — null when the row is not on sale or could not be read. */
export type PlanPrices = { plus: number | null; pro: number | null; ultra: number | null };

/** The Papic credits each plan includes — null when unread or none. */
export type PlanCredits = { plusCredits: number | null; proCredits: number | null; ultraCredits: number | null };

/**
 * Picks the three prices out of the customer catalogue. Never a fallback figure: a missing, inactive or non-positive row
 * is null, and the card then names no price.
 */
export function planPricesFrom(
  rows: ReadonlyArray<{ service_code: string; retail_price_php: number | null }>,
): PlanPrices {
  const php = (code: string): number | null => {
    const v = Number(rows.find((r) => r.service_code === code)?.retail_price_php);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  return { plus: php(PLAN_PRICE_CODES.plus), pro: php(PLAN_PRICE_CODES.pro), ultra: php(PLAN_PRICE_CODES.ultra) };
}

/**
 * The credits Event Plus, Event Pro and Event Ultra grant, from the same rows (`included_papic_credits` — the number the
 * activation hook tops the event up to). Never typed: an unread or empty row is null and the card names no number.
 */
export function planCreditsFrom(
  rows: ReadonlyArray<{ service_code: string; included_papic_credits?: number | null }>,
): PlanCredits {
  const n = (code: string): number | null => {
    const v = Number(rows.find((r) => r.service_code === code)?.included_papic_credits);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  return { plusCredits: n(PLAN_PRICE_CODES.plus), proCredits: n(PLAN_PRICE_CODES.pro), ultraCredits: n(PLAN_PRICE_CODES.ultra) };
}
