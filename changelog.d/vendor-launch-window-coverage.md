## 2026-07-26 · feat(vendor): apply the launch free window to three vendor ADD-ONS (flag-dark)

`lib/vendor-launch-free-window.ts` (shipped #3689) had been applied to nothing.
This wires it, behind the existing default-OFF `NEXT_PUBLIC_VENDOR_LAUNCH_FREE_WINDOW`
flag, to the vendor-side paid ADD-ONS the owner's launch posture covers — "selected
paid features are FREE until 2026-11-30 to seed supply; the listed prices are the
post-launch steady state" (`Vendor_Monetization_Model_LOCKED_2026-07-25.md`).

**New pure layer** — `apps/web/lib/vendor-launch-free-window-coverage.ts`: writes the
coverage set down ONCE (`vendor_ai_addon`, `vendor_3d_booth`, `papic_challenge`) and
exposes `isVendorLaunchFreeNow()` / `vendorLaunchFreePricePhp()`. No env, no clock,
no I/O — the flag and `Date.now()` are passed in at the call site.

**New pure layer** — `apps/web/lib/vendor-addon-free-grant.ts`: `resolveVendorAddonGrant()`
answers WHICH kind of ₱0 an activation is (`launch_window` · `first5_bookings` ·
`first_cycle_trial` · `paid`) and therefore whether it may burn the vendor's one-time
free cycle. Both add-on actions now fork on `grant.repeatable` instead of on three
inline ternary chains that had no test on any of them.

**Add-ons (AI Chatbot · 3D Booth/Plan Ads · Papic Challenge)** activate at ₱0 during
the window through a **REPEATABLE, non-trial-consuming grant** — the same shape the
"free until your 6th booking" policy already uses. The launch grant does NOT stamp
`ai_addon_trial_used_at` / `booth_addon_trial_used_at`, so a vendor still holds their
one free cycle when the window closes, and `nonStackingFreeExpiry` clamps a
double-click to one 28-day cycle instead of stacking. As with every free grant the ₱0
path writes an audit-only ₱0 `'paid'` order and NO `payments` row
(`payments.amount_php` has a `> 0` CHECK).

### DESCOPED after adversarial review — subscriptions are OUT

The first cut of this branch also covered `vendor_subscription`. It is **removed**.
`create_vendor_subscription` prices the order from `vendor_billing_catalog` (a
`price_php > 0` CHECK) and has no ₱0 branch, so the only way that cut could honour
"plans are free" was to take the buy path away — and that was a closed loop, not a
discount:

- the plan CTA became a disabled "Free during launch" button and
  `startSubscriptionPurchase` refused server-side, so **no paid tier was obtainable**;
- both add-ons this window *does* cover are Solo+/Pro+ gated on the raw
  `vendor_profiles.tier_state`, so the "free" AI add-on became **unreachable** —
  the card said "Free through 30 Nov 2026" directly above "Upgrade above to add it",
  pointing at the button the same change had disabled;
- a paid vendor whose `tier_expires_at` fell inside the window lapsed to Free on
  their next dashboard load with **no way to renew** until 1 Dec;
- and the page still sold the Custom plan at ₱8,999+/28d under a banner saying every
  paid plan was free.

Removed with it: the "every paid plan is free" banner, the ₱0 plan price + disabled
CTA, the server-side refusal in `startSubscriptionPurchase`, and the hiding of the
bundle-tokens picker. `subscription/actions.ts` and
`_components/subscription-cards.tsx` are now **identical to `main`**; the plan page
keeps only the two add-on launch-free flags. Making plans genuinely free needs a
DB-authoritative ₱0 order that the normal apply-then-pay/activation path credits —
a design change, and one that must not take a client-supplied "this is free"
argument. The already-shipped admin-driven `promo_free_windows`
(`audience_type='all_vendors'` + `promoted_vendor_tier`) remains the intended home
for a free-tier promotion: it PROMOTES the tier rather than pretending an order was ₱0.

### Other fixes from the same review

- `vendorLaunchFreePricePhp()` **failed OPEN**: on the NOT-free branch a NaN/negative
  base returned `0`, and every caller branches on `pricePhp <= 0` → free activation.
  On `main` that same NaN takes the PAID path (`NaN <= 0` is false). The not-free
  branch is now a pure pass-through.
- Both add-on cards render their price line ABOVE the eligibility gate, so a
  Free-tier or unverified shop was told "Free through 30 Nov 2026" three lines above
  "Vendor AI is available on the paid plans". `launchFree` is now AND-ed with
  `eligible` in both cards, matching the server's own gate.

### Tests

The first cut's 12 tests all passed with every consuming file reverted to `main` —
nothing imported a changed action or component. Replaced with 37 tests across three
files, each **falsified by reverting the fix and observing the failure**:

| revert | file | failures |
|---|---|---|
| re-add `vendor_subscription` to the coverage set | `vendor-launch-free-window-coverage.test.ts` | 5 |
| restore the fail-open price sanitiser | `vendor-launch-free-window-coverage.test.ts` | 1 |
| make a launch grant consume the trial | `vendor-addon-free-grant.test.ts` | 5 |
| restore the round-one subscription surface (3 files) | `vendor-launch-window-wiring.test.ts` | 3 |
| drop `&& eligible` from the AI card | `vendor-launch-window-wiring.test.ts` | 1 |
| fork on `launchFree` instead of `grant.repeatable` | `vendor-launch-window-wiring.test.ts` | 2 |

`vendor-launch-window-wiring.test.ts` asserts on SOURCE TEXT, not behaviour — the
consuming code imports `next/cache` / `next/navigation` / the Supabase server client
and cannot be imported under `tsx --test`. It proves the tested decisions are WIRED
into the buy paths and that plans stay buyable; it does not prove the runtime result,
and it is defeatable by renaming. Its header says so.

**Deliberately NOT covered:** vendor subscriptions (above), Deep Search (metered,
~₱10/₱30 real cash cost per run per the locked model § 9), vendor token packs (stored
value, not a feature), and the sourced-lead booking fee (separate stream).

⚠ Flag OFF (default) is byte-identical to today — the coverage test loops every SKU ×
every instant to pin that. Nothing is flipped; no catalog `is_active` change; no
migration.

⚠ OWNER SIGN-OFF NEEDED before flipping the flag: (1) confirm the coverage set,
especially the Deep Search exclusion; (2) note that with this branch the flag makes
the three ADD-ONS free but leaves plan cycles at list price — if the launch posture
means plans too, that needs the DB-side ₱0-order work described above, or a live
`promo_free_windows` `all_vendors` window.

SPEC IMPACT: None — implements part of the already-locked launch posture in
`Vendor_Monetization_Model_LOCKED_2026-07-25.md` ("Launch posture"); no price, SKU,
or tier definition changes. The plan-cycle half of that posture is NOT implemented
here and is called out above.
