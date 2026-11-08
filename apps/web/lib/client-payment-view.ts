/**
 * lib/client-payment-view.ts — 💸 ONE CLIENT'S PAYMENT PAGE, DECIDED (pure; THE ONE BUILD B2 §2.3, v113 Payment).
 *
 * The supplier's Payment page for one booked client draws "like the budget planner" (owner v77): Agreed · Paid · To
 * collect, one meter (paid of agreed), "₱X left to collect", and ONE Next line — "₱30,000 · Balance · 1 Nov" with
 * **Check ›** when the couple logged that payment and it waits on the supplier, else **Ask ›**.
 *
 * Every figure comes from what the client page ALREADY read, folded by the rules that already ship — never a second
 * computation that could disagree with the rows under it:
 *   · a frozen plan → `priceSummaryOf(steps, 'supplier', …)` (kind 26 — the SAME fold the money rows and the couple's
 *     Pay sheet read): Agreed = its total, Paid = its paid, To collect = its left;
 *   · no plan → the payday ledger (`bookingMoney`): Agreed = expected, Paid = received;
 *   · the ledger refused → every figure `null` and `partial`: "part of this couldn't load", never a smaller total
 *     and never ₱0.
 * A plan with an amount not resolved yet has no honest total: Agreed is `null` ("—") and To collect is a floor ("+").
 *
 * 💸 REFUNDS THE SUPPLIER GAVE (lane B2-E, `event_vendor_refunds`): Paid is what they paid LESS what went back — the
 * money the shop actually holds of theirs — and To collect is Agreed less that. A refund never edits the Agreed price
 * (that is the quote's job); the refund rows say what went back. Refunds refused → `partial` ("part of this couldn't
 * load"), never a Paid figure that silently ignores them.
 *
 * 🔒 lib/client-payment-view.test.ts
 */
import { priceSummaryOf, priceToday, type PriceSummary } from '@/lib/price-summary';
import type { StepperInstallment } from '@/lib/vendor-service-payment-schedules';
import type { BookingMoney } from '@/lib/vendor-cashflow';

export type ClientPaymentInput = {
  /** The frozen plan with the couple's payments folded in (`computeStepper`), or null when there is no plan. */
  steps: readonly StepperInstallment[] | null;
  clearedAt: string | null;
  /** No-plan booking: the payday rows for this booking (`bookingMoney`). */
  ledgerMoney: BookingMoney;
  /** The payday read was refused or short AND there is no plan to fall back on. */
  ledgerUnreadable: boolean;
  /** `YYYY-MM-DD` in Manila (`priceToday`). */
  today?: string;
  /** What the shop recorded giving back (`refundedTotalPhp`); `null` = the refunds read was refused. Absent = 0. */
  refundedPhp?: number | null;
};

export type ClientPaymentView = {
  plan: PriceSummary | null;
  agreedPhp: number | null;
  paidPhp: number | null;
  collectPhp: number | null;
  /** To collect is a floor — a plan amount is not set yet. */
  collectAtLeast: boolean;
  /** A source could not be read: the legend says so, the Next line says it could not check. */
  partial: boolean;
  meter: { agreedPct: number; paidPct: number; overPct: number };
  /** The first payment not yet received, by its place in the plan. */
  next: { amountPhp: number; name: string; dueDate: string | null; check: boolean } | null;
};

export function clientPaymentView(input: ClientPaymentInput): ClientPaymentView {
  const base = grossPaymentView(input);
  const refunded = input.refundedPhp;
  if (refunded === null) return base.plan === null && base.paidPhp === null ? base : { ...base, partial: true };
  if (!refunded || refunded <= 0 || base.paidPhp === null) return base;
  const paid = Math.max(0, Math.round((base.paidPhp - refunded) * 100) / 100);
  const agreed = base.agreedPhp;
  return {
    ...base,
    paidPhp: paid,
    collectPhp: base.collectPhp === null ? null : agreed === null ? Math.round((base.collectPhp + refunded) * 100) / 100 : Math.max(0, Math.round((agreed - paid) * 100) / 100),
    meter: { ...base.meter, paidPct: agreed && agreed > 0 ? Math.min(100, (paid / agreed) * 100) : 0 },
  };
}

/** The figures before any refund — the plan's fold, else the payday ledger. */
function grossPaymentView(input: ClientPaymentInput): ClientPaymentView {
  const today = input.today ?? priceToday();
  const plan = input.steps && input.steps.length > 0 ? priceSummaryOf(input.steps, 'supplier', { clearedAt: input.clearedAt, today }) : null;
  if (plan) {
    const unresolved = plan.totalPhp === null;
    const agreed = plan.totalPhp;
    const paidPct = agreed && agreed > 0 ? Math.min(100, (plan.paidPhp / agreed) * 100) : 0;
    const first = plan.rows.find((r) => r.state !== 'paid' && r.amountPhp !== null) ?? null;
    return {
      plan,
      agreedPhp: agreed,
      paidPhp: plan.paidPhp,
      collectPhp: plan.leftPhp,
      collectAtLeast: unresolved,
      partial: false,
      meter: { agreedPct: agreed && agreed > 0 ? 100 : 0, paidPct, overPct: 0 },
      next: first ? { amountPhp: first.amountPhp!, name: first.label, dueDate: first.dueDate, check: first.state === 'pending' } : null,
    };
  }
  if (input.ledgerUnreadable) {
    return { plan: null, agreedPhp: null, paidPhp: null, collectPhp: null, collectAtLeast: false, partial: true, meter: { agreedPct: 0, paidPct: 0, overPct: 0 }, next: null };
  }
  const m = input.ledgerMoney;
  if (m.rows.length === 0) {
    // Booked, no plan and nothing logged: there is nothing to add up — said by the page, never "₱0 · all paid".
    return { plan: null, agreedPhp: null, paidPhp: null, collectPhp: null, collectAtLeast: false, partial: false, meter: { agreedPct: 0, paidPct: 0, overPct: 0 }, next: null };
  }
  const collect = Math.max(0, Math.round((m.expectedPhp - m.receivedPhp) * 100) / 100);
  const firstDue = [...m.rows]
    .filter((r) => !r.confirmed && r.amount_php !== null)
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.seq - b.seq)[0];
  return {
    plan: null,
    agreedPhp: m.expectedPhp,
    paidPhp: m.receivedPhp,
    collectPhp: collect,
    collectAtLeast: false,
    partial: false,
    meter: { agreedPct: m.expectedPhp > 0 ? 100 : 0, paidPct: m.expectedPhp > 0 ? Math.min(100, (m.receivedPhp / m.expectedPhp) * 100) : 0, overPct: 0 },
    next: firstDue ? { amountPhp: firstDue.amount_php!, name: firstDue.label, dueDate: firstDue.due_date, check: false } : null,
  };
}
