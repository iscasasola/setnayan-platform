## 2026-11-27 · fix(iap): settle a retired product's old App Store transaction; offer Papic in the app to the couple only

Live fault. Prod logged "App Store purchase — no intent for this token … papic_credits_100, Sandbox" on every Home open. It was a test purchase from before November. Its product was retired on 3 Nov, and the 16 Nov migration cleared its intent. The server refused it, so the phone never finished it and replayed it on every Home open and Restore.

- **Retired product, no intent:** `fulfilAppleTransaction` now answers `retired`. Nothing is granted, and it writes one info line, not a fault. The phone's `settled()` (now in `lib/iap/iap-outcome.ts`) finishes it. `isRetiredIapProduct` lives in `lib/iap/products-delivery.ts`.
- **Current product, no intent:** still a loud fault. The fault now also names the intent key (`intentKey`), the environment and the route (`confirm` · `notification` · `replay` · `restore`). `not_yours`, `product_mismatch` and `token_reused` are unchanged. The purchase path for the products on sale is unchanged.
- **Event services in the app:** only the couple is offered Papic. Every other member sees the server's own line ("Only the couple can add credits."), and Papic is left out of the StoreKit ids. If the role read fails, the row says it couldn't be read. On the web, nothing changes. The server rule in `startAppStorePurchase` is unchanged.
- **Tests:** `lib/iap/a-retired-replay-is-settled.test.ts` (seen red with the fix removed) and `studio/website-pro/only-the-couple-is-offered-papic-in-the-app.test.ts`.
- **Server actions:** no new export. `confirmAppStorePurchase` takes an optional `via`. No migration. No email.

SPEC IMPACT: None.
