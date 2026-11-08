/**
 * 💸 A REFUND A SUPPLIER GAVE A CLIENT — the one shape and the one set of words (Supplier Build 2 lane E).
 *
 * The record lives in `event_vendor_refunds` (migration 20271328327292) and is written only by
 * `vendor_record_client_refund` / `vendor_remove_client_refund` (the action `recordClientRefund`). NO MONEY MOVES: it
 * is a record, like a logged payment. Read in three places, each through its own RLS arm, each with this file:
 *   · the supplier's Payment page for that client (`clients/[eventId]/_pages/payment.tsx`) — Paid drops by it;
 *   · the supplier's Billing & receipts › Refunds (`lib/supplier-billing.server.ts`);
 *   · the couple's booked-supplier workspace › Payments (`dashboard/[eventId]/vendors/[vendorId]/workspace`).
 *
 * ⚖ WHY A SIBLING OF `event_vendor_payments` AND NOT A ROW IN IT: that table refuses an amount ≤ 0 and is summed as
 * money RECEIVED by many readers — a refund row there would be counted as a payment by every one of them. The
 * migration header has the measurement.
 *
 * Pure: no I/O. 🔒 lib/client-refunds.test.ts
 */

/** The columns every reader selects — one list. */
export const CLIENT_REFUND_SELECT =
  'refund_id, event_id, event_vendor_id, amount_php, refunded_on, reason, proof_r2_key, created_at';

export type ClientRefundDbRow = {
  refund_id: string;
  event_id: string | null;
  event_vendor_id: string;
  amount_php: number | string;
  refunded_on: string;
  reason: string;
  proof_r2_key: string | null;
  created_at: string;
};

export type ClientRefund = {
  refundId: string;
  eventId: string | null;
  eventVendorId: string;
  amountPhp: number;
  /** 'YYYY-MM-DD' — a Postgres DATE, read as that day (never shifted through UTC). */
  refundedOn: string;
  reason: string;
  proofRef: string | null;
};

/** One list as read: `measured: false` = the read was refused and `rows` means nothing. */
export type ClientRefundsRead = { measured: boolean; rows: ClientRefund[] };

export function clientRefundOf(r: ClientRefundDbRow): ClientRefund {
  return {
    refundId: r.refund_id,
    eventId: r.event_id,
    eventVendorId: r.event_vendor_id,
    // PostgREST hands NUMERIC back as a string.
    amountPhp: Number(r.amount_php),
    refundedOn: r.refunded_on,
    reason: r.reason,
    proofRef: r.proof_r2_key,
  };
}

/** The total given back, to the centavo. */
export function refundedTotalPhp(rows: readonly Pick<ClientRefund, 'amountPhp'>[]): number {
  return Math.round(rows.reduce((n, r) => n + (Number.isFinite(r.amountPhp) ? r.amountPhp : 0), 0) * 100) / 100;
}

/** "Nov 8" for a bare 'YYYY-MM-DD', as that Manila day. */
export function refundDayWords(iso: string): string {
  const d = new Date(`${iso}T00:00:00+08:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}

/** What `vendor_record_client_refund` answered, in words the sheet says. */
export type RefundAnswer = { ok: true } | { ok: false; message: string };

export const REFUND_REFUSAL_WORDS: Readonly<Record<string, string>> = {
  unauthenticated: 'Sign in again, then record it.',
  not_your_client: 'This client isn’t one of your bookings, so nothing was recorded.',
  amount: 'Enter how much you gave back.',
  reason: 'Say why you gave it back — they see this.',
  date: 'Pick the day you gave it back — today or earlier.',
  more_than_received: 'That is more than you confirmed receiving from them, less what you already gave back.',
  proof: 'That photo didn’t upload properly — add it again, or record without it.',
};

export function refundRefusalWords(status: string | null | undefined): string {
  return (status && REFUND_REFUSAL_WORDS[status]) || 'That did not go through. Nothing was recorded — please try again.';
}
