/**
 * "APPROVE ALL N GREEN" — the pure half (admin slice 4, 2026-11-13).
 *
 * Owner-approved drawing: Setnayan-specs prototypes/admin_pub/work.html, and the
 * solo-operator audit's Top-10 #4: *"Payments: 'Approve all N green' on the Work
 * row, with the receipt-read verdict shown in the row … Add a one-line 'why
 * held' for amber rows. No new AI."*
 *
 * 🔑 GREEN IS NOT A NEW RULE. A pending payment is green exactly when the
 * payments desk already marks it a clean match: `isDecisivePaymentMatch` (the
 * predicate the desk's batch bar and `batchApprovePayments` both use) AND no
 * reference collision with money already counted (the desk's `dup === null`).
 * Everything else is amber and opens one by one.
 *
 * ⛔ THE RECEIPT READ NEVER DECIDES. It is shown as a line on each row and is
 * not an input to `paymentLight` — `an-ai-may-not-approve-money.test.ts` holds
 * that this module does not import the reader, and the shape of `paymentLight`
 * (no receipt argument) holds it here.
 *
 * Pure and dependency-light so the rules below are executed by
 * `green-payments.test.ts`, not grepped.
 */
import { isDecisivePaymentMatch, referenceContainsCode } from '@/lib/orders';

export type PaymentLightInput = {
  referenceNumber: string | null | undefined;
  referenceCode: string | null | undefined;
  amountPhp: number;
  requestedTotalPhp: number | null | undefined;
  confirmedTotalPhp: number | null | undefined;
  voucherDiscountPhp?: number;
  serviceKey: string | null | undefined;
  /** The reference collides with a payment already counted as money. */
  duplicate: boolean;
  /** There is a screenshot to look at (a reference alone is not a picture). */
  hasScreenshot: boolean;
};

export type PaymentLight =
  | { light: 'green' }
  /** `why` is the one line an amber row shows — a fact, never an accusation. */
  | { light: 'amber'; why: string };

/**
 * Green, or amber with the first reason it was held.
 *
 * 🔑 CONSISTENT WITH THE DESK BY CONSTRUCTION: green ⇔ the decisive-match
 * predicate passes AND there is no duplicate — the reasons below are only
 * consulted once that has already failed, so a reason can never turn a desk
 * clean match amber, or an amber row green.
 */
export function paymentLight(p: PaymentLightInput): PaymentLight {
  if (p.duplicate) {
    return { light: 'amber', why: 'Same reference as a payment already counted — check it in your bank app.' };
  }
  const decisive = isDecisivePaymentMatch({
    referenceNumber: p.referenceNumber,
    referenceCode: p.referenceCode,
    amountPhp: p.amountPhp,
    requestedTotalPhp: p.requestedTotalPhp,
    confirmedTotalPhp: p.confirmedTotalPhp,
    voucherDiscountPhp: p.voucherDiscountPhp,
    serviceKey: p.serviceKey,
  });
  if (decisive) return { light: 'green' };

  const typed = (p.referenceNumber ?? '').trim() !== '';
  if (!typed && !p.hasScreenshot) {
    return { light: 'amber', why: 'No reference or screenshot yet — nothing to check the money against.' };
  }
  if (!referenceContainsCode(p.referenceNumber, p.referenceCode)) {
    // Not a red flag on its own: a scanned-QR payment cannot carry our code
    // (see the payments desk's note on the per-order QR). It just means a person
    // matches it against the bank app.
    return {
      light: 'amber',
      why: typed
        ? 'The order code is not in the reference — match it in your bank app.'
        : 'No reference typed — match the screenshot in your bank app.',
    };
  }
  if (p.requestedTotalPhp == null) {
    return { light: 'amber', why: 'The order has no total to check the amount against yet.' };
  }
  return { light: 'amber', why: 'This transfer alone does not cover what is owed.' };
}

/** The newest advisory receipt read for a payment, as the row needs it. */
export type ReceiptReadLine = {
  status: 'ok' | 'unreadable' | 'failed';
  summary: string | null;
};

/**
 * The receipt-read verdict line a Work row shows — the reader's OWN sentence
 * (`summariseReceiptRead`, which always ends "Still check your bank app"), or
 * plain words for its absence. `readFailed` = we could not load the reads at
 * all, which is never the same as "not read yet".
 */
export function receiptVerdictLine(read: ReceiptReadLine | null | undefined, readFailed: boolean): string {
  if (readFailed) return 'Couldn’t load the receipt read — open the payment to see the picture.';
  if (!read) return 'Receipt not read yet — open it to look at the picture.';
  if (read.status === 'failed') return 'The receipt reader could not run on this one — open the picture.';
  const s = (read.summary ?? '').trim();
  return s !== '' ? `Receipt read: ${s}` : 'The receipt was read but left no sentence — open the picture.';
}

/** One row of the Work › Payments drawer, and one line of the batch confirm. */
export type PaymentLightRow = {
  paymentId: string;
  amountPhp: number;
  channel: string | null;
  referenceNumber: string | null;
  /** Whose order — an email or the order's public id, for the confirm list. */
  who: string;
  createdAt: string;
  /** A reference was typed or a screenshot sent — there is something to check the money against. */
  hasProof: boolean;
  light: PaymentLight;
  /** The receipt read's line — DISPLAY only, added after sorting (payment-verdicts.server.ts). */
  verdict?: string;
  /** DISPLAY only (admin request cards, walk RW-301): the order's public id (its record), the order's own status (an
   *  order already `paid` is said, not offered again), the payer's name, and whether a picture was sent. None of these
   *  feeds `paymentLight` — the green rule above reads only what it always read. */
  orderPublicId?: string | null;
  orderStatus?: string | null;
  payerName?: string | null;
  hasScreenshot?: boolean;
};

/** The ids a green batch may submit — re-checked on the server, never trusted. */
export function greenIds(rows: readonly PaymentLightRow[]): string[] {
  return rows.filter((r) => r.light.light === 'green').map((r) => r.paymentId);
}
