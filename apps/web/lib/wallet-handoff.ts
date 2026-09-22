/**
 * Tap-to-open handoff into a payment wallet app.
 *
 * MEASURED on the owner's iPhone with GCash installed, 2026-09-22, from a
 * plain local HTML page opened in Safari — NOT inside an iframe, so nothing
 * could swallow the handoff and turn a real result into a false negative.
 * A `tel:` control was tapped FIRST and opened the dialer, which is what makes
 * a "nothing happened" below mean something rather than mean the harness:
 *
 *   gcash://                 → OPENS the app
 *   gcash://home             → OPENS the app
 *   https://www.gcash.com/   → does NOT open the app (no Universal Link)
 *   https://m.gcash.com/     → does NOT open the app
 *
 * ⚠ ONE PHONE · ONE APP VERSION · ONE OS. `gcash://` is not a contract GCash
 * publishes, so they can drop it in any release without telling anyone, and
 * ANDROID IS UNVERIFIED (the `intent://` probe is invisible on iOS and was
 * never tapped). The handoff is therefore never the only way through: every
 * surface that renders it must ALSO render the number itself with a copy
 * control, and the button reveals a fallback link when the app does not take
 * over. Losing the scheme must cost a tap, never a payment.
 *
 * ⚠ THIS IS NOT AN AMOUNT RAIL. No scheme here carries a payee or a figure —
 * GCash publishes no such link format, so no probe could have found one. The
 * amount-baked QR in `app/pay/[reference]/_components/pay-panel.tsx` stays the
 * only path that hands the wallet a number to charge.
 *
 * Maya is deliberately ABSENT even though it sits beside GCash in
 * PAYMENT_PROVIDERS: `maya://` was never probed. Re-run the probe on a real
 * phone before adding it — do not infer it from this one.
 *
 * Re-measure with: a plain `<a href="gcash://">` on a local page, on a phone
 * with the app installed, after a `tel:` control fires.
 */

/**
 * Providers whose app we can hand off to, mapped to the scheme MEASURED to
 * work. Keyed by the exact `provider` strings in PAYMENT_PROVIDERS
 * (`lib/vendor-payment-methods.ts`) so a rename there surfaces here.
 */
export const WALLET_SCHEMES: Readonly<Record<string, string>> = {
  GCash: 'gcash://',
};

/**
 * Where to send someone whose phone did not take the scheme. Measured above to
 * load as an ordinary web page, which is exactly what we want — it carries the
 * store links for both platforms, so we never hard-code a store ID we have not
 * verified.
 */
export const WALLET_FALLBACK_URL: Readonly<Record<string, string>> = {
  GCash: 'https://www.gcash.com/',
};

/**
 * The scheme for a payment method's provider, or null when we have not
 * measured one. Null is the safe answer: the caller renders no button and the
 * number + copy control carry the payment on their own.
 *
 * Deliberately EXACT-MATCH, not fuzzy: a bank row whose provider is "BDO" must
 * never open GCash, because a handoff to the wrong app sends money to the
 * wrong rail. Matching loosely (contains / lowercase / startsWith) is how
 * "GCash" would one day catch a provider named "Not GCash".
 */
export function walletSchemeFor(provider: string | null | undefined): string | null {
  if (typeof provider !== 'string') return null;
  return WALLET_SCHEMES[provider] ?? null;
}

/** The fallback page for a provider, or null when there is no handoff at all. */
export function walletFallbackFor(provider: string | null | undefined): string | null {
  if (typeof provider !== 'string') return null;
  if (!WALLET_SCHEMES[provider]) return null;
  return WALLET_FALLBACK_URL[provider] ?? null;
}

/** Does this provider have a measured handoff? */
export function hasWalletHandoff(provider: string | null | undefined): boolean {
  return walletSchemeFor(provider) !== null;
}
