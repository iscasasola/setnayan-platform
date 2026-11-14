import { isResolvedSchedule } from './proposal-payment-schedule';
import type { PaymentScheduleItemRow } from './vendor-service-payment-schedules';

/**
 * lib/accepted-quote-plan.ts — THE PLAN A BOOKING FREEZES IS THE PLAN BOTH SIDES AGREED TO.
 *
 * 🔴 PAY-01 (live walk, 14 Nov 2026). A couple accepted a quote reading "First payment · 20% · on lock,
 * Final balance · 14 days before". The supplier said yes, the booking froze a payment plan — and the plan
 * read 50% / 50%. Measured in prod the same day: the five newest estimated plans were ALL frozen over an
 * accepted 20% quote. `freezePaymentPlanAtBooking` reads only the SERVICE's schedule template and, finding
 * none, seeded the generic 50/50 estimate — never looking at the quote the booking was made from. The
 * couple's workspace already prefers the quote over an estimate (`paymentScheduleSource`), but every reader
 * of the frozen plan that does not ask that chooser (the pay sheet's plan rows, the supplier's payday list,
 * the record card) quoted the couple a different first payment for the same money.
 *
 * 🔑 NOT A NEW NUMBER. Every amount here is copied from the quote's own frozen-on-send schedule
 * (`vendor_proposals.payment_schedule`, written by `lib/proposal-send.ts`), as a FIXED centavo amount — the
 * figure the couple read and accepted, never re-derived from a percent, so no rounding can move it.
 *
 * Returns [] when the quote carries no usable schedule; the caller then keeps its existing fallback.
 */
export function scheduleRowsFromAcceptedQuote(paymentSchedule: unknown): PaymentScheduleItemRow[] {
  if (!isResolvedSchedule(paymentSchedule)) return [];
  const installments = [...paymentSchedule.installments]
    .map((i) => i as Record<string, unknown>)
    .sort((a, b) => num(a.seq) - num(b.seq));
  const rows: PaymentScheduleItemRow[] = [];
  for (const i of installments) {
    const cents = num(i.amount_centavos);
    if (!(cents > 0)) continue;
    // The plan knows two anchors. "On the event day" is "before the event" by zero days.
    const onEvent = i.due === 'on_event';
    const anchor = i.due === 'before_event' || onEvent ? 'before_event' : 'on_lock';
    rows.push({
      schedule_item_id: '',
      vendor_service_id: '',
      vendor_profile_id: '',
      seq: rows.length,
      label: String(i.label ?? '').trim() || (i.is_downpayment === true ? 'First payment' : 'Payment'),
      amount_kind: 'fixed',
      percent_bps: null,
      amount_centavos: Math.round(cents),
      due_anchor: anchor,
      due_offset_days: onEvent ? 0 : Math.max(0, num(i.offset_days)),
      created_at: '',
      updated_at: '',
      cancellation_terms: null,
      downpayment_non_refundable: false,
      refund_window_days: null,
      no_show_forfeit: false,
    });
  }
  return rows;
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
