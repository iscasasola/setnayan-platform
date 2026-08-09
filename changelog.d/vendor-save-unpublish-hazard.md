## 2026-08-09 · fix(vendor): delete the orphaned full-form save that would have unpublished every shop wired to it

`saveVendorProfile` (`apps/web/app/vendor-dashboard/actions.ts`) is **deleted**, not patched. It was the action behind the full `/vendor-dashboard/profile` form, retired 2026-07-05 — the route has been a 34-line redirect stub to My Shop ever since, and the action outlived it by five weeks with **no caller**, still exported from a `'use server'` module whose other exports are wired to client components.

### Why deleting beat dropping the one bad key

It built a FULL payload from FormData and `UPDATE`d the whole thing, so every column it named was written from whatever the submission happened to carry — and **absence is not emptiness**. `is_published` was the reported hazard:

```ts
is_published: formData.get('is_published') === 'on',
```

An unticked checkbox posts nothing. So does a checkbox that was never rendered — identical FormData, and this line reads both as `false`. **There has never been a `name="is_published"` control in the vendor UI**; the app's only one is on the ADMIN page `app/admin/vendors/[vendorProfileId]/edit/page.tsx`. So every form that could ever have been wired to this action — and it looked exactly like the natural "full form save" — would have unpublished the vendor's own shop on every submit, and reported success.

**It was one of three identical blind booleans in that same object literal**, which is what settled the choice. `social_feature_opt_out` (silently opts a shop out of the verification celebration post) and `same_day_available` (drops it from the couple's Day-of "Get help" shortlist) had the same `=== 'on'` shape and *no control anywhere in the app at all*. Twelve more columns were nulled by absence: `tagline`, `website`, `contact_email`, `contact_phone`, `location_city`, `hq_address`, `logo_url`, `services`, `business_owner_name`, `in_business_since_year`, `portfolio_r2_keys`, `gallery_video_links`. It also bypassed the per-field validators that replaced it — a submission with no `business_name` wrote `''`, which `updateVendorProfileField` refuses outright ("Shop name is required") precisely because the completion checklist depends on that field being non-blank.

The compatibility pair was already fenced off on 2026-08-05 under a comment headed **"COMPATIBILITY: ABSENT ≠ EMPTY"** — the same class of bug, found once, fixed for two of fifteen columns. Fencing the remaining thirteen one key at a time would have left a full-form escape hatch nobody calls and everybody has to keep re-auditing. Deleting the function closes all fifteen at once.

**Nothing a vendor can reach was lost.** Identity + gallery fields live on `updateVendorProfileField`; `business_slug` + microsite on `updateVendorWebsiteField`; venue/ceremony fit on `shop/venue-match-actions.ts`; the founding date on `updateBusinessStartDate`.

### The guard

`apps/web/lib/vendor-publish-guard.test.ts` (4 tests). Scans `app/` + `lib/` outside `app/admin/`, **with comments stripped** — the tombstone left in `actions.ts` names `is_published` a dozen times while explaining why the write is gone, and a guard that fails on its own documentation is a guard someone deletes. It fails on: any `formData.get/getAll/has('is_published')` in vendor-scoped code (zero exceptions); any new non-admin write of the column (two reasoned exemptions — the claim-time `INSERT` default in `app/vendor/claim/[token]/finalize/page.tsx`, and `VENDOR_PROFILE_PII_SCRUB` in `lib/erasure/coverage.ts`); `saveVendorProfile` being re-exported; and — in the other direction — the admin publish toggle disappearing, so the rule can't be satisfied by relocating the control into vendor code or by a stale exemption widening what's permitted.

⚠ The guard's own first cut used `/is_published\s*:\s*(?!boolean\b)/` to skip type declarations. That regex does not say what it looks like: `\s*` backtracks to zero width, so the lookahead runs against `" boolean"`, sees a space, and passes. It flagged two pure type files. Replaced with a capture-and-inspect. Recorded because the benign direction of that mistake is the same mechanism that would let a real write past.

### Three existing guards repointed, none weakened

- **`lib/vendor-compatibility.test.ts`** — the `compatible_fields_present` assertion guarded the fence inside the deleted action. Now asserts the **absence** of any compatibility write in `actions.ts` (strictly stronger than a guarded write), plus a new positive test that the live writer `shop/venue-match-actions.ts` reads the posted checkboxes — correct *there*, because its card always renders them.
- **`lib/venue-settings.test.ts`** — "the vendor allowlist derives the list" pointed at `actions.ts`, whose last vendor-side reference went with the action. Repointed at `shop/venue-match-actions.ts`, where the allowlist now lives with its only writer.
- **`lib/vendor-portfolio-ref-tenancy.test.ts`** — the SEC-1 wiring count drops from "definition + 2 call sites" to "+ 1". Lowered with the reason written into the test; it still fails in both directions.

### ⚠ Two things the owner should know

1. **Four columns have a reader and no writer**, and did **not** gain one here: `tagline`, `website`, `social_feature_opt_out`, `same_day_available`. They had no writer before this deletion either (the action had no caller), so this is a **pre-existing gap being recorded, not one being created** — but `changelog.d/open-shop-onboarding-logo-email.md` still claims "Website + social remain fully editable in the dashboard… `website` at `vendor-dashboard/profile/page.tsx`", and that page has been a redirect stub since 2026-07-05. This is the fifth instance of the "column with a reader and no writer" shape the codebase already tracks.
2. **The publish-completeness gate is gone as code.** The 8-field check that forced `is_published = false` on an incomplete profile lived only inside this action, so it had not been reachable since 2026-07-05. Publication is an admin action, and `app/admin/vendors/actions.ts` has never consulted profile completeness. The stale claim to the contrary in `lib/open-shop-logo-gate.test.ts`'s docblock (a decision-pinning suite for owner decision 4) is corrected in place; the logo obligation is carried by `businessProfileChecklist` and `verificationSubmitMissing`, which both genuinely run.

Also refreshed five comments that named the deleted action as if it still existed (`lib/vendor-compatibility.ts`, `app/vendor-dashboard/invite/page.tsx`, `app/admin/verify/actions.ts`, `app/vendor-dashboard/_components/video-links-editor.tsx`, and the two test headers) — a comment naming a deleted function is how the migration-prefix false belief spread through six migration headers.

Verified: `tsc --noEmit` clean, `next lint` clean on every touched file, `lib/**/*.test.ts` green.

SPEC IMPACT: None. `is_published` is already documented as vestigial — Explore stopped querying it, both Explore and the public shop page read via `createAdminClient()` (bypassing the surviving `vendor_services_public_read` RLS policy), and the live marketplace gate is `public_visibility` + `verification_state` per `lib/vendor-visibility.ts`. PR #4266 removed the last vendor-facing gate keyed on it. No column is dropped and no locked decision changes; the two owner-facing findings above are reported, not acted on.
