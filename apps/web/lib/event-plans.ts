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

/* ── 🎟 THE 18 NOV RE-CUT (owner 2026-11-18, PLAN_RULINGS_2026-11-18 rulings 15 · 16 · 20 · 21 · 34 · 36 · 38) ──────────
 * Free · Event Plus · Event Pro · Event Ultra keep their SKU codes and names; what each carries moved. Event Plus works for
 * an event with NO suppliers, so it no longer carries Setnayan AI — the AI moved up to Event Pro (and Ultra). Moved grants
 * apply to NEW purchases only: an Event Plus order placed before the line below keeps the AI it was sold with.
 */

/**
 * The moment the 18 Nov re-cut applies to new purchases: the end of the ruling day, 18 Nov 2026 (Manila). A date, not a
 * price. Moving it LATER only grandfathers more orders; never move it earlier — that would strip something a past buyer
 * paid for.
 */
export const EVENT_PLANS_RECUT_AT = '2026-11-19T00:00:00+08:00';

/**
 * Was this order placed before the 18 Nov re-cut? An order with no readable date counts as BEFORE — a bad read may only
 * ever keep a paid unlock, never take one away (the same rule as `canvasPrintsUnlockedFrom`, lib/event-ultra.ts).
 */
export function placedBeforeRecut(createdAt: string | null | undefined, cutoverIso: string = EVENT_PLANS_RECUT_AT): boolean {
  const since = Date.parse(cutoverIso);
  if (!Number.isFinite(since)) return true;
  const placed = createdAt ? Date.parse(createdAt) : NaN;
  return !Number.isFinite(placed) || placed < since;
}

/** The plans that carry Setnayan AI for every buyer (owner 2026-11-18: Event Pro and Event Ultra). */
export const AI_PLAN_SKUS: readonly string[] = Object.freeze([PLAN_PRICE_CODES.pro, PLAN_PRICE_CODES.ultra]);

/** The plan that carried Setnayan AI only for orders placed before the re-cut (Event Plus, 4 → 18 Nov 2026). */
export const AI_PLAN_SKUS_BEFORE_RECUT: readonly string[] = Object.freeze([PLAN_PRICE_CODES.plus]);

/**
 * Does an order of `serviceKey`, placed at `createdAt`, carry Setnayan AI? Event Pro and Ultra always; Event Plus only when
 * placed before the re-cut; anything else never (the AI is not sold on its own since 4 Nov).
 */
export function planOrderCarriesSetnayanAi(serviceKey: string | null | undefined, createdAt: string | null | undefined): boolean {
  if (!serviceKey) return false;
  if (AI_PLAN_SKUS.includes(serviceKey)) return true;
  if (AI_PLAN_SKUS_BEFORE_RECUT.includes(serviceKey)) return placedBeforeRecut(createdAt);
  return false;
}

/**
 * 📦 THE COUPLE'S UPLOAD ALLOWANCE PER EVENT, BY PLAN (owner 2026-11-18, rulings 34 + 36): Free 10 MB · Event Plus 500 MB ·
 * Event Pro 1 GB · Event Ultra 2 GB. The bytes themselves live in `MAKER_EVENT_MEDIA_BYTES_CAP` (lib/maker-media-limits.ts);
 * this only names the plan. The Background part alone (or the parts' cap) stays at 500 MB, as sold on 22 Oct.
 */
export type EventMediaPlan = 'free' | 'plus' | 'pro' | 'ultra';

/** The largest allowance any held plan gives — a higher plan can only widen it. */
export function eventMediaPlanFrom(held: { ultra: boolean; pro: boolean; plus: boolean; backgroundPart: boolean }): EventMediaPlan {
  if (held.ultra) return 'ultra';
  if (held.pro) return 'pro';
  if (held.plus || held.backgroundPart) return 'plus';
  return 'free';
}
