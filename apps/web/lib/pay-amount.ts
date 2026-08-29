/**
 * THE ONE FIGURE ON THE PAYMENT PAGE — printed the same way everywhere it
 * appears, and the same way the QR code carries it.
 *
 * 🔑 WHY THIS IS A MODULE AND NOT A LOCAL HELPER. `/pay/[reference]` shows the
 * amount in FOUR places across TWO files: the headline under "You're paying
 * for", the caption above the QR, the "type this yourself" line for the bank
 * rail, and the sticky bar. Those two files each carried their own private
 * `peso()`, so the same screen formatted the same number twice from two
 * independent copies of one rule.
 *
 * That is not theoretical. On 2026-08-28 one of the two files was re-saved in
 * the wrong encoding and its peso sign was destroyed; the other was untouched.
 * The page printed junk at the top and a correct `₱` beside the QR — the same
 * amount, on the same screen, disagreeing with itself. One copy is what makes
 * that impossible rather than merely unlikely.
 *
 * ⚖ THE FORMAT IS NOT A TASTE DECISION — IT IS PINNED TO THE QR.
 * `mintOrderQr` writes the amount into EMV tag 54 as `amountPhp.toFixed(2)`:
 * always exactly two decimals. The page's promise, in its own words, is that
 * "the amount is already in it", so what a person READS must be the digits the
 * wallet is about to FILL IN. Hence exactly two decimals here too — never the
 * rounded-to-the-peso style other screens use, because on this one screen a
 * missing centavo is a payment that will not reconcile.
 *
 * ⚠ THE MAXIMUM IS NOT REDUNDANT, AND IT IS BELT-AND-BRACES RATHER THAN A BUG
 * FIX. `Intl` defaults `maximumFractionDigits` to `max(minimum, 3)`, so the old
 * helpers would have printed three decimals for a figure carrying them, against
 * a QR carrying two. Measured before writing this: it is NOT reachable today —
 * `orders.amount_php` is `NUMERIC(12,2)`, and both branches of `orderGrossOwed`
 * round to 2dp. Naming the maximum costs nothing and removes the whole question.
 *
 * ⛔ THIS IS NOT A GENERAL MONEY FORMATTER AND MUST NOT BECOME ONE. Eleven
 * `peso()` helpers exist across the app, in six distinct implementations, and
 * measured on 2026-08-29 they render ₱49.50 three different ways: ₱50 · ₱49.50 ·
 * ₱49.5. They differ deliberately — a price band rounds to the peso, a payment
 * ask shows "—" for an absent figure — so pointing them all here would silently
 * change what those screens display. This one is scoped to the payment page,
 * where the QR decides the format.
 */

/** `49` → `"₱49.00"`. The QR's own digits, grouped for reading. */
export function payAmount(php: number): string {
  // 🔑 THE DIGITS ARE THE QR'S, NOT OURS. `mintOrderQr` writes tag 54 as
  // `amountPhp.toFixed(2)`, so this starts from that exact expression and only
  // adds thousands separators. Agreement is then STRUCTURAL rather than two
  // formatters that happen to concur.
  //
  // ⚠ AND THEY DO NOT ALWAYS CONCUR. `Intl.NumberFormat` rounds the decimal
  // value while `toFixed` rounds the binary double, so they part company on a
  // half-centavo: 2.675 is "2.68" to Intl and "2.67" to toFixed; 1.005 is
  // "1.01" and "1.00". Formatting the screen with Intl would have put the page
  // one centavo away from the code beside it — on a screen headed "pay this
  // exact amount". Measured, not assumed. Unreachable today (`amount_php` is
  // NUMERIC(12,2) and both branches of `orderGrossOwed` round to 2dp), so this
  // closes the question rather than fixing a live defect.
  const exact = php.toFixed(2);
  const dot = exact.lastIndexOf('.');
  const whole = exact.slice(0, dot);
  const centavos = exact.slice(dot + 1);
  const grouped = Number(whole).toLocaleString('en-PH', {
    maximumFractionDigits: 0,
  });
  return `₱${grouped}.${centavos}`;
}
