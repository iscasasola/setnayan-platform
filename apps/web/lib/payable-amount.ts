import { computeVatFromBase } from './receipts';

/**
 * lib/payable-amount.ts — what the buyer actually owes.
 *
 * # Why this is its own module
 *
 * 🚨 `orders.requested_total_php` IS NOT THE AMOUNT TO PAY. On couple checkout
 * it is the PRE-VAT, PRE-VOUCHER base: the original price is stored there and
 * the discount goes in `voucher_discount_centavos`, while the figure the couple
 * is actually charged is the voucher-adjusted base grossed by VAT. Reading the
 * raw column onto a payment page would put the UNDISCOUNTED price inside the
 * QR — charging a couple who used a code the full amount, automatically.
 *
 * It lives here, pure, because `payable-by-reference.ts` imports `server-only`
 * and therefore cannot be unit tested — and this is a rule about money. The
 * first cut had it inline, and a sabotage that deleted the voucher subtraction
 * left every test green.
 *
 * # The two conventions, which are the product's, not this file's
 *
 * Vendor-billing SKUs are quoted ALL-IN (owner-locked 2026-07-05) — the ₱999 a
 * shop sees is the ₱999 it pays — so nothing is added. Customer SKUs store a
 * pre-VAT base and gross at pay time. `isVatInclusiveServiceKey` is the one
 * place that distinction is decided; the caller passes its answer in.
 */
export function payableAmountPhp(args: {
  /** `confirmed_total_php ?? requested_total_php`. */
  storedTotalPhp: number;
  /** `orders.voucher_discount_centavos` — centavos, not pesos. */
  voucherDiscountCentavos: number;
  /** From `getEffectiveVatRatePct`. 0.00 in production today. */
  vatRatePct: number;
  /** `isVatInclusiveServiceKey(order.service_key)`. */
  vatInclusive: boolean;
}): number {
  const stored = Number.isFinite(args.storedTotalPhp) ? args.storedTotalPhp : 0;
  const discount = Number.isFinite(args.voucherDiscountCentavos)
    ? args.voucherDiscountCentavos / 100
    : 0;
  // A discount can never make a bill negative, and a discount LARGER than the
  // bill is a data fault, not a refund we owe.
  const base = Math.max(0, stored - discount);
  if (args.vatInclusive) return base;
  return computeVatFromBase(base, args.vatRatePct).gross;
}
