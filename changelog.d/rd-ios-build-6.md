## 2026-10-23 · chore(ios): build 1.0 (6) — the resubmission that sells through Apple

App Review answered 1.0 (5) with "2.1(b) Information Needed". The owner resubmits **1.0 as build 6, WITH In-App Purchase** (the 18 consumables are created in App Store Connect, Paid Apps is active, server notification URLs are set).

- `CURRENT_PROJECT_VERSION` 5 → 6 in both build configurations; `MARKETING_VERSION` stays 1.0.
- No code change: the iOS shell already announces `SetnayanIAP/2` (#6743), and the one gate (`lib/iap/iap-gate.ts`) opens Apple only for `/2`+ **and** the owner's `NEXT_PUBLIC_APPLE_IAP_ENABLED`. Build 5 (`/1`) still never sells.
- Comments that said "1.1" now say "1.0 (build 6) or later"; guard 7 in `the-app-clears-the-side-safe-areas.test.ts` now requires a build past 5 (a duplicate upload is refused).

SPEC IMPACT: None (the owner's resubmission ruling is recorded in the controller follow-ups, 2026-10-23).
