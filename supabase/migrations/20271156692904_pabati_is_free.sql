-- pabati_is_free
--
-- Owner decision 2026-08-21: **"we already agreed all features of papic will be
-- free like kwento"**, then, asked to draw the line precisely: **Pabati free,
-- the Thank-You film stays paid.**
--
-- Pabati — the guest-recorded greeting video — was ₱1,299 per day and had NEVER
-- been bought by anyone (0 orders, ever). It is now free for every event.
--
-- 🔑 IT IS A PAPIC CHALLENGE, WHICH IS WHY IT COULD NOT STAY PRICED. Owner:
-- "pabati is part of papic challenge." The challenge library that shipped on
-- 2026-08-21 already carries a `greeting` category — "a message to camera for
-- the host" — and a `video_greeting` shape. Charging ₱1,299 for one challenge
-- while the library containing it is free is not a price, it is a contradiction.
--
-- ⚠⚠ THIS UPDATE ALONE WOULD MAKE THE FEATURE UNAVAILABLE, NOT FREE. Every gate
-- on Pabati asks `eventSkuActive('PABATI')` — the day-of card, the guest
-- recorder, the recap section. Deactivate the row on its own and nobody can buy
-- it ⇒ nobody owns it ⇒ **the feature goes DARK for everyone**, the exact
-- opposite of the instruction. Free and retired are IDENTICAL in this table and
-- OPPOSITE in the product. The switch that actually makes it free is
-- `FREE_FOR_ALL_SKUS` in apps/web/lib/entitlements.ts. Ship the two together or
-- not at all.
--
-- Third application of the LIVE_WALL shape (2026-08-11, migration
-- 20271136665973), after KWENTO earlier the same day (20271156242842).
--
-- ⚠ ALSO SHIPPED IN THE SAME PR, and mandatory: lib/llms-txt.ts drops PABATI
-- from REQUIRED_RETAIL **and** rewrites its prose line to "free". Retiring a row
-- that file still advertises throws and drops the whole AI/GEO document to its
-- 603-byte stub — that happened in production with PAPIC_ADDON_STORIES
-- (PR #4357). The hand-written test fixture is updated in the same PR too.
--
-- ⛔ WHAT IS DELIBERATELY NOT TOUCHED, and it is the whole business:
--    • the Papic SHOT LADDER (PAPIC_GUEST_100 · PAPIC_GUEST · PAPIC_GUEST_10K ·
--      PAPIC_GUEST_20K) stays exactly as owner-locked — 50 free, then ₱50 /
--      ₱1,000 / ₱3,000 / ₱5,000. Features are free; SHOTS are the product.
--    • PAPIC_ADDON_THANK_YOU (₱2,499) stays paid — owner's explicit ruling this
--      session, and consistent with the 2026-06-10 note that the PRODUCED VIDEO
--      is what gets monetised.
--
-- Idempotent: guarded by `IS DISTINCT FROM false`, so a re-apply is a no-op.
-- Reversible: flip is_active back to true and drop PABATI from
-- FREE_FOR_ALL_SKUS. `retail_price_php` is deliberately left at 1299.00 rather
-- than zeroed, so the historical figure survives a reversal.
UPDATE public.platform_retail_catalog_v2
   SET is_active  = false,
       updated_at = now()
 WHERE service_code = 'PABATI'
   AND is_active IS DISTINCT FROM false;
