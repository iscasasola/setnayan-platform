## 2026-11-06 · feat(supplier-plans): the Custom supplier plan is retired from the app — deleted, not hidden

Owner, 6 Nov 2026 (DECISION_LOG), asked whether Custom was gone only from the For Suppliers page or from the app too:
*"from the app"*. This reverses the 2026-08-27 "hide, not retire" ruling (`lib/custom-tier-offered.ts`). Production was
checked first (read-only, 6 Nov): ZERO shops on `tier_state = 'custom'` (2 free, 2 solo) and only solo subscription
rows — nobody is stranded.

- **Deleted, not flagged.** `'custom'` is gone from `VENDOR_TIERS` and from every plan table (caps, label, price
  fallback, rank). Deleted files: `lib/custom-tier-offered.ts`, `lib/vendor-custom-catalog.ts` (+ its hard-coded
  price fallback), `lib/vendor-custom-pricing.ts`, `lib/vendor-effective-caps.ts`, the supplier configurator
  `app/vendor-dashboard/subscription/custom/`, the admin composer `app/admin/custom-plans/` and the "Custom plans" tab
  on `/admin/pricing`, and the `vendor_custom_plan__` activation hook in `lib/sku-activation.ts`.
- **Supplier screens:** the "Custom plan ›" row, the Custom entry in the plan dropdown and "your Custom quote" copy are
  gone. Copy that offered "Solo, Pro, Ultra or Custom" now reads "Solo, Pro or Ultra".
- **Public pages:** the For Suppliers matrix/deltas no longer carry a Custom column, card or band — and two lines that
  still said "franchises & multi-location go Custom" / "Custom is built for franchises" while it was hidden are gone.
- **The branch add-on still EXTENDS on renewal** — its "a purchase extends, never resets" helper lived in the Custom
  pricing file; it moved to `lib/term-extends.ts` with its tests (`a-branch-renewal-extends.test.ts`).
- **API access fails closed.** `/api/v1` access was granted ONLY by an active Custom plan (`composition.api_access`).
  `resolveApiVendor` now answers null for everyone and the copy says API access is not open to any plan right now.
  Whether another plan should carry it is an owner decision, not made here.
- **Database** (`20271310256381_retire_the_custom_supplier_plan.sql`): refuses to run if any row is on Custom;
  CHECK constraints make `'custom'` unwritable on `vendor_profiles.tier_state`, `.pending_tier` and
  `vendor_subscriptions.tier` (the enum label stays — Postgres cannot drop one); the five `vendor_custom_*` catalogue
  rows are retired (off sale + `retired_at` + `retirement_reason`), never deleted; `vendor_tier_rank` /
  `vendor_tier_limit` / `sweep_vendor_tier_expiry` lose their Custom arms; the Custom-only "no limit" axis
  (`vendor_pipeline_is_unlimited`) is dropped and its three callers re-created without it. RLS untouched. Ultra's
  add-ons (`vendor_additional_branch`, `vendor_extra_seat`) untouched.
- **Guards:** `lib/the-custom-plan-is-retired.test.ts` (no tier key, no route, no code read of a `vendor_custom_*`
  SKU / `vendor_custom_plans` / `tier === 'custom'`) and `tests/db/the-custom-plan-is-retired.db.test.ts` (the CHECKs
  refuse, the rows are retired, the axis is gone, Ultra's add-ons are still on sale).

SPEC IMPACT: `DECISION_LOG.md` 2026-11-06 "THE CUSTOM SUPPLIER PLAN IS RETIRED FROM THE APP" is now BUILT (this PR);
it reverses the 2026-08-27 row "THE OWNER'S PRICE SHEET … one retirement RULED AND REVERSED THE SAME DAY". 
`apps/web/VENDOR_TIERS_AND_BENEFITS.md` §2 Custom card and §11 rate card carry a "retired from the app" banner.
Open owner questions (API access · the `vendor_custom_plans` table · the per-date "no limit" axis) are listed in the PR.
