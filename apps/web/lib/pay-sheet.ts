/**
 * pay-sheet.ts — what the Booked body's Pay sheet is handed, and the one
 * sentence it words itself (owner 2026-10-07; Suppliers PR4 "Pay sheet").
 *
 * The data is the shipped payment card's own props (`DepositReservation`) plus
 * the supplier's payment plan; `loadPaySheet`
 * (`vendors/_actions/pay-sheet.ts`) fills it from the three readers the
 * supplier's workspace already uses. Pure — no I/O — so the sheet's words can
 * be executed by a test.
 *
 * ⚖ A PLAN IS WHEN MONEY IS DUE; A METHOD IS HOW IT MOVES. This module is about
 * the plan and the next step. The methods (`payMethods`) pass through untouched
 * to the card that draws them.
 */
import type { MoneyStep } from './accepted-quote-terms';
import type { PaymentHistory } from './payment-history';
import type { CoupleFacingMethod } from './vendor-payment-methods';
import type { CouplePayMethodsState } from './deposit-pay-step';
import type { PlanProgress } from './vendor-service-payment-schedules';

/** Everything the sheet draws — the payment card's own props, plus the plan. */
export type PaySheetData = {
  /** The couple added this supplier themselves (no shop on Setnayan). */
  own: boolean;
  /**
   * The supplier's payment plan with the couple's payments folded in.
   * `'unreadable'` = the read failed — NOT "no plan".
   */
  plan: PlanProgress | 'unreadable';
  /** Which schedule is the real one: the plan, the accepted quote, or neither. */
  scheduleSource: 'plan' | 'quote' | 'none';
  /** The accepted quote's own schedule — drawn only when it is the real one. */
  quoteSchedule: { label: string; dueText: string; amountCentavos: number }[] | null;
  depositRecordedAt: string | null;
  depositAcknowledgedAt: string | null;
  depositProofUrl: string | null;
  depositDeclinedAt: string | null;
  depositDeclineReason: string | null;
  payMethods: CoupleFacingMethod[];
  payMethodsState: CouplePayMethodsState;
  requestedFirstPaymentCentavos: number | null;
  requestedFirstPaymentSentence: string | null;
  requestedTermsUnreadable: boolean;
  step: MoneyStep;
  history: PaymentHistory | null;
};

export type LoadPaySheetResult =
  | { status: 'ok'; data: PaySheetData }
  | { status: 'not_signed_in' }
  /** The booking is not booked (asked, withdrawn, removed) — nothing to pay yet. */
  | { status: 'not_booked' }
  | { status: 'error' };


/** The one line under "Payment plan" — whose plan this is, or why there is none. */
export function planNote(data: Pick<PaySheetData, 'own' | 'plan' | 'scheduleSource'>, vendorName: string): string {
  // A refused plan read with no quote to fall back on is NOT "no plan".
  if (data.plan === 'unreadable' && data.scheduleSource === 'none') return 'We couldn’t load the payment plan.';
  if (data.scheduleSource === 'quote') {
    return `From the quote you accepted. Pay ${vendorName} directly; they confirm each payment as received.`;
  }
  if (data.scheduleSource === 'none') return 'No plan yet.';
  const estimated = data.plan !== 'unreadable' && data.plan.isDefaultSeeded === true;
  if (data.own) {
    return estimated
      ? 'No plan yet — Setnayan pencils in a 50/50 split at booking; edit it in your record.'
      : 'Your record of what you agreed.';
  }
  return estimated
    ? `${vendorName} hasn’t set payment terms yet, so this is a typical 50/50 estimate. Confirm the amounts and dates with ${vendorName} before paying.`
    : `${vendorName} set up this plan; they confirm each payment as received.`;
}
