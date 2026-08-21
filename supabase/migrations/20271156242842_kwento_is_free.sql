-- kwento_is_free
--
-- Owner decision 2026-08-21, verbatim: **"kwento is free."**
--
-- Kwento — the words a guest writes on a photo they were tagged in — was
-- ₱299 and had NEVER been bought by anyone (0 orders, ever). It is now free
-- for every event.
--
-- ⚠⚠ THIS UPDATE ALONE WOULD MAKE THE FEATURE UNAVAILABLE, NOT FREE — and that
-- is the whole reason the code half of this change exists. Every gate on Kwento
-- asks `eventOwnsSku`/`eventSkuActive` for 'KWENTO': the write route
-- (app/api/papic/kwento/route.ts), the guest capture prompt, and the couple's
-- moderation queue. Deactivate the row on its own and nobody can buy it ⇒
-- nobody owns it ⇒ **the feature goes DARK for everyone**, the exact opposite
-- of the instruction. Free and retired are IDENTICAL in this table and
-- OPPOSITE in the product.
-- The switch that actually makes it free is `FREE_FOR_ALL_SKUS` in
-- apps/web/lib/entitlements.ts, which short-circuits all three ownership
-- predicates. This row is deactivated only so nothing QUOTES a price for it.
-- Ship the two together or not at all.
--
-- This is the LIVE_WALL change of 2026-08-11 (migration 20271136665973) applied
-- to a second SKU, deliberately step for step.
--
-- ⚠ ALSO SHIPPED IN THE SAME PR, and mandatory: lib/llms-txt.ts drops KWENTO
-- from REQUIRED_RETAIL **and** rewrites its prose line to "free". Retiring a row
-- that file still advertises throws and drops the whole AI/GEO document to its
-- 603-byte stub — that happened in production with PAPIC_ADDON_STORIES
-- (PR #4357). The hand-written test fixture is updated in the same PR too,
-- because it is a second hand-typed copy of this catalog and CI reads it, not
-- the database.
--
-- ⚠ DO NOT READ A PREFIX AS A GATE. The prefix sorts after the current head for
-- the PGlite replay's filename ordering and the UNIQUE rule — NOT because a
-- lower one "would be skipped". Both deploy workflows run `supabase db push
-- --include-all --yes`, which exists precisely to apply out-of-order migrations.
--
-- Idempotent: guarded by `IS DISTINCT FROM false`, so a re-apply is a no-op.
-- Reversible: flip is_active back to true and drop KWENTO from
-- FREE_FOR_ALL_SKUS to restore a paid Kwento. `retail_price_php` is
-- deliberately left at 299.00 rather than zeroed, so the historical figure
-- survives if the owner ever reverses this.
UPDATE public.platform_retail_catalog_v2
   SET is_active  = false,
       updated_at = now()
 WHERE service_code = 'KWENTO'
   AND is_active IS DISTINCT FROM false;
