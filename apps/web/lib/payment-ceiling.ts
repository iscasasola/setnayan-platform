/**
 * lib/payment-ceiling.ts — "no single payment made TO SETNAYAN may exceed the
 * ceiling", asked one way by every surface that takes money for Setnayan.
 *
 * ⚖ OWNER 2026-11-17 (DECISION_LOG): the booking fee can never exceed ₱100,000,
 * and no single payment made TO SETNAYAN — booking fees, gifts, plans — may
 * exceed ₱100,000. EXACTLY ₱100,000 IS ALLOWED. It does NOT apply to couples
 * paying suppliers (those never pass through here).
 *
 * 🔑 THE NUMBER IS THE ADMIN SETTING `platform_settings.max_payment_php`, read by
 * `getMaxPaymentPhp` (lib/max-payment.server.ts) and handed in. Nothing here
 * types 100000; the comparison is `withinMaxPayment` (lib/max-payment.ts), the
 * same rule the gift store uses, so the two cannot disagree about the edge.
 *
 * Pure — the /pay page, its action and the couple checkout share it, and the
 * tests run it without a database.
 */
import { withinMaxPayment } from '@/lib/max-payment';
import { payAmount } from '@/lib/pay-amount';

/** Does one payment of `amountPhp` stay within the ceiling? Equal is allowed. */
export function paymentWithinCeiling(amountPhp: number, maxPaymentPhp: number): boolean {
  if (!Number.isFinite(amountPhp)) return false;
  return withinMaxPayment(Math.round(amountPhp * 100), maxPaymentPhp);
}

/**
 * The one sentence a payer reads when a bill is over the ceiling — on the page
 * (where no code is shown) and in the action's refusal, so both say the same.
 */
export function paymentOverCeilingMessage(maxPaymentPhp: number): string {
  return `We can’t take a single payment above ${payAmount(maxPaymentPhp)}. Nothing has been charged — please message us and we’ll split this bill for you.`;
}

