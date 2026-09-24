-- event_hub_pro_settles_at_2000
-- Created via `pnpm migration:new`. Data-only and idempotent.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- Owner ruling, 2026-09-23, verbatim: "okay price it at 2000".
--
-- Event Hub Pro (COUPLE_WEBSITE_PRO) was repriced ₱3,500 → ₱2,000 by editing the
-- production row directly on that instruction. Production has read 2000.00 since.
-- The MIGRATIONS still settled the row at 3500
-- (`20270915796315_pricing_bundle_restructure.sql`, reasserted by
-- `20271171000513_the_owner_price_sheet_2026_08_27.sql`), so a fresh database and
-- the PGlite replay (`apps/web/tests/db/replay-migrations.ts`) came up at ₱3,500
-- while customers were charged ₱2,000 — ledger drift, not a user-facing fault
-- (every surface reads `platform_retail_catalog_v2` at render).
--
-- 🔑 IN PRODUCTION THIS IS A NO-OP: the row is already 2000, so the UPDATE's
-- `IS DISTINCT FROM` matches zero rows. It exists so that the replay and any fresh
-- environment agree with production. The earlier migrations' own settle-checks
-- (which assert 3500) still pass, because they run BEFORE this one in both orders
-- that matter — prod's ledger and the replay's filename order.
--
-- ⛔ Price is admin-managed after this. Do not re-derive it from here.

UPDATE public.platform_retail_catalog_v2
SET    retail_price_php = 2000, updated_at = now()
WHERE  service_code = 'COUPLE_WEBSITE_PRO'
  AND  retail_price_php IS DISTINCT FROM 2000;

DO $$
DECLARE
  r RECORD;
BEGIN
  SELECT retail_price_php, is_active INTO r
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'COUPLE_WEBSITE_PRO';
  IF NOT FOUND THEN RAISE EXCEPTION 'COUPLE_WEBSITE_PRO missing'; END IF;
  IF r.retail_price_php <> 2000.00 OR NOT r.is_active THEN
    RAISE EXCEPTION 'COUPLE_WEBSITE_PRO did not settle (price %, active %)', r.retail_price_php, r.is_active;
  END IF;
END
$$;
