/**
 * booked-budget.ts — THE SMALL BUDGET BLOCK UNDER THE BOOKED ROWS.
 *
 * Owner 2026-10-08, on the Budget prototype (approved: *"budget looks good!"*):
 * *"on the suppliers budget, we will have a button to open budget eventhough it
 * already have a budget on the screen (which is the summary and the next
 * payment dues)"*. Corpus `BUDGET_PAGE_2026-10-08_fable.md` § 2 "Suppliers ›
 * Booked tab keeps a small Budget block" and plan row B4; the prototype's
 * `?state=suppliers` frame:
 *
 *   Budget
 *   PAID ₱26,499            OWED ₱950,400
 *   ▓▓▓▓▓░░░░░░░░░  ● paid ● agreed ● target
 *   Next ₱528,000 · Seda Vertis North · Oct 5      Pay ›
 *   ( Open budget › )
 *
 * This SUPERSEDES the 2026-10-07 draft's six figures (Budget · Booked · Paid to
 * suppliers · Setnayan orders · If you book these · Buffer): the later,
 * approved Budget design moved the whole budget to its own page and left this
 * tab a summary and a door.
 *
 * ── ONE READER: THE SAME OBJECT THE BUDGET PAGE PRINTS ────────────────────
 * Every figure is a reading of the ONE `EventMoney` the Booked slot already
 * resolved for the rows (`resolveEventMoneySettled`, one call per request), by
 * the Budget page's OWN functions: `knownMoneyTotals` (what a summary may
 * state), `budgetMeter` (the bar) and `pickNextPayment` (the Next line). The
 * two surfaces cannot disagree because they do not compute — they read.
 *
 * ── A FIGURE NOBODY MEASURED IS NOT ₱0 ─────────────────────────────────────
 *   · a refused source → Paid is `null` ("—"), Owed is a FLOOR ("₱950,400+"),
 *     the meter draws no bar, and there is no Next line (it could be wrong);
 *   · every source refused → Owed is `null` too: a floor of nothing is not ₱0.
 *
 * Pure: no React, no I/O.
 */
import { knownMoneyTotals, type EventMoney } from './budget-truth';
import { budgetMeter, pickNextPayment, type BudgetMeter, type NextPayment } from './budget-page-view';

export type BookedBudgetBlock = {
  /** `null` = unknown (a source was refused). Never 0 for unknown. */
  paidPhp: number | null;
  /**
   * What is owed across the sources that answered. `atLeast` = a source was
   * refused, so this is a floor ("₱950,400+"). `null` = nothing answered.
   */
  owed: { php: number; atLeast: boolean } | null;
  /** The bar — `budgetMeter`, the Budget page's own. All zero when unknown. */
  meter: BudgetMeter;
  /** The ONE Next line — `pickNextPayment`, the Budget page's own. */
  next: NextPayment | null;
  /** A source was refused — the legend says "part of this couldn't load". */
  partial: boolean;
};

export function bookedBudgetBlock(money: EventMoney, targetPhp: number | null): BookedBudgetBlock {
  const t = knownMoneyTotals(money);
  const r = money.reads;
  const nothingRead = r.suppliers === 'failed' && r.orders === 'failed' && r.costs === 'failed';
  return {
    paidPhp: t.paidPhp,
    owed: nothingRead ? null : { php: t.owedAtLeastPhp, atLeast: t.partial },
    meter: budgetMeter({ targetPhp, agreedPhp: t.agreedPhp, paidPhp: t.paidPhp }),
    // A partial ledger may have lost the earliest payment: no Next line rather
    // than a wrong one (the Budget page's own rule, `ledgerRefused ? null`).
    next: t.partial ? null : pickNextPayment(money.lines),
    partial: t.partial,
  };
}
