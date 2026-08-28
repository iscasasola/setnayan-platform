/**
 * admin-payment-desk.ts — what the reconciliation card must be able to SAY
 * before an admin can honestly approve a payment.
 *
 * Owner, 2026-08-28, looking at a real pending payment: *"we should also know
 * what they ordered and what event and what they will get"* · *"This was
 * purchased via on boarding. used a discount. what they get. the amount that
 * should be sent."* And on the duplicate checkbox: *"the bank will not tell us
 * that it did. so i don't have any basis to know if it matched so i cannot
 * approve it."*
 *
 * This module is PURE composition over the authorities that already exist —
 * it invents no money rule of its own:
 *
 *   • the amount owed comes from `orderGrossOwed` with EXACTLY the arguments
 *     `isDecisivePaymentMatch` and approvePayment's shortfall guard pass
 *     (confirmed ?? requested, voucher netted, vendor keys VAT-inclusive, no
 *     vatRatePct — the guard passes none either). A card that quotes a figure
 *     different from the guard that refuses the approval is worse than no card.
 *   • the duplicate verdict comes from `classifyDuplicate`, the same rule
 *     `approvePaymentCore` consults — this file only re-shapes its answer for
 *     rendering, so the card and the refusal can never disagree about whether
 *     a collision exists.
 *   • whether there is a saving to mention comes from `hasSetupSaving`
 *     (lib/onboarding-discount.ts). The saving itself is DERIVED (regular −
 *     charged), never recomputed from today's discount dial: the stored
 *     `unit_price_php` is the bill, and the percentage is a dial the owner can
 *     move at any time — re-applying today's pct to yesterday's order would
 *     quote a figure the charge never was.
 *
 * Pure and I/O-free so the whole file is unit-testable; the page does the
 * reads and hands the rows in.
 */

import {
  ORDER_SHORTFALL_TOLERANCE_PHP,
  isVatInclusiveServiceKey,
  orderGrossOwed,
} from './orders';
import { hasSetupSaving } from './onboarding-discount';
import { classifyDuplicate, type PriorPayment } from './payment-reference-match';

/** One line of the bill as the card renders it. */
export type DeskBillLine = {
  serviceCode: string;
  /** Customer-facing words — catalog title, falling back to the code. */
  label: string;
  quantity: number;
  /** What this line actually billed (stored unit price × quantity). */
  chargedPhp: number;
  /**
   * What the line normally costs (retail × quantity) — null when we honestly
   * do not know (catalog unreadable, or a per-type price whose event type
   * could not be read). A null here suppresses the saving line rather than
   * inventing one.
   */
  regularPhp: number | null;
};

/**
 * The bill-line label, in the SAME shape the customer's own pay page renders
 * (lib/payable-by-reference.ts fetchRows): catalog title, raw code only as a
 * last resort, `× N` only when there is more than one.
 */
export function deskBillLineLabel(
  title: string | null | undefined,
  serviceCode: string,
  quantity: number,
): string {
  const base = (title ?? '').trim() || serviceCode;
  return quantity > 1 ? `${base} × ${quantity}` : base;
}

export type DeskMoneyVerdict = 'exact' | 'short' | 'over';

