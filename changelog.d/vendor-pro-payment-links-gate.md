## 2026-07-21 · fix(vendor): every Pro vendor was locked out of payment links by a gate reading two SKU codes retired in May

Found by the sell-vs-deliver gap audit. **Exact same failure shape as the Live Studio lockout fixed this morning in PR #3444**: a hardcoded SKU-code list checked against a column those codes never reach.

`isVendorProActive` — the gate on `/vendor-dashboard/payment-options` — matched `orders.service_key` against `PRO_TIER_SKUS = ['vendor_pro_weekly', 'all_tools_unlock_annual']`, two **V1 codes retired 2026-05-28**. Its own doc comment explained the design: *"There is no DB tier column — tier = an active `orders` row."* That stopped being true when `vendor_profiles.tier_state` landed — the three subscription RPCs (`create_` / `approve_` / `confirm_vendor_subscription`) write `tier_state` and **never touch `orders` at all** (verified via `pg_get_functiondef`).

Measured in prod: **0 orders have ever carried either code**, while **5 `vendor_profiles` sit at `tier_state='pro'`**. So every Pro vendor saw *"Payment links are a Pro & Enterprise feature — upgrade to add one"* — an upsell with no upgrade that could ever satisfy it. The gate had been unsatisfiable since the day the codes were retired.

Rewritten to read `vendor_profiles.tier_state` via `isTierAtLeast(_, 'pro')`, the canonical tier source used by `lib/vendor-feature-gate.ts` and `lib/vendor-tier-caps.ts` everywhere else in the app. Because it is rank-derived, `enterprise` and `custom` inherit automatically and no future tier needs an edit here. `PRO_TIER_SKUS` deleted.

**Two prod realities that would each have broken a naive rewrite** — both are now pinned by tests:

1. **`tier_expires_at` is NULL on all five real Pro rows** (free-during-launch / admin-set). NULL means **no expiry**, not "expired" — the obvious `.gt('tier_expires_at', now)` filter would have faithfully reproduced the very lockout being fixed. Only a non-null timestamp in the past deactivates; an unparseable value fails closed.
2. **One real user owns 46 `vendor_profiles`.** `.maybeSingle()` would have thrown on multiple rows. The query reads all of the user's profiles and passes if **any** is Pro-or-better.

New `lib/vendor-payment-methods.test.ts` — 9 cases covering both realities above, tier inheritance (enterprise/custom pass), sub-Pro denial (free/verified/solo/null), past vs future vs unparseable expiry, and fail-closed on query error. One test asserts the queried **table and column** are `vendor_profiles.user_id`, so a future refactor back toward `orders` breaks the build rather than silently re-locking every paying vendor.

Full suite green: **2418/2418**. Typecheck clean.

SPEC IMPACT: None — corrects code to match the already-canonical `tier_state` model. The audit is logged at `Sell_vs_Deliver_Gap_Audit_2026-07-21.md` in the corpus.
