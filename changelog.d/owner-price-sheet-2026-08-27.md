## 2026-08-27 · feat(pricing): the owner's price sheet — three customer prices, six vendor prices, Event Hub Pro, and two retirements

Every number below is an owner ruling given on 2026-08-27 and applied exactly as
given. Nothing was rounded, smoothed or "improved" on the way in.

**Customer catalog (`platform_retail_catalog_v2`)**

- `PAPIC_GUEST_50K` ₱10,000 → **₱11,200**
- `LIVE_STUDIO` ₱2,999 → **₱3,000**
- `PAPIC_ADDON_THANK_YOU` ₱2,499 → **₱2,500**
- `COUPLE_WEBSITE_PRO` title *"Couple Website PRO"* → **"Event Hub Pro"**. Price
  unchanged at ₱3,500, `service_code` unchanged. The catalog row was the last
  place still carrying the old name — the corpus and several rendered surfaces
  had said Event Hub Pro for weeks.

⚖ The 50K rung **shallows** the ladder's discount at the top (80% → 77.6%) rather
than deepening it. That is his call. Both rules the ladder guard actually
enforces still hold — never above ₱1 a credit, never worse per credit than the
rung below (₱0.224 vs 30,000's ₱0.25) — so **no guard was weakened**; one pinned
expectation in `apps/web/tests/db/papic-ladder.expected.ts` moved with the price,
and the guard was mutation-checked RED at the old value before and green after.

🔒 Unchanged, each ruled on: the other fifteen Papic rungs · `SETNAYAN_AI`
(₱2,499 / ₱1,499 onboarding) · `CUSTOM_QR_GUEST` at ₱0.

**Customer bundles (`platform_package_catalog`) — RETIRED**

- `PAPIC_UNLOCK` "Unlock all of Papic" ₱15,000 → off sale
- `PAPIC_UNLOCK_LTD` "Unlock all of Papic (Ltd)" ₱9,000 → off sale

Superseded by the sixteen-rung ladder: with 50,000 credits at ₱11,200, a ₱15,000
"unlock everything" package no longer prices sensibly beside it. Measured before
writing, not assumed — production holds **two orders in its entire life** and
neither is a bundle, and `event_software_activations_v2` holds **zero** rows for
either code, so nothing is stranded and no live entitlement is stripped.
`is_active` is honoured at every layer that renders or charges a bundle
(`fetchV2BundleCatalog`, `resolveBundleChargeCentavos`, `resolveServiceSellability`,
and the Papic studio buy card, which compares the flag rather than merely
selecting it) — checked rather than assumed. The retirement reason lives in the
migration comment because this table has no reason columns on this branch.

**Vendor catalog (`vendor_billing_catalog`)**

- `enterprise_vendor_monthly` ₱8,000 → **₱10,000**
- `solo_vendor_annual` ₱10,000 → **₱10,400**
- `pro_vendor_annual` ₱25,000 → **₱26,000**
- `enterprise_vendor_annual` ₱80,000 → **₱104,000**
- `vendor_additional_branch` ₱999 → **₱1,000**
- `vendor_3d_booth` ₱1,500 → **₱2,500**

🔢 Every annual figure he gave is exactly `four_week_price × 10.4` (thirteen
28-day periods, 20% off). Verified on each. **Recorded as an observation in the
migration comment, never encoded** — a stored second copy of a pricing rule is
how prices drift, and he must stay free to break it on any single row.

**Vendor Custom tier — ruled RETIRED, then REVERSED the same day. It stays ON SALE.**

Base repriced instead: `vendor_custom_base` ₱8,999 → **₱11,000**. The five add-on
axes are unchanged (₱99 · ₱499 ×3 · ₱2,499).

🔓 **The retirement was reversed because of what building it surfaced, and that
is the durable lesson: AN `is_active` FLIP IS NOT A RETIREMENT WHEN A CODE-SIDE
FALLBACK EXISTS.** `lib/vendor-custom-catalog.ts` reads those rows with
`.eq('is_active', true)` and then substitutes a **hardcoded literal** for any row
that comes back missing — its own docblock already said so in terms: deactivating
a row *"is not a retirement"*, the axis *"keeps quoting, at the same price, with
the catalog saying it is off."* The flag would have produced a HALF state:
`/vendors` and the homepage stop showing Custom (they filter `is_active`, and
`customFrom` has no peso fallback), while the configurator — still linked from
`/vendor-dashboard/subscription` — keeps quoting and keeps **selling** it. Owner,
shown that: a supplier must see exactly what they can buy. **The migration was
edited rather than given a second statement putting the rows back** — a
retire-then-restore pair would read in the audit trail as two rulings when there
was one. **Before retiring any catalogue row, grep for a reader that supplies a
literal when the row goes missing.**

🚨 **And the Enterprise raise in this same migration inverted the ladder.** At
Enterprise ₱10,000, the Custom base at ₱8,999 made the tier documented everywhere
as "the unlimited tier ABOVE Enterprise" cost **₱1,001 less** than the tier below
it. Caught before anyone could act on it — **0 vendors on either tier**; both
production vendor profiles are `solo`.

⚠ **It had been predicted in writing and the prediction changed nothing.**
`Vendor_Subscription_Ladder_2026-07-22.md:27` carried the warning for five weeks,
unactioned and by now doubly stale. **A note in a document cannot fail a build.**

✅ **So the rule is now a guard, per the owner's own instruction ("tie it to
Enterprise so it can never invert again"):**
`apps/web/tests/db/custom-sits-above-enterprise.db.test.ts` reads **both** prices
out of the catalogue — neither is typed into it, and a third test fails the build
if a peso literal is ever hardcoded into the guard — and fails if Custom's base
falls to or below Enterprise's 28-day price. It pins the **relationship, never
the amounts**, so any future reprice passes as long as the ladder stays the right
way up. Mutation-checked: base 11,000 → 9,500 with the in-migration inversion
check neutralised, counts printed 2→0 and 0→2, guard **RED at exit 1**; restored
from an explicit file backup.

✅ **The base is genuinely the only floor** — checked in the quote math, not
assumed: `computeCustomQuote` floors at base and the per-org admin **discount is
floored at base too**, so no composition and no discount can undercut Enterprise.
The only thing outside that is a hand-written org-scoped catalogue row (§11
"Stage 1 — manual"), a negotiated deal rather than a product path.

🔴 **An open ₱500 question sits on the ₱11,000, surfaced rather than corrected.**
It follows the ₱1,000-above shape of the old warning, but the **signed** rate card
states a different construction — *"owner-decided 2026-07-04: lean base =
Enterprise ₱7,499 + ₱1,500 white-glove premium"* (`VENDOR_TIERS_AND_BENEFITS.md`
§11), literally how the live ₱8,999 was derived — which gives **₱11,500**. That
same comparison shows the 07-22 note was already off its own precedent
(₱8,000 + ₱1,500 = ₱9,500, not ₱9,000). ₱11,000 stands because it is what the
owner ruled; the number is his to set.

