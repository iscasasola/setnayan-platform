## 2026-11-17 · fix(supplier-plans): a refused plan read never reads as "You are on Free"

From the supplier dashboard audit (Plans):
- `PlanScreen` used to drop the first `vendor_profiles` tier read's `error`. On a refused read `asVendorTier(undefined)` answered `'free'`, so a paying shop read "You are on Free · nothing to pay" and "there is nothing to cancel", with every paid row locked behind "Get verified". This hit both the Plan page and the Shop ⚙ "Plan and billing" fold. It now draws one "Couldn't load your plan — nothing has changed" line and no rows.
- Guarded by `subscription/a-refused-plan-read-is-not-free.test.ts`.

SPEC IMPACT: None.
