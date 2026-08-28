/**
 * onboarding-services-selection.ts — the PURE math behind the onboarding Papic
 * picker (owner 2026-08-11).
 *
 * ── WHAT THE OWNER ASKED FOR ────────────────────────────────────────────────
 *   "how many shots do you want for this event? 50 - Free … then they can press
 *    + and minus. which will set how much they will pay. Or papic one (pick how
 *    many papic one they want to add)."
 *
 * This module turns that into arithmetic. It holds NO copy, NO React, and no
 * number of its own — every points figure and every peso figure arrives inside
 * the already-resolved `PapicTypeView` (live tier tables + the active catalog).
 * It is the client half; the server RE-RESOLVES both the rung and the price from
 * the catalog at mint time and never trusts anything computed here (SEC-4).
 *
 * ── WHY + AND − WALK A LADDER AND NOT SINGLE SHOTS ──────────────────────────
 * The obvious reading of "press +" is a free-running counter — 50, 51, 52…
 * There is no such product. Papic Pool is sold in whole blocks, each its own
 * catalog SKU with its own price, and there is no SKU for an arbitrary count. A
 * free-running counter could therefore display a quantity that cannot be
 * ordered, priced, or granted — a fake door with a number on it.
 *
 * So a step IS a rung: step 0 is the free grant alone, step k adds rung k-1.
 * The screen still reads exactly as the owner described (a shot count that goes
 * up, a price that follows), and every value it can land on is a real, live,
 * purchasable thing. `rungs` arrives cheapest-first and already filtered to what
 * the catalog can actually price, so a retired rung shortens the ladder rather
 * than putting an unbuyable step in the middle of it.
 *
 * ── THE FREE FLOOR IS NEVER SPENT ───────────────────────────────────────────
 * The free grant is armed at event commit whatever the couple picks here, so it
 * is ADDED to every step rather than replaced by one. Step 0 costs nothing and
 * is a complete, working event — the picker has no state in which a couple who
 * pays nothing gets nothing.
 */

import type { PapicTypeView, PapicRungView } from '@/lib/onboarding/services-step-data';

/**
 * What the couple chose. Serialisable by construction — it crosses the
 * client→server action boundary at commit.
 *
 * Both keys are catalog service_codes or null. NULL means "not buying this
 * product", which is the default and the whole reason the step can still be
 * finished for free.
 */
export type ServicesStepSelection = {
  /**
   * The chosen rung's service_code, or null for the free 50 alone.
   *
   * ⚠ The name still says "pool" and that is still TRUE, not a leftover: what a
   * couple buys lands in the shared pot, and handing some of it to one camera's
   * QR happens later, in the studio, out of shots they already own. There is
   * nothing on this screen to buy that is not shared to begin with.
   */
  poolRungKey: string | null;
  /**
   * Setnayan AI, added at onboarding (owner 2026-08-11). A plain yes/no, because
   * there is exactly one of it per event — no rung, no count.
   *
   * ⚠ NO PRICE AND NO SKU RIDES WITH IT, and that is not an oversight. Setnayan
   * AI is priced PER EVENT TYPE, live in production: a wedding is one figure,
   * most events another, the smallest another again, and a vendor-free event is
   * not offered it at all. The figure is resolved server-side from the event's
   * STORED type at mint time, so a boolean is the only thing the browser is
   * allowed to have an opinion about. Sending a tier or an amount from here
   * would let a tampered payload pick a cheaper one.
   */
  ai: boolean;
};

export const EMPTY_SERVICES_SELECTION: ServicesStepSelection = {
  poolRungKey: null,
  // OFF by default. It is the largest single figure on the screen — on many
  // event types it is worth ten times the whole Papic side — so pre-ticking it
  // would be adding the expensive thing to a couple's bill on their behalf.
  ai: false,
};

// ONBOARDING_MAX_EXTRA_CAMERAS was here — a ceiling on how many dedicated
// cameras one onboarding screen could add in a single order, so a stuck "+"
// could not mint a five-figure charge for a couple who had not yet seen their
// dashboard. There is no camera stepper any more, so there is nothing to bound.

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * How many steps the Pool stepper has: the free floor, plus one per live rung.
 * Always at least 1 — an event with no sellable rung still has its free floor,
 * and the stepper renders with + already at its end rather than vanishing.
 */
