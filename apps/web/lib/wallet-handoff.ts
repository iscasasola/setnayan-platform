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
 * 🛑 ANDROID: MEASURED 2026-09-23, `gcash://` DOES NOT OPEN THE APP. Same
 * phone, same page, same tap — Android Chrome refuses a bare custom scheme
 * from a web page; it wants an `intent://` URL naming the package. So the
 * handoff is gated to iOS by `walletHandoffIsMeasured` below, because a
 * button that renders and does nothing is worse than no button, and the
 * "it may not be installed" fallback would be a LIE on a phone that has it.
 *
 * ⚠ To turn Android on, MEASURE the intent URL first — its package name
 * (`com.globe.gcash.android`) is an unverified guess and always was. Do not
 * infer it from the iOS result.
 *
 * ⚠ ONE PHONE · ONE APP VERSION · ONE OS, even on iOS. `gcash://` is not a
 * contract GCash publishes, so they can drop it in any release without
 * telling anyone. The handoff is therefore never the only way through: every
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

/**
 * Which phone is this, for handoff purposes only.
 *
 * Yes, this reads the user agent — deliberately, and only here. The thing
 * being decided IS the operating system's app-launch behaviour, which was
 * measured per-OS and differs per-OS; no capability query reports it. A
 * coarse pointer tells you there is a touchscreen, not whether Chrome will
 * honour a custom scheme.
 *
 * iPadOS reports itself as a Mac, so the touch-point check catches it.
 */
export type WalletPlatform = 'ios' | 'android' | 'other';

export function detectWalletPlatform(
  userAgent: string | null | undefined,
  maxTouchPoints: number = 0,
): WalletPlatform {
  const ua = typeof userAgent === 'string' ? userAgent : '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPod|iPad/i.test(ua)) return 'ios';
  // iPadOS 13+ in its default "desktop" mode claims to be a Macintosh.
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios';
  return 'other';
}

/**
 * Has the handoff been MEASURED to work on this platform?
 *
 * Only iOS, as of 2026-09-23. Android was measured and FAILED; everything
 * else was never tried. A platform is added here by taking a phone, tapping
 * the link and watching — never by reasoning from another platform's result.
 */
export function walletHandoffIsMeasured(platform: WalletPlatform): boolean {
  return platform === 'ios';
}
