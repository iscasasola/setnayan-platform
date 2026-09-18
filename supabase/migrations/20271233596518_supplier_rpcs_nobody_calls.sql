-- supplier_rpcs_nobody_calls
-- ============================================================================
-- SIX SUPPLIER-SIDE FUNCTIONS THAT NOTHING CALLS ARE DROPPED (S39, 2026-09-18).
--
-- Source: S26's orphan sweep (`rpc-no-caller`, supplier tier). Each one was
-- re-measured against origin/main (no app literal; no SQL body, policy,
-- trigger, view or default names it — confirmed again against production's
-- pg_proc.prosrc before writing this), and the reason it has no caller was
-- traced. Every one is (b) "delete the end nobody needs"; none is a promise a
-- supplier is still owed.
--
--   consume_vendor_assets(uuid, int)
--     The vendor token burn. Tokens were retired 2026-07-21/22 (owner) and the
--     last caller — accepting a manpower gig — was made free and dropped the
--     call. The per-voucher variant and the wallet tables are S35's to retire.
--
--   grant_verified_vendor_bonus() · grant_verified_vendor_bonus_on_insert()
--     "Is the verified-supplier bonus ever granted?" NO, and deliberately: the
--     100-tokens-on-verification grant was retired by owner directive
--     2026-06-17. Migration 20270110320020 dropped both triggers and left these
--     two as RETURN NEW stubs "to avoid broken references". Nothing references
--     them — no trigger is bound, and no copy promises the bonus (the only app
--     mention is a comment in admin/vendors/actions.ts recording that it was
--     retired). A stub kept for a reference that does not exist is just a
--     second place for the retired rule to look alive.
--
--   handle_vendor_lead_report(uuid, uuid, uuid, text, int)
--     "Can a supplier report a bad lead?" YES — `reportUser` in lib/chat-actions
--     writes user_reports and the report is reviewed at /admin/user-reports.
--     This function was only the TOKEN REFUND bolted onto that report (release a
--     held lead token on a no-reply lead). Its caller, runVendorLeadReportBackstop,
--     was removed with the lead-token-hold retirement (43996627c). Answering an
--     inquiry is free now, so there is nothing to refund. The report path stays.
--
--   rival_signals_for_vendor(uuid)
--     The "rival in your area" feed of the Shortlist Radar card. The card was
--     deleted in the page-layer hygiene sweep (8bdf1f63d); the de-identified
--     demand feed a supplier sees today is demand_radar_for_vendor
--     (lib/demand-radar.ts). Its sibling count_saves_for_vendor is LIVE (shop
--     page + public profile) and is NOT touched.
--
--   vendors_worked_together(uuid, uuid)
--     A pairwise yes/no from the partnerships mutual-accept work. The
--     partnerships page reads the set-valued vendor_worked_with_ids(uuid)
--     instead, which answers the same question for every pair at once. That
--     one is LIVE and is NOT touched.
--
-- Idempotent: DROP FUNCTION IF EXISTS with the exact signatures.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.consume_vendor_assets(uuid, integer);
DROP FUNCTION IF EXISTS public.grant_verified_vendor_bonus();
DROP FUNCTION IF EXISTS public.grant_verified_vendor_bonus_on_insert();
DROP FUNCTION IF EXISTS public.handle_vendor_lead_report(uuid, uuid, uuid, text, integer);
DROP FUNCTION IF EXISTS public.rival_signals_for_vendor(uuid);
DROP FUNCTION IF EXISTS public.vendors_worked_together(uuid, uuid);

-- Post-condition: all six are gone; the two live siblings named above remain.
DO $$
DECLARE
  v_left int;
  v_kept int;
BEGIN
  SELECT count(*) INTO v_left
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname IN ('consume_vendor_assets', 'grant_verified_vendor_bonus',
                       'grant_verified_vendor_bonus_on_insert', 'handle_vendor_lead_report',
                       'rival_signals_for_vendor', 'vendors_worked_together');
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'supplier_rpcs_nobody_calls: % of the six functions survived', v_left;
  END IF;

  SELECT count(*) INTO v_kept
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname IN ('count_saves_for_vendor', 'vendor_worked_with_ids');
  IF v_kept <> 2 THEN
    RAISE EXCEPTION 'supplier_rpcs_nobody_calls: a LIVE sibling is missing (found % of 2)', v_kept;
  END IF;
END
$$;

COMMIT;
