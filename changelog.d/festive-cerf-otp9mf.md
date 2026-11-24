## 2026-11-23 · data(catalog): PAPIC_GUEST_150 gift = retail; the Video booth is retired

Two owner rulings from specs DECISION_LOG "Seven open calls settled" (items 6 and 7), done as data because the owner can't make the admin edits right now.

- **Migration `20271361354222_papic_guest_150_gift_equals_retail_and_retire_video_booth.sql`** (data only, no schema change, one transaction):
  - `platform_retail_catalog_v2` `PAPIC_GUEST_150`: `gift_price_php` 90 → 99, so it equals retail. It runs only while the gift is still 90, so a later admin edit is never overwritten.
  - `onboarding_refinement_options` `photo_booth` / `Patiktok` ("Video booth"): `status` active → retired. It runs only while the option is still active.
- **Sign-up already hides it:** `getOnboardingRefinements` (`lib/onboarding-refinements.ts`) reads options with `status = 'active'`. Its fallback (`REFINEMENTS_DATA`, `app/onboarding/wedding/_data/refinements.ts`), used only when the read fails, still lists "Video booth". It is left alone here (no UI code in this PR).
- Guard: `tests/db/papic-guest-150-gift-equals-retail-and-video-booth-retired.db.test.ts` covers the state after the replay, prod's state before the ruling, the admin-edit guard, and that no other row changes.

SPEC IMPACT: None. It carries out DECISION_LOG "Seven open calls settled" items 6 and 7 as written.
