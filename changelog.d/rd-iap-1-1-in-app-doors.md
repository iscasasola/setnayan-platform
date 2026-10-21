## 2026-10-21 · feat(iap): version 1.1 — the Papic page and the Live Watch controller open in the app where Apple sells (flag-dark)

This builds the "Not built here" list of #6637, for iPhone 1.1. All of it sits behind the existing three-part gate (`iapAvailable`: the store shell + a 1.1+ build announcing `SetnayanIAP/2` + `NEXT_PUBLIC_APPLE_IAP_ENABLED`). With the switch off, the app and the web are unchanged.

- **The gate opens two control pages.** `IAP_OPENED_ROUTE` (`lib/store-shell.ts`) covers `/dashboard/<id>/studio/papic/**`, `/panood/control/<id>` and `/dashboard/<id>/studio/panood/cameras[/print]`. Middleware and `StoreShellLinkGuard` both use `iapAvailable` to decide this. The following pages still land on /web-only:
  - the Live Watch buy page
  - legacy setup and broadcast
  - the program output
  - `/studio/about/*`
  - every purchase route
  - every other paid extra
- **Papic page, in the app.**
  - **Buy more** opens Apple's sheet (`IapPapicSheet`).
  - **Not drawn:** the guest-camera tier picker, extra crew cameras, Unlock all, Keep Full-Res, DSLR pairing, the keep-at-full-size ₱ line, the Live Photo Wall, and the "prices reflect it" / "free with Unlock all" lines.
  - **Back** goes to Home.
- **Live Watch controller, in the app.**
  - It opens only for an event that owns Live Watch. Any other event is sent to Home, where Activate opens Apple's sheet.
  - It never reads the web price, and **Exit** goes to Home.
  - The pool-only notice drops its "Add the hosted channel option" sentence (`POOL_ONLY_APP_NOTICE`).
- **Home › Your services, in the app.**
  - The Papic row opens the Papic page.
  - An owned Live Watch carries **Go live**, which opens the controller.
  - Its status line reads "On · bought on the web" or "On · bought in the app". This comes from the event's orders (`payment_method_key = 'app_store'`) via `lib/iap/where-bought.ts`. When there is no single answer, the line says "On".
  - `APP_STORE_CHANNEL_KEY` is now the one spelling of the App Store channel, and the fulfilment writes it.
- **Pro is tried, not hidden, in Hero / Reveal / Logo and on the Our Story page.** These follow the Maker editor's own Pro rows: the `proShell` rule from #6637. Each made-once panel takes `proShell`, which defaults to `storeShell`. Our Story tries more stories and photos and shows the ◆ mark; prices, links and tours still follow `storeShell`. Pro is applied only through the Apple Pro page at Apply. Every Maker change is server-side, so the first load is unchanged.
- **Build 5 never sells (owner 2026-10-21).** The one gate (`hasNativeStore`, `lib/iap/iap-gate.ts`) now requires `SetnayanIAP/2` or higher, and the iOS shell for 1.1 announces `/2` (`apps/mobile/capacitor.config.ts`). 1.0 (build 5) announces `/1`, so the switch can never light it up.
- **Guard:** `lib/the-app-opens-what-apple-sells.test.ts`. It checks both directions: gate off, every door is absent and every route refused; gate on, the doors open and the web offers stay off.

SPEC IMPACT: None in the corpus. These are owner-approved 2026-10-18 rulings (the five IAP decisions and prototype frame 11), built here. The App Store Connect checklist for 1.1 is in `shots-2026-10-21/iap-1-1/OWNER-STEPS-1.1.md`, outside the repo.