🔒 `vendor_tier_rank()` and the `vendor_tier_state` enum were never touched.

**The back door under the ladder — closed the same day**

Raising the catalogue base to ₱11,000 was not enough on its own.
`CUSTOM_UNIT_PRICE_FALLBACK` in `lib/vendor-custom-catalog.ts` hardcoded
`base: 8999`, and `fetchCustomUnitPrices` substitutes that literal for any axis
whose row is inactive or unreadable — so one failed read would have quoted
₱8,999 against Enterprise at ₱10,000 and **restored the inversion through a
door no catalogue-only check can see.**

Proved rather than argued: with the fallback reverted to 8999, the catalogue
assertion stayed **green** while the two new ones went red. Fixed (`base` →
11000, `branch` 999 → 1000) and the guard extended to assert the fallback base
is above Enterprise **and** that every fallback axis agrees with the live
catalogue — axes enumerated from `CUSTOM_SKU_CODES`, never hand-listed.
🔑 **A second copy of a price is a second place for it to be wrong; if you
cannot delete the copy, make a test compare it.**

**Two more back doors under prices this migration changes — closed**

`BRANCH_FEE_PHP` 999 → **1000** (`vendor-branches.ts`) and
`VENDOR_3D_BOOTH_FALLBACK_PHP` 1500 → **2500** (`vendor-3d-booth-pricing.ts`).
Both shadow rows this very migration reprices, so leaving them meant two of
today's owner-set prices silently reverting whenever the catalogue read fails.
Identical shape to the Custom base.

