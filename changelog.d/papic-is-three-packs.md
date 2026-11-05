## 2026-11-03 · feat(papic): Papic is three packs (₱90 = 150 · ₱490 = 1,000 · ₱990 = 3,000) and no sign-up price on anything

Owner 2026-11-03 (DECISION_LOG "PAPIC IS THREE PACKS"): *"we want 3000 credits at 990"* · *"490 @ 1000 credits / 90 @ 150 credits"* · *"drop the 40% on all then"* · *"papic unlimited retire"*.

- Migration `*_papic_is_three_packs_and_no_signup_price.sql`: `PAPIC_GUEST_150` (new, ₱90) · `PAPIC_GUEST_1K` ₱490 · `PAPIC_GUEST` (3,000) ₱990. The other fourteen `PAPIC_GUEST*` rungs are deactivated and stamped `retired_at`, never deleted; balances are untouched. `platform_settings.onboarding_discount_pct` (and its two retired twins) → 0, column default → 0, every `onboarding_price_php` → NULL. Reads everything back and refuses to apply otherwise.
- Activation: `PAPIC_GUEST_150` is wired in `lib/sku-activation.ts`. **Fix:** activation now grants a paid order's credits even when its rung was retired after payment (`papicPointsBoughtBySku`). Before this, an order approved after its rung went off sale was marked paid and granted zero credits, with nothing logged.
- App Store: three new consumables `com.setnayan.app.papic_pack_150 / _1000 / _3000`. The five `papic_credits_*` products are retired (`RETIRED_IAP_PRODUCT_IDS`): never sold again, but an already-charged transaction for one still delivers (`iapProductForDelivery`).
- Sign-up price: `DEFAULT_ONBOARDING_DISCOUNT_PCT` 40 → 0; admin saves store NULL at 0% (`storedSignupPriceFor`); Setnayan AI set-up fallbacks equal the regular ones; the onboarding banner promising "at least 10% off" is removed.
- Supplier Exclusive gift: it now stops at the top pack on sale (3,000 credits, ₱990) and never goes above 50,000. Without this, the 50,000 rung leaving would have zeroed every gift. TypeScript (`giftCapRung`) and SQL (`setnayan_gift_for_fee`) change together.
- llms.txt, its fixture, the admin ladder seed, the IAP list and every guard now name the three packs.

SPEC IMPACT: DECISION_LOG 2026-11-03 rows already record the rulings. RELEASE_LIST_DARK_LAUNCHES row 12 "Papic Unlimited photos pass" → ⛔ retired (it was never built). The supplier gift's effective cap (3,000, not 50,000) needs owner sign-off.

**Also (2026-11-04):** the Event Hub Maker's first-load budget is raised from 507.5 to 508.5 KB (owner: *"yes, raise the Maker budget by 1 KB"*). The reason is CI noise, not new code. `main` measured 11 B under the old line, this PR measured 18 B smaller than `main`, and CI's builds drift by about 100 B between runs (`--frozen-lockfile=false`). SPEC IMPACT: DECISION_LOG row "MAKER FIRST-LOAD BUDGET RAISED TO 508.5 KB" (controller to add, as with the 507.5 raise).
