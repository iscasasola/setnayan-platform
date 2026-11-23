-- supplier_sizes_fixed_2026_11_23
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================
-- 💾 SUPPLIER SIZES FIXED — owner 2026-11-23 (specs DECISION_LOG 2026-11-23 "SUPPLIER SIZES FIXED"). The final cut, after
-- "Let's fix this" the same day: Free 50 MB ("free should only be 50 clients compressed photos" · "it is only for them to
-- experience it") · Verified 1 GB · Plus 50 GB · Pro 256 GB ("Pro is 256Gb") · Ultra 1 TB ("Ultra is 1TB"); confirmed by
-- the owner in the builder session. The chat & documents room is dropped ("Yes, drop it"): one storage number per plan.
--
--   plan (code)          was       now
--   Free     (free)       256 MB    50 MB
--   Verified (verified)   2 GB      1 GB
--   Plus     (solo)       128 GB    50 GB
--   Pro      (pro)        500 GB    256 GB
--   Ultra    (enterprise) 1 TB      1 TB
--
-- ONE change: the 'storage_mb' numbers in `vendor_tier_limit()`. The body is the CURRENT definition, copied from
-- 20271360033501_supplier_final_ladder_2026_11_22.sql (the latest CREATE OR REPLACE of it), with only those five
-- numbers and the comment moved. It is the SQL twin of `TIER_CAPS[t].storageBytes` (apps/web/lib/vendor-tier-caps.ts),
-- which moves in the same PR; `supplier-storage-allowance.db.test.ts` holds the two in step.
--
-- `enforce_supplier_storage_allowance` reads this key, so it refuses past the new sizes with no change of its own.
-- Prod has no stored `vendor_plan_contents` row for a storage key (SELECT, 23 Nov), so the code values are the answer.
-- GRANDFATHERED: nothing already stored is touched; only the next new file past the allowance is refused.
-- No price, no table, no RLS change, no write to any shop's data.
-- 🛑 NEVER APPLIED BY HAND. The pipeline (`supabase db push --include-all`) applies it.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.vendor_tier_limit(p_tier text, p_key text)
RETURNS int
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH t AS (
    SELECT CASE WHEN COALESCE(p_tier, 'free') IN ('free', 'verified', 'solo', 'pro', 'enterprise')
                THEN COALESCE(p_tier, 'free') ELSE 'free' END AS plan
  ),
  stored AS (
    SELECT c.value
      FROM public.vendor_plan_contents c, t
     WHERE c.plan = t.plan
       AND c.key = p_key
  ),
  code AS (
    SELECT CASE p_key
      WHEN 'whitelist_per_date' THEN
        CASE t.plan
          WHEN 'free'       THEN 5              -- owner 2026-10-23: the same on every plan
          WHEN 'verified'   THEN 5
          WHEN 'solo'       THEN 5
          WHEN 'pro'        THEN 5
          WHEN 'enterprise' THEN 5
          ELSE 5                                -- unknown tier reads as free (asVendorTier)
        END
      WHEN 'waitlist_acceptances' THEN 10       -- owner 2026-11-18 (ruling 32): no plan limit — the column's own ceiling
      WHEN 'branches_included' THEN
        CASE t.plan
          WHEN 'pro'        THEN NULL           -- owner 2026-11-22: no limit (one registered business)
          WHEN 'enterprise' THEN NULL
          ELSE 0                                -- Free · Verified · Plus (and an unknown tier, read as Free)
        END
      WHEN 'storage_mb' THEN                    -- whole MB (decimal, as the supplier reads it); replaces 'storage_gb'
        CASE t.plan
          WHEN 'free'       THEN 50             -- owner 2026-11-23 "free should only be 50 clients compressed photos" (was 256)
          WHEN 'verified'   THEN 1000           -- owner 2026-11-23 Verified 1 GB (was 2,000)
          WHEN 'solo'       THEN 50000          -- owner 2026-11-23 Plus 50 GB (was 128,000)
          WHEN 'pro'        THEN 256000         -- owner 2026-11-23 "Pro is 256Gb" (was 500,000)
          WHEN 'enterprise' THEN 1000000        -- owner 2026-11-23 "Ultra is 1TB" (unchanged)
        END
      ELSE NULL                                 -- unknown key: NULL, never a silent 0
    END AS value
    FROM t
  )
  SELECT CASE
    WHEN p_key = 'branches_included' AND EXISTS (SELECT 1 FROM stored) THEN (SELECT value FROM stored)
    ELSE COALESCE((SELECT value FROM stored), (SELECT value FROM code))
  END;
$$;

COMMENT ON FUNCTION public.vendor_tier_limit(text, text) IS
  'Per-plan limits. Reads public.vendor_plan_contents first (admin-editable since 2026-11-13, two-admin approval), falling back to the code values when no row exists. Keys: whitelist_per_date · waitlist_acceptances · branches_included · storage_mb (the table also holds service_cards_total · parent_categories · agent_accounts, which the app reads). branches_included: NULL = no limit (Pro and Ultra since 2026-11-22), and a stored NULL row is honoured. storage_mb (whole MB, decimal): 50 · 1000 · 50000 · 256000 · 1000000 (owner 2026-11-23 "SUPPLIER SIZES FIXED": Free 50 MB · Verified 1 GB · Plus 50 GB · Pro 256 GB · Ultra 1 TB; no chat & documents room). An unknown TIER reads as Free; an unknown KEY returns NULL on purpose. Fallback mirrors TIER_CAPS in apps/web/lib/vendor-tier-caps.ts.';

COMMIT;
