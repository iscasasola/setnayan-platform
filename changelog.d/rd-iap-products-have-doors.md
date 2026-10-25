## 2026-10-25 · fix(iap): every product Apple sells in the app has a door there; the sheet never shows a price in the wrong money

- **Doors (App Review must locate every In-App Purchase product).** With Apple IAP on (`getIapGate().iap`), Setnayan AI,
  Music Maker, Patiktok and the Thank-You Video opened in the app (`IAP_OPENED_ROUTE`) but nothing linked to them. One rule
  now decides it: `isStoreShellHiddenAddon(key, iap)` in `lib/store-shell.ts`, derived from `IAP_OPENED_ROUTE`. Home's
  paid rows (`offered` + `refusesPath(p, iap)`) and `ServiceParts` ask it; the app Home lists Setnayan AI · Music Maker ·
  Patiktok (owned → "On", not owned → the row that opens the page with Apple's sheet; no web price is read for the app)
  and a Thank-You Video row beside Papic. With `iap` false nothing changes (3.1.1).
- **Price (build 6, Philippine account: our sheet "$1.99", Apple charged "₱ 95.00").** The plugin now also returns the
  price's `currencyCode` and StoreKit's `storefront`; `loadAppStoreProducts` withholds a price not in its storefront's
  money (`lib/iap/storefront-price.ts`). Needs a new iOS build to take effect; older builds are trusted as before.
- Guards: `lib/the-app-shows-a-door-to-what-apple-sells.test.ts`, `lib/iap/the-sheet-price-is-storekits.test.ts`.

SPEC IMPACT: None
