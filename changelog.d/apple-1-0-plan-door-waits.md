## 2026-11-24 · fix(iap): 1.0 sells what it carries; Event Pro and Ultra get their door, supplier plans wait for their version

These are pre-submit checks for 1.0 (build 9), measured on main 24 Nov (`build-sessions/APPLE-SUBMIT-2026-11-25.md`). Two things in the iPhone app did not match what the 1.0 submission carries.

- **Event Pro and Event Ultra had no door in the app.**
  - Event services (`studio/website-pro`) is the one place an event buys a plan. Its iPhone face was built 22 Nov (e02b733152), and Today drew its door where Apple sells. But the route stayed refused in the store shell (`IAP_OPENED_ROUTE`), so the door landed on /web-only.
  - Now the route opens where Apple sells (`iap`), and only there. With the switch off, nothing changes.
  - The page already strips every web peso (`withoutWebFigures`) and pays through Apple's sheet per item.
- **One plan per event in the app.**
  - Apple cannot charge "the difference", and `startAppStorePurchase` refuses a second plan for an event that holds one.
  - So on a plan, the app's Event services offers no pack. It never shows a "Next pack" whose Pay can only fail. The web's "Next pack" is unchanged.
- **Schedule › Release** is the Pro plan's (`eventProPlanActive`). In the app it now opens Event services with Event Pro picked (`?plan=pro`). Before, it opened `/apple-pro`, which sells Event Plus since 20 Nov, and Plus does not release.
- **The supplier plans wait for their app version.**
  - The "Supplier plans" subscriptions are not part of the 1.0 submission. Sources: pre-submit list 22 Nov; corpus `SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC_2026-11-22.md`, "ships with the next app version".
  - #8166 drew the Apple plan door at Shop ⚙ › Plan and billing wherever `iap` is true, and that includes build 9.
  - New token `SetnayanIAP/4` (`hasStoreSubscriptions`), and `getIapGate()` adds `iapSubscriptions`. The door reads the Apple plan only on `iapSubscriptions`, and the server refuses a plan purchase without it.
  - Build 9 still announces `/3`. The version that ships the plans bumps `apps/mobile/capacitor.config.ts` to `/4`.
- **Unchanged:** couple products, shop gifts (`/3`), App Store notifications, the iOS build, and the web.
- **Guards:**
  - New: `lib/iap/supplier-plans-wait-for-their-version.test.ts` and `lib/iap/event-pro-and-ultra-have-a-door-in-the-app.test.ts`.
  - A new render test in `studio/website-pro/the-app-offers-the-plans-pricing-offers.test.ts`.
  - Updated: `the-app-opens-what-apple-sells` (Event services moves from refused to opened), `the-app-shows-a-door-to-what-apple-sells` (`website-pro` is an app door key, sold inside Plus · Pro · Ultra), and `the-app-store-purchase-path`.
  - Six sabotages were each seen red, then restored.
- **Server actions:** no new export. No migration. No email.

SPEC IMPACT: None. It wires the approved, built Event services iPhone face to its door, and follows the written ruling that supplier plans ship with the next app version.
