/**
 * budget-page-view — what the Budget page DRAWS, derived from the one resolver.
 *
 * `BUDGET_PAGE_2026-10-08_fable.md` §4: "Derive. — summary = sum(list)". The
 * page never runs a second query for a figure it prints: everything here is a
 * pure reading of `EventMoney` (`lib/budget-truth.ts`), so the summary and the
 * list under it cannot disagree about one peso.
 *
 * Pure — no I/O, no clock. The dates and day counts a line carries were stamped
 * once by the resolver (`paymentDueState`, the one clock); nothing here compares
 * a day count against a threshold of its own.
 */
import type { MoneyLine } from './budget-truth';

/** The summary's ONE "Next" line — the earliest dated payment still owed. */
export type NextPayment = {
  /** Still owed on that line — what is actually due, not the line's total. */
  amountPhp: number;
  /** The supplier's name, or the cost's own label when nobody supplied it. */
  name: string;
  /** ISO date, `YYYY-MM-DD`. */
  dueDate: string;
  /** `event_vendors.vendor_id`, or null for a cost with no supplier. */
  vendorId: string | null;
};

/**
 * The earliest dated, agreed payment that still has money owed on it.
 *
 * AGREED lines only (owner 2026-09-02, BA2: "we only add the finalized
 * budgets") — an un-booked supplier's quote is shopping, and telling a couple
 * their "next payment" is one they never agreed to make is the ₱80,000 defect
 * in a new place. An OVERDUE line is the earliest by definition, and it is
 * still the next thing to pay.
 *
 * Ties break on the larger amount, then the name, so the pick is deterministic.
 */
export function pickNextPayment(lines: readonly MoneyLine[]): NextPayment | null {
  let best: MoneyLine | null = null;
  for (const l of lines) {
    if (l.kind !== 'committed' || !l.dueDate || !(l.stillOwedPhp > 0)) continue;
    if (
      best === null ||
      l.dueDate < best.dueDate! ||
      (l.dueDate === best.dueDate && l.stillOwedPhp > best.stillOwedPhp) ||
      (l.dueDate === best.dueDate &&
        l.stillOwedPhp === best.stillOwedPhp &&
        (l.vendorName ?? l.label) < (best.vendorName ?? best.label))
    ) {
      best = l;
    }
  }
  if (best === null) return null;
  return {
    amountPhp: best.stillOwedPhp,
    name: best.vendorName ?? best.label,
    dueDate: best.dueDate!,
    vendorId: best.vendorId,
  };
}

/**
 * The meter under the summary: green = paid, gold = agreed, track = target,
 * a red tail when agreed runs past the target. Widths are percentages of
 * whichever is larger, target or agreed — so the bar is never longer than its
 * track and an over-target event shows HOW far over, to scale.
 */
export type BudgetMeter = {
  agreedPct: number;
  paidPct: number;
  /** Width of the red tail, anchored to the right edge. 0 when within target. */
  overPct: number;
};

export function budgetMeter(args: {
  targetPhp: number | null;
  agreedPhp: number | null;
  paidPhp: number | null;
}): BudgetMeter {
  const { targetPhp, agreedPhp, paidPhp } = args;
  // An unknown figure draws no bar. A bar at 0% would be a claim.
  if (agreedPhp === null || paidPhp === null) return { agreedPct: 0, paidPct: 0, overPct: 0 };
  const base = Math.max(targetPhp ?? 0, agreedPhp, 1);
  const pct = (n: number) => Math.max(0, Math.min(100, (n / base) * 100));
  return {
    agreedPct: pct(agreedPhp),
    paidPct: pct(paidPhp),
    overPct: targetPhp !== null && agreedPhp > targetPhp ? pct(agreedPhp - targetPhp) : 0,
  };
}

/** "Oct 5" — a due date in a row or on the Next line. Year omitted on purpose. */
export function shortDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}
