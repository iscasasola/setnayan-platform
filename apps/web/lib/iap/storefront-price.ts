/**
 * lib/iap/storefront-price.ts — 💱 IS STOREKIT'S PRICE IN ITS OWN STOREFRONT'S MONEY? (pure, no I/O — read by
 * `loadAppStoreProducts` in ./native-store.ts, the one place the app learns a price).
 *
 * Held by `lib/iap/the-sheet-price-is-storekits.test.ts`.
 */

/**
 * 💱 The currency each App Store storefront we sell in charges. Not a price — only which money a price for that
 * storefront must be in. A storefront not listed is trusted as StoreKit answers.
 */
const STOREFRONT_CURRENCY: Readonly<Record<string, string>> = { PHL: 'PHP' };

/**
 * Is StoreKit's price in the money its own storefront charges? Measured on 1.0 (build 6), 2026-10-25, a Philippine
 * account: our sheet showed "$1.99 · adds 100 credits" while Apple's own purchase sheet charged "₱ 95.00". A price in
 * another currency is a number Apple will not charge — the app withholds it (no figure; never one of ours instead).
 * An older build sends neither field and is trusted exactly as before.
 */
export function priceMatchesStorefront(p: { currencyCode?: string; storefront?: string }): boolean {
  const want = p.storefront ? STOREFRONT_CURRENCY[p.storefront.toUpperCase()] : undefined;
  if (!want || !p.currencyCode) return true;
  return p.currencyCode.toUpperCase() === want;
}