export function poolStepCount(type: PapicTypeView): number {
  return 1 + type.rungs.length;
}

/** The rung a step lands on. Step 0 (the free floor) has none. */
export function poolRungAt(type: PapicTypeView, step: number): PapicRungView | null {
  const s = clamp(Math.trunc(step), 0, poolStepCount(type) - 1);
  return s === 0 ? null : (type.rungs[s - 1] ?? null);
}

/**
 * Which step a selection is sitting on. Resolves by KEY, not by index, so a
 * ladder that changes shape between render and re-render (an admin deactivating
 * a rung mid-session) falls back to the free floor instead of silently pointing
 * at a different, possibly dearer, rung.
 */
export function poolStepOf(type: PapicTypeView, selection: ServicesStepSelection): number {
  if (!selection.poolRungKey) return 0;
  const i = type.rungs.findIndex((r) => r.key === selection.poolRungKey);
  return i === -1 ? 0 : i + 1;
}

/** Total shots at a step: the free floor PLUS the rung. */
export function poolShotsAt(type: PapicTypeView, step: number): number {
  const rung = poolRungAt(type, step);
  return type.freePoints + (rung?.points ?? 0);
}

/** What a step costs. The free floor is 0 — it is granted, not sold. */
export function poolPriceAt(type: PapicTypeView, step: number): number {
  return poolRungAt(type, step)?.pricePhp ?? 0;
}

/**
 * What the same step costs if you come back for it LATER (owner 2026-08-28:
 * *"They can order later, but they will lose the 10% discount."*).
 *
 * Equal to `poolPriceAt` when this rung carries no sign-up discount, so a caller
 * can compare the two and show the saving ONLY when there is one. Never invents
 * a "was" price — that is the oldest trick in retail and we are not doing it.
 */
export function poolListPriceAt(type: PapicTypeView, step: number): number {
  const rung = poolRungAt(type, step);
  return rung ? Math.max(rung.listPricePhp, rung.pricePhp) : 0;
}

/** Move the Pool stepper by ±1, clamped at both ends. Returns a new selection. */
export function stepPool(
  type: PapicTypeView,
  selection: ServicesStepSelection,
  delta: number,
): ServicesStepSelection {
  const next = clamp(poolStepOf(type, selection) + delta, 0, poolStepCount(type) - 1);
  return { ...selection, poolRungKey: poolRungAt(type, next)?.key ?? null };
}

// ── PAPIC ONE IS GONE FROM THIS SCREEN (owner 2026-08-11) ──────────────────
//
// `oneRungOf` · `setOneCameras` · `setOneRung` · `onePriceOf` · `oneCameraTotal`
// lived here, driving a "how many dedicated cameras do you want" stepper.
// Papic is one product now: cameras are FREE and UNLIMITED, and a dedicated one
// is made in the studio by handing it shots the couple already owns.
//
// 🔑 THE WHOLE CONTROL WAS DELETED, not defaulted to zero. A stepper whose only
// legal answer is zero is a fake door: it asks a question with one possible
// answer, and the couple reasonably concludes the thing it names still costs
// money. Deleting it is the only way the screen states the truth.

/**
 * The whole quote, for DISPLAY ONLY.
 *
 * ⚠ Never send this to a payment path. The server re-reads every rung from the
 * live tier tables and every price from the active catalog when it mints the
 * order — the browser chooses WHAT, the server decides the peso figure. This
 * exists so the couple sees a running total while they press the buttons.
 */
