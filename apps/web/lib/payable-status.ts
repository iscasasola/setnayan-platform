/**
 * lib/payable-status.ts — does this order still want money?
 *
 * Split out of the resolver so it can be TESTED. `payable-by-reference.ts`
 * imports `server-only`, which throws outside a Next server runtime, so
 * anything left in there is provable only by reading it — and this is the
 * decision that says whether a payer is shown a live payment code.
 */

export type PayableStatus = 'awaiting_payment' | 'settled' | 'closed';

/**
 * Which order states still want money. Anything settled or dead renders the
 * page in its closed state rather than showing a QR for money already sent —
 * paying twice is a real harm, and "the page still had a code on it" is how it
 * happens.
 */
export function statusOf(raw: string): PayableStatus {
  // EXHAUSTIVE over public.order_status, read out of production 2026-08-21:
  //   draft, submitted, awaiting_payment, paid, fulfilled, cancelled, refunded, lapsed
  // The first cut listed 'expired' and 'failed' — NEITHER EXISTS — and omitted
  // 'fulfilled' and 'lapsed', which therefore fell through to "still wants
  // money": a finished order would have shown a live QR for an amount already
  // paid. Never hand-recall an enum; read the labels.
  switch (raw) {
    case 'paid':
    case 'fulfilled':
    case 'refunded':
      return 'settled';
    case 'cancelled':
    case 'lapsed':
      return 'closed';
    case 'draft':
    case 'submitted':
    case 'awaiting_payment':
      return 'awaiting_payment';
    default:
      // An unrecognised value means the enum grew and this did not. Refuse to
      // show a payment code rather than guess — a wrongly-live QR takes money
      // twice, a wrongly-closed page is a support message.
      return 'closed';
  }
}

/**
 * 🔁 A SHOP'S PLAN HAS TWO ROWS, AND THE PLAN'S OWN ROW CAN BE AHEAD (plan-purchase audit, 2026-11-16).
 *
 * A plan purchase writes a `vendor_subscriptions` row (the plan) AND an `orders` row (somewhere to send proof).
 * Confirming at /admin/payments settles both (the activation hook calls `approve_vendor_subscription`). Confirming or
 * rejecting at /admin/subscriptions touches ONLY the plan row — the order stays `awaiting_payment` forever, so
 * /pay/<reference> kept drawing a live QR for a plan already switched on (pay twice) or already refused.
 *
 * So for a plan order, the plan row's verdict wins when it is final: `paid` → settled, `rejected` / `superseded` →
 * closed. `pending_payment`, an unread row (null) or a value this does not know leave the order's own answer
 * standing — never invent a settlement, never close a bill the plan still waits on.
 * 🔒 lib/a-confirmed-plan-is-not-payable-again.test.ts
 */
export function planAwarePayableStatus(orderStatus: string, planStatus: string | null): PayableStatus {
  const own = statusOf(orderStatus);
  if (own !== 'awaiting_payment') return own;
  switch (planStatus) {
    case 'paid':
      return 'settled';
    case 'rejected':
    case 'superseded':
      return 'closed';
    default:
      return own;
  }
}
