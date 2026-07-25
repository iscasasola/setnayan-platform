## 2026-07-25 · feat(vendor): apply the launch free window to vendor subscriptions + add-ons (flag-dark)

`lib/vendor-launch-free-window.ts` (shipped #3689) had been applied to nothing.
This wires it, behind the existing default-OFF `NEXT_PUBLIC_VENDOR_LAUNCH_FREE_WINDOW`
flag, to the vendor-side paid SKUs the owner's launch posture covers — "selected
paid features are FREE until 2026-11-30 to seed supply; the listed prices are the
post-launch steady state" (`Vendor_Monetization_Model_LOCKED_2026-07-25.md`).

**New pure layer** — `apps/web/lib/vendor-launch-free-window-coverage.ts` (+ tests):
writes the coverage set down ONCE (`vendor_subscription`, `vendor_ai_addon`,
`vendor_3d_booth`, `papic_challenge`) and exposes `isVendorLaunchFreeNow()` /
`vendorLaunchFreePricePhp()`. No env, no clock, no I/O — the flag and `Date.now()`
are passed in at the call site, so it unit-tests under `tsx --test`.

**Add-ons (AI Chatbot · 3D Booth/Plan Ads · Papic Challenge)** now activate at ₱0
during the window through a **REPEATABLE, non-trial-consuming grant** — the same
shape the "free until your 6th booking" policy already uses. The launch grant
deliberately does NOT stamp `ai_addon_trial_used_at` / `booth_addon_trial_used_at`,
so a vendor still holds their one free cycle when the window closes, and
`nonStackingFreeExpiry` clamps a double-click to one 28-day cycle instead of
stacking. As with every free grant, the ₱0 path writes an audit-only ₱0 `'paid'`
order and NO `payments` row (`payments.amount_php` has a `> 0` CHECK).

**Subscriptions**: `create_vendor_subscription` prices the order from
`vendor_billing_catalog` (which has a `price_php > 0` CHECK) and has no ₱0 branch,
so during the window the page shows ₱0 + "free through 30 Nov 2026" and
`startSubscriptionPurchase` mints **no order at all** — it never says "free" while
the rail takes a payment. Granting the tier itself stays with the existing
`promo_free_windows` `all_vendors` tier-promotion mechanism (admin-configured);
see the owner note below.

**Deliberately NOT covered:** Deep Search (metered, ~₱10/₱30 real cash cost per run
per the locked model § 9 — a blanket ₱0 is a money-out abuse vector and would
collide with its atomic once-per-cycle allowance claim), vendor token packs (stored
value, not a feature), and the sourced-lead booking fee (separate stream).

Because token packs are not covered and the plan card's "bundle tokens with your
plan" picker exists only to fold a pack into the PLAN order, that picker is hidden
during the window — otherwise it would be a dead end (pick a pack, see "You pay
₱X", find no button). Packs stay buyable standalone at `/vendor-dashboard/tokens`.

⚠ Flag OFF (default) is byte-identical to today — the coverage test loops every
SKU × every instant to pin that. Nothing is flipped; no catalog `is_active` change.

⚠ OWNER SIGN-OFF NEEDED before flipping the flag: (1) confirm the coverage set,
especially the Deep Search exclusion; (2) flipping it disables the subscription buy
button, so pair the flip with a live `promo_free_windows` `all_vendors` window (or
a comparable grant) or vendors sit on Free with its booking cap — including any
vendor already on a paid plan whose subscription lapses mid-window, who would have
no way to renew.

SPEC IMPACT: None — implements the already-locked launch posture in
`Vendor_Monetization_Model_LOCKED_2026-07-25.md` ("Launch posture"); no price,
SKU, or tier definition changes.
