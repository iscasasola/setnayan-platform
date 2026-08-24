## 2026-08-24 · fix(admin): the subscriptions desk stops promising a currency the database retired

`/admin/subscriptions` told an operator that pressing **Confirm** activates the vendor's tier
**and hands them a bundle of the old vendor token currency**, and rendered a per-order pill
counting it. Neither has been true since **2026-08-07**, the day that currency was retired
product-wide (owner lock 2026-07-21). The sentence outlived the mechanism by seventeen days.

**Read out of production by the object, not from a migration and not from a comment:**

| checked | result |
|---|---|
| `approve_vendor_subscription` body | delegates to `_apply_subscription_credit` |
| `_apply_subscription_credit` body | *"The token bundle and the add-on credit were REMOVED here (2026-08-07). Activating a plan now activates a plan. Nothing else."* Returns `bundle: 0`, `addon_tokens: 0` as constants. |
| `grant_admin_direct_tokens` | **still exists** — one caller left, `redeem_vendor_token_voucher`, not this path |
| `vendor_subscriptions` rows | 2, both `pending_payment`, **0** with a non-zero `addon_token_count` |
| `vendor_billing_catalog` token packs | 6 rows, **all `is_active = false`** |

🔑 **`grant_admin_direct_tokens` STILL EXISTING IS WHY THE CLAIM SURVIVED BEING READ.** A named
function that resolves makes a docblock about it look checkable and true. **A named function is not
a call site** — the only way to find out was to read the body of the function that was supposed to
call it.

🔑 **AND THE PILL COULD NEVER HAVE RENDERED, WHICH IS WHY NOBODY CAUGHT THE SENTENCE.** It was
gated on `addon_token_count > 0`; the only writer of that column prices an add-on from an **active**
`token_pack` catalog row, and all six are inactive. A dead branch sitting over a false sentence —
the one element on screen that could have contradicted the claim was unreachable.

**Changed:** the lede now says what the live function says about itself (*"activates the plan and
nothing else — it is safe to press twice, a repeat is a no-op"*), the pill is gone, the two add-on
columns are no longer selected or typed, and both docblocks are corrected.

⛔ **The COLUMNS stay.** This page was their only reader in the repo, but `create_vendor_subscription`
is live and still writes them — unread, not orphaned. Dropping a column is a migration and a
separate decision. Prices, SKUs and the tier ladder are untouched.

🔴 **ONE RISK NAMED, NOT FIXED — it is in SQL, outside this session's territory.** The CHARGE path
and the GRANT path were retired at different layers. `create_vendor_subscription` still carries the
whole add-on machinery — it will price a token pack, fold it into `amount_php` and store the count —
while the confirm path grants nothing. **The only thing between a vendor and being charged for
tokens nobody will hand them is `is_active = FALSE` on six catalog rows**, and re-activating one is
exactly the sort of tidy-up somebody does while cleaning a catalog.

SPEC IMPACT: None. (The retirement itself is already recorded — `Pricing.md § 0.C`, DECISION_LOG
2026-08-07. This corrects a screen that had not caught up.)