⚠ **Which 3D Booth price applies is a flag.** With
`NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING` **OFF** (its default) checkout uses the
flat catalogue price, so **₱2,500** is what a vendor pays and the fallback now
matches it. **ON**, `vendor-addon-tier-pricing.ts` wins with the 2026-07-25
matrix (`ads_3d_plan`: ₱2,000 entry / ₱1,500 growth) and the owner's ₱2,500 is
ignored entirely. That matrix is **not** changed here — he priced the catalogue
row, not the matrix — but the two disagree and must be reconciled before that
flag is switched on.

**The guard was generalised rather than repeated**

New `apps/web/tests/db/fallback-prices-match-the-catalog.db.test.ts` asserts
that **no hardcoded fallback disagrees with its catalogue row** — pairs scanned
out of `lib/` (one `*_FALLBACK_PHP`/`*_FEE_PHP` + one `*_SKU_CODE`/`*_SKU` per
file), never hand-listed, so it catches the next one. A file it cannot pair is
a **failure, not a skip**: it must be named in `UNPAIRED` with a reason, and a
stale exemption fails too. Two anti-vacuity floors guard against the scan or
the lookups silently matching nothing. The Custom axis-by-axis comparison moved
here from the ladder guard, which now holds only the ladder rule.

**Three product names were promising a discount we no longer give**

Annual moved from 28-day × 10 (~23% off, "12 weeks free") to × 10.4 — exactly
20%. The row titles stated the OLD figure as a customer-facing promise, so all
three now read **save 20%**: a percentage rather than "10.4 weeks", because it
is exact on all three (13,000 vs 10,400 · 32,500 vs 26,000 · 130,000 vs
104,000) and needs no "~". The same claim was hardcoded in two rendered places
— the annual badge on the subscription cards and the cycle-toggle hint — and
both moved with it. The per-tier peso saving beside them is computed and
re-derives on its own, though its DB-unreadable fallbacks were stale and were
re-derived too.

⚠ **Custom's annual is still × 10 (~23%)** — the owner did not rule on it, so
the three tiers and Custom now discount annual differently. Flagged, not
changed.

**Deliberately NOT done**

- The four **annual add-on rows** the sheet asks for (branch ₱10,400 · seat
  ₱2,600 · Vendor AI ₱15,600 · 3D Booth ₱26,000) were **not created.** The
  billing machinery cannot charge or honour an annual add-on: every add-on term
  is a hardcoded 28 (`BRANCH_PERIOD_DAYS`, `SEAT_PERIOD_DAYS`,
  `VENDOR_AI_ADDON_PERIOD_DAYS`, `VENDOR_3D_BOOTH_PERIOD_DAYS`), each price
  reader selects one literal `sku_code`, and the only function that turns
  `subscription_annual` into a 365-day term — `create_vendor_subscription` —
  maps sku→tier by `LIKE 'solo|pro|enterprise_vendor_%'` and raises
  `UNMAPPED_SKU_TIER` for anything else. A priced row nothing can fulfil is the
  "takes the money and grants nothing" shape this repo keeps paying for.
- `vendor_photo_challenge` — the sheet prices it ₱2,500/4wk + ₱26,000/yr, which
  is a change of **selling model** (per-event → recurring), not a price.
- `vendor_branch_28day` stays at ₱999 while its twin `vendor_additional_branch`
  moves to ₱1,000. That inconsistency is deliberate, and it is now a *visible*
  one: the twin is what the **public pages quote** and the other is what
  **actually charges**.

SPEC IMPACT: `Vendor_Subscription_Ladder_2026-07-22.md` (stale warning replaced by the rule + the guard now holding it) · `Pricing.md` § 00 and `DECISION_LOG.md` (2026-08-27 row) updated
directly in the corpus at `~/Documents/Claude/Projects/Setnayan/`, together with
`Vendor_Monetization_Model_LOCKED_2026-07-25.md` and
`apps/web/VENDOR_TIERS_AND_BENEFITS.md`, which carry the vendor reprice and the
record that Custom was ruled retired and reversed the same day. Both continue to
describe Custom as a LIVE tier above Enterprise, because it is one.
