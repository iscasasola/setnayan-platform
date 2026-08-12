-- live_photo_wall_is_free
--
-- Owner decision 2026-08-11, verbatim: "live photo wall FREE."
--
-- The Live Photo Wall was ₱2,500 and had never been bought by anyone. It is now
-- free for every event — BOTH halves of it: the venue projection AND the mirror
-- that runs on every guest's own phone during the celebration.
--
-- ⚠⚠ THIS UPDATE ALONE WOULD MAKE THE FEATURE UNAVAILABLE, NOT FREE — and that
-- is the whole reason the code half of this change exists. Every gate on the wall
-- asks `eventOwnsSku`/`eventSkuActive` for 'LIVE_WALL'. Deactivate the row on its
-- own and nobody can buy it ⇒ nobody owns it ⇒ the wall goes DARK for everyone,
-- the exact opposite of the instruction. **Free and retired are identical in this
-- table and opposite in the product.**
-- The switch that actually makes it free is `FREE_FOR_ALL_SKUS` in
-- apps/web/lib/entitlements.ts, which short-circuits all three ownership
-- predicates. This row is deactivated only so nothing QUOTES a price for it.
-- Ship the two together or not at all.
--
-- ⚠ ALSO SHIPPED IN THE SAME PR, and mandatory: lib/llms-txt.ts drops LIVE_WALL
-- from REQUIRED_RETAIL and rewrites its prose line to "free". Retiring a row that
-- file still advertises throws and drops the whole AI/GEO document to its 603-byte
-- stub — that happened in production hours earlier with PAPIC_ADDON_STORIES
-- (PR #4357). The hand-written test fixture is updated in the same PR too, because
-- it is a second hand-typed copy of this catalog and CI reads it, not the database.
--
-- ⚠ DO NOT READ A PREFIX AS A GATE. The prefix sorts after the current head for
-- the PGlite replay's filename ordering and the UNIQUE rule — NOT because a lower
-- one "would be skipped". Both deploy workflows run `supabase db push
-- --include-all --yes`, which exists precisely to apply out-of-order migrations.
--
-- Idempotent: guarded by `IS DISTINCT FROM false`, so a re-apply is a no-op.
-- Reversible: flip is_active back to true and drop LIVE_WALL from
-- FREE_FOR_ALL_SKUS to restore a paid wall. The retail_price_php is deliberately
-- left at 2500.00 rather than zeroed, so the historical figure survives if the
-- owner ever reverses this.
UPDATE public.platform_retail_catalog_v2
   SET is_active  = false,
       updated_at = now()
 WHERE service_code = 'LIVE_WALL'
   AND is_active IS DISTINCT FROM false;
