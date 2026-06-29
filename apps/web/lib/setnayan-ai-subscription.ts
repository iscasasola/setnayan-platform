/**
 * setnayan-ai-subscription.ts — per-USER Setnayan AI term-pass math (pure).
 *
 * Setnayan AI is a per-user subscription priced ₱499 per 28-day cycle (owner
 * 2026-06-29). A "term pass" is one order whose paid amount buys N cycles; on
 * payment confirmation the SETNAYAN_AI_SUB activation hook (lib/sku-activation.ts)
 * extends `user_ai_subscription.active_until` by N × 28 days.
 *
 * These helpers are PURE (no I/O, no `new Date()` of their own — `now` is always
 * passed in) so the cycle + expiry math is fully unit-testable and deterministic.
 * The entitlement read itself lives in lib/setnayan-ai.ts.
 */

/** The catalog service_code for the per-user subscription term pass. */
export const AI_SUB_SKU = 'SETNAYAN_AI_SUB';

/** One billing cycle = 28 days (matches the vendor billing cadence). */
export const AI_SUB_CYCLE_DAYS = 28;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * How many 28-day cycles a paid amount buys, given the admin-managed unit price.
 * Rounds to the nearest whole cycle (the buyer paid unit × cycles) and never
 * returns less than 1 for a real payment. Guards a missing/zero unit price.
 */
export function cyclesFromAmount(
  amountPhp: number | null | undefined,
  unitPricePhp: number | null | undefined,
): number {
  const amount = Number(amountPhp);
  const unit = Number(unitPricePhp);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!Number.isFinite(unit) || unit <= 0) return 1; // can't divide → grant one cycle
  return Math.max(1, Math.round(amount / unit));
}

/**
 * Extend a subscription window by `cycles` × 28 days.
 *
 * Extends from whichever is later — `now` or the current (still-active) expiry —
 * so re-upping early STACKS the remaining time instead of throwing it away, and
 * re-upping after a lapse starts fresh from `now`. Returns the new expiry.
 * `cycles <= 0` is a no-op that returns the later of `now`/current unchanged.
 */
export function extendUserAiSubscription(
  currentActiveUntil: Date | string | null | undefined,
  cycles: number,
  now: Date,
): Date {
  const current = toValidDate(currentActiveUntil);
  // Base = the later of now and a still-future current expiry.
  const base =
    current && current.getTime() > now.getTime() ? current : now;
  const add = Number.isFinite(cycles) && cycles > 0 ? cycles : 0;
  return new Date(base.getTime() + add * AI_SUB_CYCLE_DAYS * MS_PER_DAY);
}

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
