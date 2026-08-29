## 2026-08-29 · feat(vendor): Papic Challenges is a ₱2,500 / 28-day subscription — and its paywall was open in production

**SPEC IMPACT:** `Pricing.md` + `DECISION_LOG.md` row 2026-08-29 (the per-event ₱400 SKU becomes a
28-day recurring add-on). Catalogue row repriced in the migration; no doc re-types the number.

**Owner 2026-08-28, verbatim:** *"unlimited us 2500 for 4 weeks."*

### 🚨 THE FINDING, WHICH IS BIGGER THAN THE FEATURE

Read out of prod **by the object** (`pg_get_functiondef`, not a migration and not a comment): the
live `papic_create_vendor_challenge` had **no paid gate of any kind**. `20270907628470` added one;
four weeks later `20271001130000` replaced the function to make the TIER gate conditional and
**rebased its body on `20270906348207`** — a migration whose prefix is LOWER than the one that added
the paywall. Its own header says the body is *"otherwise identical"* to that older migration. It
was, and that is the bug.

🔑 **A `CREATE OR REPLACE` that copies an older body forward silently reverts every guard added in
between.** Nothing threw, no test covered it, and the DELIVERY half kept its gate — so the paid
product half-worked and looked fine. Inert: prod holds **0** vendor missions, **0** completions,
**0** sponsorships and **0** challenge orders, ever.

**Repaired here rather than in its own PR** because the repair and the new entitlement are the same
line of code, and it cannot happen the same way again: *"is this shop entitled here?"* now lives in
ONE function called by BOTH RPCs, so dropping it deletes a named call rather than an inline block —
and a db test asserts both callers still make it.

### 🚨 AND THEN I MADE THE IDENTICAL MISTAKE, IN THIS FILE, AND THE SUITE CAUGHT IT

My first draft of the self-grant guard `CREATE OR REPLACE`d
`guard_vendor_profiles_entitlement()` from the migration that created it. **Ten db tests went red**,
each naming a guard added afterwards that my replacement had deleted: `ai_addon_level`,
**`verification_state` (a shop could have self-verified)**, **`public_visibility` (reversing an
admin's suspension)**, `experience_verified_at/_by`, `last_verified_at`, the year-change
auto-unverify, all five `pending_tier` columns and `subscription_credit_php` (a free plan change and
a self-written account balance).

⇒ **The rule is not "be careful". It is that a `CREATE OR REPLACE` must start from the OBJECT
(`pg_get_functiondef`), never from the migration that last touched it** — applied migrations are
never edited, so the newest migration is not the newest change. It was caught only because those
guards have BEHAVIOURAL tests that attempt the forgery; a guard asserted by reading source would
have sailed through. The final body is copied from prod with exactly two added disjuncts.

### What ships

- **₱2,500 / 28 days, unlimited, across every celebration the shop is booked for.** 28 days is the
  cadence every other vendor add-on already bills on, so this needed **no new renewal arithmetic** —
  it reuses the Vendor AI add-on's shape: an expiry on `vendor_profiles`, evaluated at READ time
  (this project is cron-free). Early renewal stacks; renewing after a lapse starts from today.
- **The buy surface moved off `/vendor-dashboard/clients/[eventId]`** to the subscription hub, beside
  the AI and 3D add-ons. A shop subscription bought from a celebration's page is a purchase hidden
  behind a booking. The celebration page keeps the composer and, when the shop has not subscribed,
  one link back.
- 🔑 **The action no longer accepts an event id at all.** It used to take one FROM THE FORM, which is
  why its docblock spent a paragraph on the binding that stopped a forged one. **A parameter you do
  not accept cannot be forged** — `orders.event_id` is null and the whole class is gone.
- **TWO questions, TWO functions.** *Can this shop buy it?* (shop-level; "already subscribed" is a
  DENIAL) vs *can it run one here?* (booked + Papic on + entitled; "already subscribed" is the state
  that says YES). The same fact inverts between them, which is exactly why one combined gate stopped
  being correct the moment the price became a subscription.
- **Legacy ₱400 per-event sponsorships are still honoured**, on their own event only. Nobody in prod
  holds one; a repricing must never retroactively unsell what somebody bought.
- **The double-charge guard is scoped by VENDOR, not by event** — under a subscription the old
  per-event filter would have let one shop mint a second pending order from another celebration's
  screen and be charged twice for one window.
- **The reversal winds the window BACK by 28 days rather than clearing it** (never past now, never
  extending): clearing would delete a second, still-paid cycle. The change of shape from a row to a
  window brings that obligation with it.
- **The tiered matrix moved too.** `vendor-addon-tier-pricing.ts` OVERRIDES the catalogue when
  `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING` is on; leaving its old `entry 500 / growth 400` there
  would have charged ₱400 for a 28-day subscription the moment that flag flipped — catalogue right,
  charge wrong. Both bands are ₱2,500: the owner set a NUMBER, not a band pair.
- **RA 10173:** the new window is added to the vendor subject-export projection. Its guard (T12) is
  what told me, by name.

### 🔒 Security

The window is a paid entitlement on a table whose policy is `FOR ALL` with no column scoping, and
`authenticated` holds table-level INSERT/UPDATE — so the trigger is the only control. Added, with
behavioural tests in both arms (UPDATE and the DELETE-then-reinsert INSERT route). The shared
entitlement function takes a `vendor_profile_id` and is therefore `service_role` only.
Exposure baseline regenerated and **read line by line**: exactly **one** added fact
(`vendor_profiles.papic_challenge_expires_at`, `anon=-`, identical in shape to every sibling
entitlement column), zero removals absorbed.

### ⚠ Measured and NAMED, not silently reconciled

`platform_settings.vendor_addon_tiered_pricing_enabled` is **TRUE in production** while the session
brief records `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING` as OFF. **The two switches are out of step**:
the database admits every tier, the app gate refuses below Pro. Which one the owner meant is a
pricing question, and the strict side is the safe one to be on, so nothing was changed.

### Verification

`test:unit` **11,361 pass / 0 fail** · `test:db:ci` **1,881 pass / 0 fail** · `tsc --noEmit` exit
**0**, 0 errors · all **30** CI guard scripts pass.
**Four mutations, occurrence-counted before → after, all RED**, restored from an explicit `cp`
backup: drop the restored paywall (1→0) · drop the legacy sponsorship arm (1→0) · drop the new column
from the self-grant guard (1→0) · reprice the catalogue row to 400 (1→0).

`lint-port-no-lost-controls` caught the buy button leaving the celebration page; the port baseline was
regenerated **and its diff read** — the two removed symbols are the moved buy control, the celebration
route GAINS `/vendor-dashboard/subscription` as a destination, and nothing else is lost.

⚠ **One existing price assertion was changed, not weakened** — it pinned ₱500/₱400, which were
per-EVENT prices under the model the owner replaced. The change is written out in full in its own
comment.
