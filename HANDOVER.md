# HANDOVER — rd/in-app-purchase · started 2026-10-18 ~14:20 PHT by the controller

Owner 2026-10-18: "Yes — use all five in-app purchase recommendations and start the in-app purchase build." The five are
recorded in corpus DECISION_LOG 2026-10-18 "IN-APP PURCHASE — THE FIVE DECISIONS" (read it + DL 2026-10-08 "PAID APPS
AGREEMENT ACTIVE … IAP before Apple check" + prototype prototypes/in_app_purchase_screens_2026-10-17_fable.html, all via
`git -C ~/Documents/Claude/Projects/Setnayan show origin/main:<path>`). Ship-on-green authorised through 19 Oct.
EXISTS: apps/mobile = Capacitor 8.4 shell (+ SetnayanAuthPlugin); orders.platform already allows 'ios'; activation path
approvePaymentCore / activateOrderSku / deactivateOrderSku (lib/sku-activation.ts); lib/store-shell.ts allow-list (~30
readers); draft PR #6420 "store-shell: More lists only owned services" (read it; fold in only if it's needed and safe).
NOTHING exists for StoreKit / App Store Server.
BUILD (money: honest failures, no guessed numbers — every price from platform_retail_catalog_v2 via the ÷0.85 rule; App
Store product ids listed in ONE config file):
1. StoreKit 2 bridge in apps/mobile (Capacitor plugin, Swift) — products load, purchase, Restore purchases, transaction
   updates; consumables per ruling 3 (Pro / Live Watch applied to the CURRENT event), Papic packs per ruling 5.
2. Server: verify a transaction (App Store Server API, signed JWS) → create the orders row (platform 'ios') → the SAME
   activation path as web payments; App Store Server Notifications v2 endpoint (refund → deactivateOrderSku). Idempotent
   on the Apple transaction id (new column/table via pnpm migration:new, RLS at create, service-role only).
3. App UI exactly as the prototype frames: offered only at ✓ Apply (ruling 2); Papic packs; Live Watch; Restore; the
   store-shell rules for what an iOS shell may show (App Review 3.1.1 — no steering to web payment inside the app).
4. Secrets (App Store Server API key, issuer id, key id, shared/bundle id) are env vars READ by the code — never create,
   print or commit them. List every App Store Connect setup step the owner must do (products to create with exact ids
   + prices, the server-notification URL, sandbox tester) in the PR body — those are the owner's, not yours.
Tests: unit + db tests for verify → order → activation, refund → deactivation, replay idempotency (same transaction twice
= one order), price mapping. Mock Apple in tests; never call Apple's production API. No iOS device needed for CI; if
you can build the Swift side locally (xcodebuild under the heavy lock), do it, else say so (memory: CI never compiles
the desktop Rust crate — iOS likewise may not be compiled by CI; say exactly what was compiled).
Other builders: Papic capture (rd/papic-points-never-leak — don't touch papic reserve RPCs), Maker, onboarding, budget,
logo, sign-in. Fragment changelog.d/rd-in-app-purchase.md.