export type DeskMoneySummary = {
  /** Σ of what the lines display (regular where known, else charged). */
  displayTotalPhp: number;
  /** What the lines actually billed. */
  chargedTotalPhp: number;
  /** regular − charged, shown only when genuinely positive; else 0. */
  signupSavingPhp: number;
  /** Voucher discount, PHP. 0 when none. */
  voucherPhp: number;
  /**
   * True when the confirmed total already absorbed the voucher (the guard does
   * NOT net it again), so the card must annotate rather than subtract twice.
   */
  voucherInsideConfirmedTotal: boolean;
  /** THE figure — same computation as the shortfall guard. */
  owedPhp: number;
  transferredPhp: number;
  /** transferred − owed (signed). */
  deltaPhp: number;
  verdict: DeskMoneyVerdict;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Fold the bill lines + the order row + this transfer into the money block.
 *
 * 🔒 `owedPhp` is `orderGrossOwed` with the guard's own arguments — including
 * the implicit vatRatePct of 0 (approvePayment passes none) and the vendor-key
 * VAT-inclusive switch. Change the guard and this follows; change this and the
 * cross-check test against `isDecisivePaymentMatch` goes red.
 */
export function summarizeDeskMoney(args: {
  lines: readonly Pick<DeskBillLine, 'chargedPhp' | 'regularPhp'>[];
  requestedTotalPhp: number;
  confirmedTotalPhp: number | null;
  voucherDiscountCentavos: number | null;
  serviceKey: string | null;
  transferredPhp: number;
}): DeskMoneySummary {
  const voucherPhp =
    args.voucherDiscountCentavos != null && Number.isFinite(Number(args.voucherDiscountCentavos))
      ? round2(Math.max(0, Number(args.voucherDiscountCentavos)) / 100)
      : 0;

  const owedPhp = orderGrossOwed({
    requestedTotalPhp: Number(args.requestedTotalPhp),
    confirmedTotalPhp: args.confirmedTotalPhp != null ? Number(args.confirmedTotalPhp) : null,
    voucherDiscountPhp: voucherPhp,
    // Match the guard exactly (approvePayment passes no vatRatePct → 0).
    vatInclusive: isVatInclusiveServiceKey(args.serviceKey),
  });

  const chargedTotalPhp = round2(args.lines.reduce((acc, l) => acc + Number(l.chargedPhp), 0));
  const displayTotalPhp = round2(
    args.lines.reduce((acc, l) => acc + Number(l.regularPhp ?? l.chargedPhp), 0),
  );
  // Only claim a saving when there really is one — data drift where a stored
  // charge exceeds retail must suppress the line, never render a negative.
  const signupSavingPhp = hasSetupSaving(displayTotalPhp, chargedTotalPhp)
    ? round2(displayTotalPhp - chargedTotalPhp)
    : 0;

  const transferredPhp = Number(args.transferredPhp);
  const deltaPhp = round2(transferredPhp - owedPhp);
  // The guard tolerates centavo rounding (ORDER_SHORTFALL_TOLERANCE_PHP) when
  // deciding "fully covers" — the card's "exactly" must not be stricter than
  // the guard, or it says "short" about a transfer the guard happily promotes.
  const verdict: DeskMoneyVerdict =
    Math.abs(deltaPhp) <= ORDER_SHORTFALL_TOLERANCE_PHP ? 'exact' : deltaPhp < 0 ? 'short' : 'over';

  return {
    displayTotalPhp,
    chargedTotalPhp,
    signupSavingPhp,
    voucherPhp,
    voucherInsideConfirmedTotal: voucherPhp > 0 && args.confirmedTotalPhp != null,
    owedPhp,
    transferredPhp,
    deltaPhp,
    verdict,
  };
}

/**
 * Does this payment's reference collide with money already counted — and
 * where? Re-shaped from `classifyDuplicate` (the rule the approval guard
 * consults) so the card renders the acknowledgement checkbox ONLY when the
 * guard would actually warn, and names the order the guard would name.
 *
 *   • null           → no collision: the checkbox must not render at all.
 *   • 'same_order'   → the guard refuses regardless of any checkbox; the card
 *                      says so instead of offering a tick that cannot help.
 *   • 'other_order'  → the guard warns; the card shows the checkbox WITH the
 *                      other order named, so the tick is an informed one.
 */
export type DeskDuplicate =
  | { kind: 'same_order'; priorPaymentId: string }
  | { kind: 'other_order'; priorPaymentId: string; otherOrderId: string };

export function deskDuplicateVerdict(args: {
  referenceNumber: string | null | undefined;
  orderId: string;
  priors: readonly PriorPayment[];
}): DeskDuplicate | null {
  const v = classifyDuplicate({
    reference: args.referenceNumber,
    orderId: args.orderId,
    priors: args.priors,
  });
  if (v.kind === 'refuse') return { kind: 'same_order', priorPaymentId: v.priorPaymentId };
  if (v.kind === 'warn')
    return { kind: 'other_order', priorPaymentId: v.priorPaymentId, otherOrderId: v.otherOrderId };
  return null;
}
