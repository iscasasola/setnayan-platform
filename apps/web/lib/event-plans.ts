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

/**
 * 📌 WHAT COVERS THE EVENT'S PLAN ON "ORDERS AND RECEIPTS" (L5 · C10). Read by `readEventPlanCoverage`
 * (lib/event-services.server.ts) through the same ownership chain the gates use, so this page and the gates agree:
 *
 *   · `coveringKeys` — every order key that confers the plan: its own price code, an alias of it
 *     (`SKU_OWNERSHIP_ALIASES`: an Event Ultra order confers Event Pro) and every pack that includes it
 *     (`bundle_components`: GUIDED_PACK includes Event Pro);
 *   · `basketOrderIds` — the one-bill orders (sign-up basket, Event services bill) whose lines include it;
 *   · `granted` — held by a real grant that writes no order: an admin comp, an internal host, a founder seat.
 *     A promo free window is NOT a grant: nobody was given the plan, everyone may use it for a while.
 */
export type PlanCoverage<K extends string> = {
  held: { key: K; name: string } | null;
  coveringKeys: ReadonlyArray<string>;
  basketOrderIds: ReadonlyArray<string>;
  granted: boolean;
};

/**
 * The plan row to list on Orders, or null. A plan is listed ONLY when a real grant holds it and no live order on the
 * page covers it (its own order, an alias, a pack, a basket line) — so a pack or a basket is never listed twice and a
 * promo lists nothing nobody paid for. Null for Free and for an unread plan (never a guess). `confers` is the ownership
 * rule (`orderStatusConfersOwnership`): a cancelled, refunded or lapsed order covers nothing.
 */
export function planHeldWithoutOrder<K extends string>(
  coverage: PlanCoverage<K> | null,
  orders: ReadonlyArray<{ order_id: string; service_key: string | null; status: string }>,
  confers: (status: string | null) => boolean,
): { key: K; name: string } | null {
  const held = coverage?.held ?? null;
  if (!coverage || !held || held.key === 'free' || !(held.key in PLAN_PRICE_CODES)) return null;
  if (!coverage.granted) return null;
  const keys = new Set(coverage.coveringKeys);
  const baskets = new Set(coverage.basketOrderIds);
  const covered = orders.some(
    (o) => confers(o.status) && ((o.service_key != null && keys.has(o.service_key)) || baskets.has(o.order_id)),
  );
  return covered ? null : held;
}

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
 * The moment the 18 Nov re-cut applies to new purchases — or `null` while it has not gone live yet.
 *
 * ⏱ WHY NULL, NOT A DATE. The line must never come BEFORE the deploy that changes the words: a Plus order placed between
 * the line and the deploy was sold on the old /pricing page, which said Event Plus carries Setnayan AI — dating the line
 * earlier would take that AI away from a buyer who paid for it. The ship moment cannot be known when this is committed
 * (merging and publishing are separate events; `deploy-prod.yml` publishes on a schedule), so it is not guessed here:
 *
 *   · `null` (as committed) → NO cut yet. Every Event Plus order keeps Setnayan AI, exactly as before this PR.
 *     A bad state may only ever be GENEROUS: the worst case is a new Plus buyer getting the AI for a few hours.
 *   · 🚢 SET AT SHIP TIME, by the session that publishes: once the deploy carrying this change is SERVED (confirmed with
 *     `wait-served.sh` / the Vercel production deployment's ready time), a one-line follow-up sets this to that moment,
 *     written as Manila time, e.g. `'2026-11-20T09:41:00+08:00'`. Never earlier than the served moment; LATER only
 *     grandfathers more orders. The floor below fails CI for any value before this file's own commit.
 *
 * A date, not a price.
 */
export const EVENT_PLANS_RECUT_AT: string | null = null;

/** No ship moment can come before this — the moment this change was committed (2026-11-19 17:00 UTC). A guard, not a cut. */
export const EVENT_PLANS_RECUT_FLOOR = '2026-11-19T17:00:00Z';

/**
 * Was this order placed before the 18 Nov re-cut? An order with no readable date counts as BEFORE — a bad read may only
 * ever keep a paid unlock, never take one away (the same rule as `canvasPrintsUnlockedFrom`, lib/event-ultra.ts). With no
 * cut set (`null`), or a cut set before the floor, every order counts as before.
 */
export function placedBeforeRecut(
  createdAt: string | null | undefined,
  cutoverIso: string | null = EVENT_PLANS_RECUT_AT,
): boolean {
  const since = cutoverIso ? Date.parse(cutoverIso) : NaN;
  if (!Number.isFinite(since) || since < Date.parse(EVENT_PLANS_RECUT_FLOOR)) return true;
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
export function planOrderCarriesSetnayanAi(
  serviceKey: string | null | undefined,
  createdAt: string | null | undefined,
  cutoverIso: string | null = EVENT_PLANS_RECUT_AT,
): boolean {
  if (!serviceKey) return false;
  if (AI_PLAN_SKUS.includes(serviceKey)) return true;
  if (AI_PLAN_SKUS_BEFORE_RECUT.includes(serviceKey)) return placedBeforeRecut(createdAt, cutoverIso);
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
