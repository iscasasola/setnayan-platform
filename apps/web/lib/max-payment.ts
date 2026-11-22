/**
 * 💳 THE MOST IN ONE PAYMENT — PURE (no I/O), so the store, the buy action and the tests share one rule.
 *
 * ⚖ OWNER 2026-11-17, verbatim: *"We do not allow transactions above 100,000."* The number is an ADMIN SETTING —
 * `platform_settings.max_payment_php` (migration `gift_cart_orders_and_the_payment_max`, seeded 100000), edited in
 * Admin › Settings › Payment methods and read by `getMaxPaymentPhp` (lib/max-payment.server.ts). It is never typed in
 * UI code: every screen is handed the read value.
 *
 * `MAX_PAYMENT_PHP_DEFAULT` is the owner's ruled value, used ONLY when the setting cannot be read — the same shape as
 * `GIFT_LIMIT_PCT_DEFAULT`. It never fails toward a HIGHER ceiling.
 */

/** The ruled ceiling (owner 2026-11-17: "We do not allow transactions above 100,000."). Fallback only. */
export const MAX_PAYMENT_PHP_DEFAULT = 100_000;

/** A read value made safe: a positive finite number, else the ruled default. */
export function maxPaymentPhpOrDefault(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  return Number.isFinite(n) && n > 0 ? n : MAX_PAYMENT_PHP_DEFAULT;
}

/** The ceiling in whole centavos (what the cart math compares in). */
export function maxPaymentCentavos(maxPhp: number): number {
  return Math.round(maxPaymentPhpOrDefault(maxPhp) * 100);
}

/** Does one payment of `totalCentavos` stay within the ceiling? Equal is allowed ("above 100,000" is refused). */
export function withinMaxPayment(totalCentavos: number, maxPhp: number): boolean {
  return Number.isFinite(totalCentavos) && totalCentavos <= maxPaymentCentavos(maxPhp);
}
