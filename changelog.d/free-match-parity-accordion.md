# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-12 · fix(vendors): free the % match on the budget-planner accordion too (parity with the Services grid)

Follow-up to "free the % match + score it on budget & faith" (PR #3142), which un-gated the % on the primary Services grid but left the budget-planner inline cards gated. `plan-budget-accordion.tsx` computed the per-candidate "% match" only in personalized/AI mode (`personalizationEnabled && marketplace_business_name && !setnayan`) across both of its render paths (the card atom + the compact list). Both are now un-gated to `marketplace_business_name && !setnayan` — the % shows for **every** couple on any real marketplace vendor, matching the Services grid. The `marketplace_business_name && !setnayan` guard stays (off-platform/manual picks + 1st-party Setnayan services carry no comparable ranking signal). The now-dead `personalizationEnabled` prop was removed from `VendorCardAtom` (destructure + type + call site); the unrelated `child.personalizationEnabled` render branch is untouched.

The guided tour (`tour/vendors/page.tsx`) already shows the pills — it forces a synthetic `guided` event so `aiActive` reads true — so no change was needed there.

Note: the accordion still feeds the scorer only distance/rating/reviews/verified (its picks don't carry price/faith), so the new budgetFit/faithFit dims sit at neutral there — a future enrichment, not a regression (admit-unknown).

Verified: `tsc --noEmit` clean.

SPEC IMPACT: Extends the couple-side free-matching line to the budget-planner surface — the vendor % match is now free on every dashboard surface that shows it. No pricing/schema change. See PR #3142 + memory `project_setnayan_ai_free_paid_strategy`.
