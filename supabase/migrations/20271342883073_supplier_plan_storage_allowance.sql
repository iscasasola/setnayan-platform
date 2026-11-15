-- ============================================================================
-- 20271342883073_supplier_plan_storage_allowance.sql
--
-- 💾 THE PLAN HOLDS STORAGE — owner 2026-11-13 (specs DECISION_LOG, commit ce2d0a8 "plan storage"):
--   Solo 5 GB · Pro 10 GB · Ultra 15 GB, included in the plan.
-- Free and Free · Verified: NO allowance was ruled for them, and they keep exactly what they have today — no limit.
-- (The paid packs `vendor_storage_5/10/15gb` in vendor_billing_catalog stay inactive; nothing here touches them.)
--
-- What "storage" is: a shop's stored copies (`supplier_media`, one row per file per shop, keyed by content hash —
-- migration 20271339773560) that are still FILED somewhere (an `event_supplier_files` row points at them). A copy no
-- file points at any more is not counted: "Remove files" (the limits sheet's fix, `FIX_HREF.storage`) takes a file off
-- its events and leaves the stored copy in place, so counting every copy ever stored would leave a shop no way to make
-- room. Nothing is ever deleted by this migration or by the allowance.
--
-- Three pieces:
--   1 · `vendor_tier_limit` gains 'storage_gb' — 5 · 10 · 15 for Solo · Pro · Ultra; Free and Verified NULL = no
--       allowance (the same NULL every caller already reads as "no cap"). Copied VERBATIM from its latest definition
--       (20271316466285_ultra_addons_and_bookings_per_date.sql) plus the one new arm. GB here are 1,000,000,000 bytes —
--       the same GB the supplier reads (`storageWords` in lib/downgrade-limits.ts) — so "5 GB" is exactly 5e9 bytes.
--       Mirrors TIER_CAPS.*.storageBytes in apps/web/lib/vendor-tier-caps.ts; held in step by
--       tests/db/supplier-storage-allowance.db.test.ts, which derives from the TS side.
--   2 · `vendor_storage_used_bytes(shop)` — THE usage read, one number, never a truncated page summed in the app.
--       Service role only (the app resolves the shop from the session first, then asks).
--   3 · `enforce_supplier_storage_allowance` — BEFORE INSERT / UPDATE OF media_id on event_supplier_files. Filing NEW
--       bytes (a copy no other file of this shop already points at) past the plan's allowance is refused with
--       'storage_allowance'. GRANDFATHERED by construction: a shop already over keeps every file; a link to a copy that
--       is already counted adds nothing and is never refused; only the next new bytes are refused. `/api/upload`
--       refuses earlier, before any bytes move — this is the backstop for every other path (a re-link of a copy whose
--       last file was removed, a chat photo filed under a service, a direct table write).
--
-- Idempotent: CREATE OR REPLACE + DROP TRIGGER IF EXISTS. No table, column or RLS change.
-- ============================================================================

BEGIN;

-- ── 1 · the SQL twin of TIER_CAPS gains storage ─────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_tier_limit(p_tier text, p_key text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE p_key
    WHEN 'whitelist_per_date' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 5   -- owner 2026-10-23: the same on every plan (was 1)
        WHEN 'verified'   THEN 5   -- (was 2)
        WHEN 'solo'       THEN 5   -- (was 3)
        WHEN 'pro'        THEN 5
        WHEN 'enterprise' THEN 5   -- (was 10)
        ELSE 5                     -- unknown tier reads as free (asVendorTier)
      END
    WHEN 'waitlist_acceptances' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 0
        WHEN 'verified'   THEN 0   -- owner 2026-11-04 "waitlist 0,0,1,5" (was 1)
        WHEN 'solo'       THEN 0   -- (was 1)
        WHEN 'pro'        THEN 1   -- (was 3)
        WHEN 'enterprise' THEN 3   -- Ultra trimmed 2026-11-04 (was 5)
        ELSE 0
      END
    WHEN 'branches_included' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 0   -- owner 2026-11-04 "branches 0,0,3,10"
        WHEN 'verified'   THEN 0
        WHEN 'solo'       THEN 0
        WHEN 'pro'        THEN 3
        WHEN 'enterprise' THEN 6   -- Ultra trimmed 2026-11-04 ("branches 0,0,3,10" said 10)
        ELSE 0
      END
    WHEN 'bookings_per_date_per_service' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 1    -- owner click 2026-11-06 "FREE AND VERIFIED": "1 each, like Solo"
        WHEN 'verified'   THEN 1    -- same ruling
        WHEN 'solo'       THEN 1    -- owner 2026-11-06: "Solo has 1 per date/service"
        WHEN 'pro'        THEN 3    -- "pro has 3 per date/service"
        WHEN 'enterprise' THEN 5    -- "ultra has 5 per date/service"
        ELSE 1                      -- unknown tier reads as Free (asVendorTier)
      END
    WHEN 'storage_gb' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'solo'       THEN 5    -- owner 2026-11-13 "plan storage": Solo 5 GB
        WHEN 'pro'        THEN 10   -- Pro 10 GB
        WHEN 'enterprise' THEN 15   -- Ultra 15 GB
        ELSE NULL                   -- Free · Verified (and an unknown tier, read as Free): no allowance ruled — no cap
      END
    ELSE NULL                      -- unknown key: NULL, never a silent 0
  END;
$$;

COMMENT ON FUNCTION public.vendor_tier_limit(text, text) IS
  'Owner-set per-tier limits. Keys: whitelist_per_date (5 on EVERY plan since 2026-10-23) · waitlist_acceptances (0/0/0/1/3 since 2026-11-04) · branches_included (0/0/0/3/6 since 2026-11-04) · bookings_per_date_per_service (most bookings ONE service card takes on ONE date — 1/1/1/3/5 since 2026-11-06; Free/Verified 1 each, like Solo, owner click 2026-11-06) · storage_gb (stored files a shop keeps, in GB of 1e9 bytes — Solo 5 · Pro 10 · Ultra 15 since 2026-11-13; Free/Verified NULL = no allowance ruled, no cap). The retired Custom plan''s arms were removed 2026-11-06; an unknown TIER reads as Free. Mirrors TIER_CAPS in apps/web/lib/vendor-tier-caps.ts; held in step by tests/db/vendor-tier-pipeline-caps.db.test.ts, tests/db/vendor-plan-allowances.db.test.ts and tests/db/supplier-storage-allowance.db.test.ts, which derive from the TS side. An unknown KEY returns NULL on purpose so a typo cannot read as an unlimited/zero cap.';

-- ── 2 · the usage read ──────────────────────────────────────────────────────
-- Each stored copy once (DISTINCT media), however many files point at it. A copy with no recorded size counts 0 —
-- the app records the measured length from 2026-11-13 on.
CREATE OR REPLACE FUNCTION public.vendor_storage_used_bytes(p_vendor_profile_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(COALESCE(m.size_bytes, 0)), 0)::bigint
    FROM public.supplier_media m
   WHERE m.vendor_profile_id = p_vendor_profile_id
     AND EXISTS (
       SELECT 1 FROM public.event_supplier_files f
        WHERE f.media_id = m.media_id AND f.vendor_profile_id = p_vendor_profile_id
     );
$$;

REVOKE ALL ON FUNCTION public.vendor_storage_used_bytes(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_storage_used_bytes(uuid) TO service_role;

COMMENT ON FUNCTION public.vendor_storage_used_bytes(uuid) IS
  'What a shop stores against its plan''s storage allowance (owner 2026-11-13, Solo 5 GB · Pro 10 GB · Ultra 15 GB): the size of each stored copy (supplier_media) that at least one of the shop''s event_supplier_files still points at, each copy once. A copy no file points at is not counted (removing a file is how a shop makes room; nothing is deleted). Service role only — the app resolves the shop from the session first.';

-- ── 3 · the backstop: new bytes past the allowance are refused ─────────────
CREATE OR REPLACE FUNCTION public.enforce_supplier_storage_allowance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tier   text;
  v_gb     int;
  v_size   bigint;
  v_used   bigint;
BEGIN
  IF NEW.media_id IS NULL THEN
    RETURN NEW;                                   -- a link, a portfolio pointer or a chat document: no stored bytes
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.media_id IS NOT DISTINCT FROM OLD.media_id THEN
    RETURN NEW;
  END IF;

  SELECT vp.tier_state::text INTO v_tier
    FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = NEW.vendor_profile_id;
  v_gb := public.vendor_tier_limit(v_tier, 'storage_gb');
  IF v_gb IS NULL THEN
    RETURN NEW;                                   -- no allowance on this plan (Free · Verified)
  END IF;

  -- One shop's filings in a row, so two uploads racing for the last megabytes cannot both get in.
  PERFORM pg_advisory_xact_lock(hashtext('supplier_storage:' || NEW.vendor_profile_id::text));

  -- These bytes are already counted (another file of this shop points at the same copy): a link adds nothing.
  IF EXISTS (
    SELECT 1 FROM public.event_supplier_files f
     WHERE f.media_id = NEW.media_id
       AND f.vendor_profile_id = NEW.vendor_profile_id
       AND (TG_OP = 'INSERT' OR f.file_id <> NEW.file_id)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(m.size_bytes, 0) INTO v_size
    FROM public.supplier_media m
   WHERE m.media_id = NEW.media_id AND m.vendor_profile_id = NEW.vendor_profile_id;
  v_used := public.vendor_storage_used_bytes(NEW.vendor_profile_id);

  IF v_used + COALESCE(v_size, 0) > v_gb::bigint * 1000000000 THEN
    RAISE EXCEPTION 'storage_allowance: this file does not fit the % GB your plan holds', v_gb
      USING ERRCODE = 'P0001',
            HINT = 'Remove files from an event to make room, or move to a plan that holds more.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_supplier_storage_allowance() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_supplier_files_storage_allowance ON public.event_supplier_files;
CREATE TRIGGER event_supplier_files_storage_allowance
  BEFORE INSERT OR UPDATE OF media_id ON public.event_supplier_files
  FOR EACH ROW EXECUTE FUNCTION public.enforce_supplier_storage_allowance();

COMMIT;
