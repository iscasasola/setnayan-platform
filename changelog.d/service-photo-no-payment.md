## 2026-06-20 · feat(vendor): service wizard gets a cover photo + sheds availability & payment ("the card needs a photo")

Two owner directives (2026-06-20) make the service listing the simple **menu** it should be:

1. **The card needs a photo.** `vendor_services.primary_photo_r2_key` already existed and the explore + public cards already render it (logo/placeholder fallback) — but nothing *set* it. The create-a-service wizard now has a **cover photo** upload (step 1), and a photo is **required to publish** (drafts can save without one).
2. **Availability lives on a calendar, not the service; payment is negotiated.** The wizard drops the **Availability** step (the calendar owns the limit — owner: "the calendar has the limits, not the service") and the **Payment-plan** step (terms are agreed in the inquiry). A service is now just: photo + category/title → from-price → perk → comes-with → publish.

- **`_components/service-wizard.tsx`** — rewritten to 4–5 steps; `FileUpload name="primary_photo_r2_key"` in step 1 with a client publish-gate (photo + perk); removed the Availability + Payment steps, the `ScheduleEditor`, and the `daily_capacity`/`branches`/`slotsPerDay` plumbing. New `vendorProfileId` prop (photo upload path).
- **`services/new/[category]/page.tsx`** — passes `vendorProfileId`; dropped the now-unused tier/`slotsPerDay` read.
- **`services/actions.ts` → `commitVendorService`** — parses `primary_photo_r2_key`, writes it into the `fields` JSONB, and gates publish on it server-side (drafts exempt; the perk gate already lives in the RPC).
- **Migration `20270209713470`** — `CREATE OR REPLACE save_vendor_service` adding `primary_photo_r2_key` to the INSERT + UPDATE (re-defines `20270208451790` + the one column; both ship in this push; idempotent). NOT applied.

Flag-gated behind `NEXT_PUBLIC_SERVICE_WIZARD_ENABLED` (same flag the wizard already uses) — the legacy `?add=` form is untouched, so merging is inert until the flag + both migrations land. The wizard UI isn't runtime-verifiable from the dev env (needs the flag + migration + an authed vendor session) — typecheck clean; wants a vendor smoke-test on go-live.

Note: the **vendor-named calendars w/ explicit service membership** rework (owner picked it this session) is a separate, careful pass on the live booking-pool layer — NOT in this PR.

SPEC IMPACT: 0022 vendor services builder + service-card. Logged in `DECISION_LOG.md`.
