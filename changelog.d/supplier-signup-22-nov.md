## 2026-11-22 · feat(onboarding): suppliers can sign up inside the iPhone app · the coordinator door pre-picks a coordinator

**The app's supplier door** (controller 22 Nov, drawing `prototypes/app_supplier_door_2026-11-22`). The iPhone app hides
"For suppliers" and "For coordinators" because both show plan prices, so a supplier in the app had no way in.

- **Rail, signed out:** an "Open your shop" row (Store icon) to `/open-shop`, between Discover and Features.
  It is `data-app-only`, so the web menu does not change.
- **Rail, signed in with no shop:** the same row under the divider, above Features, only while `roles.canOpenShop`
  (a failed read keeps it closed). The switcher's "Create your shop" is unchanged.
- **`/open-shop` asked for by the store shell** (`isStoreShellRequest`) works like this:
  - It drops `?plan=` and does not read the plan ladder.
  - Step 1 says only "Add more later." (no ⓘ, no plan names).
  - The picks are held to what Free allows. The main service only: no "Also do …", no "Another category", no plan meter.
  - The plan sheet never opens.
  - Step 5 keeps "Free to open, free to run…" with no ⓘ and no number or rate.
  - The web is unchanged.
- **New guard** `the-app-supplier-door-names-no-price.test.ts` (sabotaged once each way: a paid href, and the
  `overFree` gate removed). `the-app-footer-names-no-paid-door` stays green.

**Coordinator door:** `/open-shop?as=coordinator` pre-picked "Despedida" (the first leaf of the coordination list).
It now pre-picks the first service of `COORDINATOR_TRADE_SERVICES`, via `firstCoordinationPick` in `lib/coordinator-trade.ts`.

SPEC IMPACT: None. The rulings are the controller's 22 Nov calls on the specs drawing `app_supplier_door_2026-11-22`
(specs `e73ba0f621`).

**Ship controller (22 Nov):** the lab passes the LogIn icon as an element (server-file guard); and `becomeVendor` ignores `plan=` when the request comes from the app (`isStoreShellRequest`), so a hand-made request cannot carry a plan offer either. Guarded in `the-app-supplier-door-names-no-price.test.ts` (sabotage-checked).
