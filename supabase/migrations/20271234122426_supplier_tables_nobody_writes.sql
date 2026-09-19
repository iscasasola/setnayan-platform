-- supplier_tables_nobody_writes
-- ============================================================================
-- THREE SUPPLIER-SIDE TABLES THAT NOTHING WRITES ARE DROPPED (S39, 2026-09-18).
--
-- Source: S26's orphan sweep (`table-no-writer`, supplier tier). Each one
-- re-measured on origin/main (no .insert/.upsert/.update/.delete in the app, no
-- SQL body writes it) and against production before writing this:
--
--   table                    prod rows   other objects that depend on it
--   vendor_tool_bundles          0       view vendor_active_tools (read by nothing)
--   vendor_self_comp_caps        0       enforce_vendor_self_comp_quota() reads it
--   vendor_meetings              0       none (pg_depend + pg_proc.prosrc)
--
-- All three are (b) "delete the end nobody needs":
--
--   vendor_tool_bundles + vendor_active_tools
--     Purchases of the V1 vendor-tool SKUs (All Tools Unlock ₱9,999/yr and the
--     ₱99/wk single tools). Those SKUs were retired with the V1 catalogue
--     (20260702000000_v2_retire_v1_skus_and_setnayan_pay) and nothing sells,
--     grants or reads a tool entitlement. The view is dropped first; it was the
--     only reason anon still held SELECT on the table (a security_invoker view
--     reads with the caller's grants), and no page reads the view.
--
--   vendor_self_comp_caps
--     A per-store override of the 12-per-quarter self-comp ceiling. Nothing
--     ever wrote an override, its only app reader (fetchSelfCompQuota) had no
--     caller and is deleted with it, and no self-comp has ever been issued
--     (comp_grants WHERE source = 'vendor_self_comp' → 0 in prod). The quota
--     trigger stays and keeps the ceiling; it just stops looking up an
--     override table, and caps at the fixed 12 it already defaulted to.
--
--   vendor_meetings
--     Ad-hoc couple⋈vendor meetings (iteration 0006 "meetings module"). No
--     screen ever wrote one: the two-sided Appointments scheduler
--     (event_appointments) is how a time with a supplier is booked, and every
--     reader already merged appointments in beside it. The three readers (Home
--     "Upcoming", the Preparation agenda, the couple's supplier workspace) are
--     rewritten in the same change to read appointments alone — the workspace
--     had been telling every couple "No meetings scheduled yet" right above
--     their confirmed appointments.
--
-- ⛔ NOT dropped here, and why:
--   vendor_2307_filings — BIR 2307. Owner retired the subsystem 2026-07-25
--     ("we do not have tax-form — kill that") but deliberately kept this table
--     tombstone-style. Tax: reported to the owner, not deleted by a session.
--   vendor_bid_submissions — dropped by S37 (20271234083820).
--
-- Idempotent: IF EXISTS throughout; the function is CREATE OR REPLACE.
-- ============================================================================

BEGIN;

-- ── 1 · the V1 tool entitlement: view first, then its only base table ──────
DROP VIEW IF EXISTS public.vendor_active_tools;
DROP TABLE IF EXISTS public.vendor_tool_bundles;

-- ── 2 · the self-comp quota keeps its ceiling, loses the override lookup ───
-- Byte-identical to production's current body (the advisory-lock version from
-- 20270226568671) EXCEPT the vendor_self_comp_caps lookup: q_cap is the fixed
-- 12 it already defaulted to whenever no override row existed — i.e. always.
CREATE OR REPLACE FUNCTION public.enforce_vendor_self_comp_quota()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  q_count int;
  q_cap   int := 12;
begin
  if new.source <> 'vendor_self_comp' then return new; end if;
  if new.vendor_profile_id is null then
    raise exception 'vendor_self_comp requires vendor_profile_id' using errcode = 'check_violation';
  end if;

  -- serialize per (vendor, quarter) before the count-then-check
  perform pg_advisory_xact_lock(
    hashtextextended(new.vendor_profile_id::text || '|' || date_trunc('quarter', new.created_at)::text, 0)
  );

  select count(*) into q_count
    from public.comp_grants
   where source = 'vendor_self_comp'
     and vendor_profile_id = new.vendor_profile_id
     and date_trunc('quarter', created_at) = date_trunc('quarter', new.created_at)
     and revoked_at is null;

  if q_count >= q_cap then
    raise exception 'VENDOR_SELF_COMP_QUOTA_EXCEEDED: cap=% used=%', q_cap, q_count
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

DROP TABLE IF EXISTS public.vendor_self_comp_caps;

-- ── 3 · ad-hoc meetings, superseded by appointments ─────────────────────────
DROP TABLE IF EXISTS public.vendor_meetings;

-- ── post-condition ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_left int;
BEGIN
  SELECT count(*) INTO v_left
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
   WHERE c.relname IN ('vendor_tool_bundles', 'vendor_active_tools',
                       'vendor_self_comp_caps', 'vendor_meetings');
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'supplier_tables_nobody_writes: % of the four relations survived', v_left;
  END IF;
  IF (SELECT prosrc FROM pg_proc WHERE oid = 'public.enforce_vendor_self_comp_quota()'::regprocedure)
       ILIKE '%vendor_self_comp_caps%' THEN
    RAISE EXCEPTION 'supplier_tables_nobody_writes: the quota trigger still reads the dropped caps table';
  END IF;
END
$$;

COMMIT;
