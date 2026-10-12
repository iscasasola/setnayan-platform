/**
 * price-summary.ts — KIND 26, "Price summary" (control templates round 2,
 * approved 2026-10-12: `CONTROL_TEMPLATES_ROUND2_2026-10-12_fable.md`, gallery
 * `prototypes/control_templates_round2_2026-10-12.html` § k26).
 *
 *   a quote's lines → what comes off → total → how it is paid (one row per
 *   instalment with a badge). Read-only hairline rows, no box; the total is the
 *   one bold line.
 *
 * This module is the HOW-IT-IS-PAID half, for ONE booking's payment plan, and
 * it is read by BOTH ends of the booking (the Suppliers page Pair 3, map P3):
 *
 *   couple    the Pay sheet on Suppliers › Booked
 *   supplier  the Money fold of the customer card
 *
 * Same rows, same order, same amounts, same states — only the WORDS turn to the
 * viewer ("Waiting for their check" to the couple is "Waiting for you" to the
 * supplier). The states are not decided here: they are `computeStepper`'s
 * (`lib/vendor-service-payment-schedules.ts`), the one fold of a plan and its
 * payments both sides already read. A payment the supplier said never arrived
 * folds to `due` there (H4), so it is never shown as paid OR as waiting.
 *
 * 🛑 THE BOOKING FEE IS NOT HERE. Kind 26 gives the supplier's copy a small
 * "Booking fee to Setnayan" line; the fee is created at the supplier's yes on
 * `rd/booking-fee-rules`, and couples are never told about it (owner 2026-10-12
 * #4 and #14). Nothing in this file reads, names or adds a fee — the guard
 * `price-summary.test.ts` holds the couple's words to that.
 *
 * Pure: no React, no I/O. `today` is a parameter.
 */
import type { StepperInstallment } from './vendor-service-payment-schedules';

export type PriceSummaryViewer = 'couple' | 'supplier';
export type PriceBadgeTone = 'ok' | 'warn' | 'soft' | 'late';

export type PriceSummaryRow = {
  seq: number;
  label: string;
  /** The resolved amount; `null` when the plan has not resolved one. */
  amountPhp: number | null;
  /** What to print when `amountPhp` is null — why there is no figure, never ₱0. */
  amountWords: string | null;
  /** ISO `YYYY-MM-DD`, or null when the plan has no date for it yet. */
  dueDate: string | null;
  state: StepperInstallment['state'];
  badge: { text: string; tone: PriceBadgeTone };
};

export type PriceSummary = {
  rows: PriceSummaryRow[];
  /** Σ of every instalment — `null` when any amount is still unresolved. */
  totalPhp: number | null;
  /** Σ of the paid (confirmed) instalments. */
  paidPhp: number;
  /** Σ of what is not yet confirmed, over the instalments that have an amount. */
  leftPhp: number;
  /** One payment waits on the supplier's check. */
  waiting: number;
  /** The plan was marked cleared by the supplier. */
  cleared: boolean;
};

/** The badge words, per viewer. The only place either end's words are typed. */
export const PRICE_BADGE: Record<PriceSummaryViewer, Record<StepperInstallment['state'], string>> = {
  couple: { paid: 'Paid ✓', pending: 'Waiting for their check', due: 'Due' },
  supplier: { paid: 'Received ✓', pending: 'Waiting for you', due: 'Due' },
};

/** "Oct 5" — a due day, read by its parts so it never drifts across a timezone. */
export function priceDueText(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

const cents = (php: number) => Math.round(php * 100);

/** Today in Manila as `YYYY-MM-DD` — the day a due date is compared against. */
export function priceToday(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

export function priceSummaryOf(
  steps: readonly StepperInstallment[],
  viewer: PriceSummaryViewer,
  opts: { clearedAt?: string | null; today: string },
): PriceSummary {
  let totalC = 0;
  let paidC = 0;
  let leftC = 0;
  let unresolved = false;
  let waiting = 0;
  const rows = [...steps]
    .sort((a, b) => a.seq - b.seq)
    .map((s): PriceSummaryRow => {
      const amount = s.amount_php != null && Number.isFinite(s.amount_php) ? s.amount_php : null;
      if (amount === null) unresolved = true;
      else {
        totalC += cents(amount);
        if (s.state === 'paid') paidC += cents(amount);
        else leftC += cents(amount);
      }
      if (s.state === 'pending') waiting += 1;
      const late = s.state === 'due' && s.due_date !== null && s.due_date < opts.today;
      const words = PRICE_BADGE[viewer][s.state];
      return {
        seq: s.seq,
        label: s.label,
        amountPhp: amount,
        amountWords:
          amount !== null
            ? null
            : s.amount_kind === 'percent' && s.percent_bps != null
              ? `${Math.round(s.percent_bps / 100)}% of the total`
              : 'Amount not set yet',
        dueDate: s.due_date,
        state: s.state,
        badge:
          s.state === 'due'
            ? {
                text: s.due_date ? `${late ? 'Was due' : 'Due'} ${priceDueText(s.due_date)}` : words,
                tone: late ? 'late' : 'soft',
              }
            : { text: words, tone: s.state === 'paid' ? 'ok' : 'warn' },
      };
    });
  return {
    rows,
    totalPhp: unresolved ? null : totalC / 100,
    paidPhp: paidC / 100,
    leftPhp: leftC / 100,
    waiting,
    cleared: opts.clearedAt != null,
  };
}
