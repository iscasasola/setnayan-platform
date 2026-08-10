/**
 * papic-onboarding-selection.ts — the PURE math behind the onboarding Papic
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
export type PapicSelection = {
  /** The chosen Pool rung's service_code, or null for the free grant alone. */
  poolRungKey: string | null;
  /** The chosen Papic One rung's service_code, or null when no camera is added. */
  oneRungKey: string | null;
  /**
   * How many EXTRA dedicated cameras, on top of the free one. Always 0 when
   * `oneRungKey` is null; the two move together (see setOneCameras).
   */
  oneExtraCameras: number;
};

export const EMPTY_PAPIC_SELECTION: PapicSelection = {
  poolRungKey: null,
  oneRungKey: null,
  oneExtraCameras: 0,
};

/**
 * A ceiling on the camera stepper — NOT a product rule.
 *
 * The owner locked "no seat cap" (2026-07-29): an event may hold unlimited
 * dedicated cameras, and the studio sells them without limit. This bounds only
 * what one ONBOARDING screen can add in a single order, so a stuck "+" (or a
 * tampered payload) cannot mint a five-figure charge for a couple who has not
 * yet seen their dashboard. Adding more later is one tap in the studio, which
 * the card says.
 */
export const ONBOARDING_MAX_EXTRA_CAMERAS = 20;

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
export function poolStepOf(type: PapicTypeView, selection: PapicSelection): number {
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

/** Move the Pool stepper by ±1, clamped at both ends. Returns a new selection. */
export function stepPool(
  type: PapicTypeView,
  selection: PapicSelection,
  delta: number,
): PapicSelection {
  const next = clamp(poolStepOf(type, selection) + delta, 0, poolStepCount(type) - 1);
  return { ...selection, poolRungKey: poolRungAt(type, next)?.key ?? null };
}

/**
 * The Papic One rung a selection is on, defaulting to the CHEAPEST live rung.
 *
 * Defaulting matters: the camera stepper is the thing the couple touches, and
 * making them pick a rung first would put a second decision in front of the one
 * the owner asked for. Cheapest-first is also the only safe default — it can
 * never quote more than the couple expected.
 */
export function oneRungOf(
  type: PapicTypeView,
  selection: PapicSelection,
): PapicRungView | null {
  if (type.rungs.length === 0) return null;
  const named = selection.oneRungKey
    ? type.rungs.find((r) => r.key === selection.oneRungKey)
    : null;
  return named ?? type.rungs[0] ?? null;
}

/**
 * Set the number of EXTRA dedicated cameras.
 *
 * Keeps `oneRungKey` and `oneExtraCameras` consistent in BOTH directions: going
 * above zero pins the rung being charged (so the price cannot drift if the
 * ladder re-orders), and returning to zero clears it. A selection carrying a
 * rung key with a zero count would bill nothing while looking like a purchase
 * in every log and audit that reads the key.
 */
export function setOneCameras(
  type: PapicTypeView,
  selection: PapicSelection,
  cameras: number,
): PapicSelection {
  const rung = oneRungOf(type, selection);
  const n = rung === null ? 0 : clamp(Math.trunc(cameras), 0, ONBOARDING_MAX_EXTRA_CAMERAS);
  return {
    ...selection,
    oneExtraCameras: n,
    oneRungKey: n > 0 ? (rung?.key ?? null) : null,
  };
}

/** Switch which Papic One rung the extra cameras are bought at. */
export function setOneRung(selection: PapicSelection, rungKey: string): PapicSelection {
  return {
    ...selection,
    oneRungKey: rungKey,
    // Choosing a rung is an intent to buy: a couple who taps a rung while the
    // counter sits at zero has said what they want and would otherwise see the
    // price stay ₱0 with no indication why.
    oneExtraCameras: Math.max(1, selection.oneExtraCameras),
  };
}

/** What the extra cameras cost. Zero cameras — or no live rung — is free. */
export function onePriceOf(type: PapicTypeView, selection: PapicSelection): number {
  const rung = oneRungOf(type, selection);
  if (!rung || selection.oneExtraCameras <= 0) return 0;
  return rung.pricePhp * selection.oneExtraCameras;
}

/** Total dedicated cameras the couple ends up with: the free one plus extras. */
export function oneCameraTotal(type: PapicTypeView, selection: PapicSelection): number {
  return (type.freeCameras ?? 0) + Math.max(0, selection.oneExtraCameras);
}

/**
 * The whole quote, for DISPLAY ONLY.
 *
 * ⚠ Never send this to a payment path. The server re-reads every rung from the
 * live tier tables and every price from the active catalog when it mints the
 * order — the browser chooses WHAT, the server decides the peso figure. This
 * exists so the couple sees a running total while they press the buttons.
 */
export function quotePapicSelection(
  types: readonly PapicTypeView[],
  selection: PapicSelection,
): { poolPhp: number; onePhp: number; totalPhp: number } {
  const pool = types.find((t) => t.id === 'pool');
  const one = types.find((t) => t.id === 'one');
  const poolPhp = pool ? poolPriceAt(pool, poolStepOf(pool, selection)) : 0;
  const onePhp = one ? onePriceOf(one, selection) : 0;
  return { poolPhp, onePhp, totalPhp: poolPhp + onePhp };
}

/**
 * Is there anything to pay for? Drives whether the commit mints orders at all —
 * and so whether the couple is sent to a payment page or straight to their
 * dashboard.
 */
export function selectionHasPurchase(selection: PapicSelection): boolean {
  return (
    selection.poolRungKey !== null ||
    (selection.oneRungKey !== null && selection.oneExtraCameras > 0)
  );
}

/**
 * Normalise anything that arrives across the action boundary.
 *
 * The commit action receives this from the browser, so it is UNTRUSTED INPUT,
 * not a value object. This strips it to the two keys and a bounded integer;
 * whether those keys name real, live, purchasable rungs is decided server-side
 * against the tier tables, exactly as the studio's own buy paths do.
 */
export function parsePapicSelection(raw: unknown): PapicSelection {
  if (!raw || typeof raw !== 'object') return EMPTY_PAPIC_SELECTION;
  const o = raw as Record<string, unknown>;
  const key = (v: unknown): string | null =>
    typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 64 ? v.trim() : null;
  const n = Number(o.oneExtraCameras);
  const cameras = Number.isFinite(n) ? clamp(Math.trunc(n), 0, ONBOARDING_MAX_EXTRA_CAMERAS) : 0;
  const oneRungKey = key(o.oneRungKey);
  return {
    poolRungKey: key(o.poolRungKey),
    // Same both-directions consistency setOneCameras keeps — a posted payload
    // naming a rung with a zero count, or a count with no rung, buys nothing.
    oneRungKey: cameras > 0 ? oneRungKey : null,
    oneExtraCameras: oneRungKey === null ? 0 : cameras,
  };
}
