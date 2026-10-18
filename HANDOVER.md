# HANDOVER — rd/in-app-purchase · PR #6637 (draft, label do-not-auto-merge) · 2026-10-18 ~18:05 PHT

## State
- BUILT (all pushed): Apple In-App Purchase for Papic credits · Event Hub Pro · Live Watch, flag-dark
  (`NEXT_PUBLIC_APPLE_IAP_ENABLED` off + needs a new iOS build announcing `SetnayanIAP/1`).
- CI: 26/26 green at 5a84429ee1. Then main moved (onboarding #6636, Logo #6638) → merged origin/main again
  (conflicts in home-first-screen.tsx + dev/home-lab/page.tsx, both sides kept; home-shelf + ugat screens
  baselines regenerated with their generators). Full local unit suite 26,145 tests: 0 fail (before this merge).
- Next step: watch CI on the merge commit; when green, delete this file in one push and push nothing more.
  If a red appears, read its log (gh api repos/iscasasola/setnayan-platform/actions/jobs/<id>/logs).
- Swift plugin compiled locally (xcodebuild -sdk iphoneos, CODE_SIGNING_ALLOWED=NO → BUILD SUCCEEDED).
  Not run on a device; CI never compiles iOS.
- Screens: ~/Documents/Claude/Projects/shots-2026-10-18/6637/ (lab: /dev/home-lab?store=1&apple=1, ?view=apply&screen=…).

## Key design (details in the PR body)
- Intent row `app_store_purchases` (migration 20271276386641, service-role only) — its key is StoreKit's
  appAccountToken, so Apple's signed transaction names the event. JWS verified locally (Apple Root CA - G3 pinned).
- Fulfil = orderRowFor (ios) + paymentRowFor (app_store) → matched + promote (PROMOTABLE_ORDER_STATUSES) →
  activateOrderSku by the promoting call only. REFUND (ASSN v2 /api/iap/app-store-notifications) → refunded →
  deactivateOrderSku.
- Pro: Maker's "Unlock Pro and Apply" in the app opens /dashboard/[eventId]/apple-pro, returns with ?apply=1
  (own page because the Maker first-load budget 507 KB is full — measured 506.8 KB with this PR).

## Owner's App Store Connect steps (his, not a session's)
1. Create 7 CONSUMABLE in-app purchases (ids are permanent):
   com.setnayan.app.event_hub_pro (≥ ₱5,882.36) · com.setnayan.app.live_watch (≥ ₱2,941.18) ·
   com.setnayan.app.papic_credits_100 (≥ ₱82.36) · _500 (≥ ₱411.77) · _1000 (≥ ₱823.53) · _5000 (≥ ₱3,294.12) ·
   _10000 (≥ ₱5,294.12) — floors = catalogue ÷ 0.85 on 2026-10-18; pick Apple's PHP point at or above.
2. App Store Server Notifications v2, Production + Sandbox URL: https://www.setnayan.com/api/iap/app-store-notifications
3. Sandbox Apple Account (Users and Access › Sandbox) for testing.
4. New iOS build: cd apps/mobile && npx cap sync ios → archive → TestFlight.
5. Vercel Production: NEXT_PUBLIC_APPLE_IAP_ENABLED=true, redeploy; buy each product once in Sandbox.
6. Attach the 7 IAPs to the app version at submission.
No App Store Server API key is needed by this build.