export function quoteServicesStepSelection(
  types: readonly PapicTypeView[],
  selection: ServicesStepSelection,
  /**
   * The event's own Setnayan AI price, already resolved for THIS event type
   * (view.ai.pricePhp). Null / 0 when the card is not offered at all.
   */
  aiPricePhp: number | null = null,
): { poolPhp: number; aiPhp: number; papicPhp: number; totalPhp: number } {
  const pool = types.find((t) => t.id === 'pool');
  const poolPhp = pool ? poolPriceAt(pool, poolStepOf(pool, selection)) : 0;
  const aiPhp = selection.ai && aiPricePhp && aiPricePhp > 0 ? aiPricePhp : 0;
  // `papicPhp` is kept SEPARATE from the grand total on purpose (owner
  // 2026-08-11, confirming "yes it can be just 50 and 499"): on many event types
  // the whole Papic side is a few tens of pesos and the planner is several
  // hundred, so folding them into one number makes Papic look like the thing
  // that got expensive. The screen shows two lines.
  return { poolPhp, aiPhp, papicPhp: poolPhp, totalPhp: poolPhp + aiPhp };
}

/**
 * The same selection at LATER prices — what these exact picks would cost if the
 * person came back for them after the create flow.
 *
 * ⚖ Owner, 2026-08-28: *"They can order later, but they will lose the 10%
 * discount."* — and *"Onboarding discount should be visible and easy to
 * understand that this discount only applies on onboarding."* A discount whose
 * deadline is not stated is one somebody feels tricked by later, so the screen
 * has to be able to name the other number.
 *
 * ⛔ IT CANNOT INVENT ONE. Every rung's `listPricePhp` collapses onto its
 * `pricePhp` when that rung carries no sign-up discount, so a catalog with no
 * discounts makes this identical to the real total and the saving line vanishes
 * on its own. **There is no path here that produces a struck-through figure
 * nobody was ever charged.**
 *
 * ⚠ DISPLAY ONLY, like its sibling. The server re-reads every price when it
 * mints; this is a sentence on a screen, never an input to a charge.
 */
export function quoteServicesStepLaterSelection(
  types: readonly PapicTypeView[],
  selection: ServicesStepSelection,
  aiListPricePhp: number | null = null,
): number {
  const pool = types.find((t) => t.id === 'pool');
  const poolPhp = pool ? poolListPriceAt(pool, poolStepOf(pool, selection)) : 0;
  const aiPhp = selection.ai && aiListPricePhp && aiListPricePhp > 0 ? aiListPricePhp : 0;
  return poolPhp + aiPhp;
}

/**
 * Is there anything to pay for? Drives whether the commit mints orders at all —
 * and so whether the couple is sent to a payment page or straight to their
 * dashboard.
 */
export function selectionHasPurchase(selection: ServicesStepSelection): boolean {
  return selection.poolRungKey !== null || selection.ai;
}

/** Toggle Setnayan AI. Its own setter so the AI card never touches Papic state. */
export function setAi(
  selection: ServicesStepSelection,
  ai: boolean,
): ServicesStepSelection {
  return { ...selection, ai };
}

/**
 * Normalise anything that arrives across the action boundary.
 *
 * The commit action receives this from the browser, so it is UNTRUSTED INPUT,
 * not a value object. This strips it to the two keys and a bounded integer;
 * whether those keys name real, live, purchasable rungs is decided server-side
 * against the tier tables, exactly as the studio's own buy paths do.
 */
export function parseServicesStepSelection(raw: unknown): ServicesStepSelection {
  if (!raw || typeof raw !== 'object') return EMPTY_SERVICES_SELECTION;
  const o = raw as Record<string, unknown>;
  const key = (v: unknown): string | null =>
    typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 64 ? v.trim() : null;
  return {
    poolRungKey: key(o.poolRungKey),
    // ⚠ `oneRungKey` / `oneExtraCameras` are deliberately NOT read, even though
    // a tab opened before this change will still post them. Dropping them here
    // is what makes a stale payload buy the couple's actual pick instead of a
    // retired product at a price nobody set.
    // Anything but a genuine yes is a no. `'true'` is accepted because the
    // `/onboarding/simple` flow posts this as a FORM FIELD, where every value is
    // a string and `Boolean('false')` is `true` — the classic way a checkbox
    // ends up permanently ticked. Everything else, including 'false', '0', '',
    // and a missing field, is false.
    ai: o.ai === true || o.ai === 'true',
  };
}
