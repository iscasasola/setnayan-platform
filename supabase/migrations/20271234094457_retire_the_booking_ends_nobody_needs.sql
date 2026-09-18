-- retire_the_booking_ends_nobody_needs
--
-- ─── WHAT THIS IS ──────────────────────────────────────────────────────────
-- S36 (2026-09-18) re-measured the booking-lifecycle orphans in S26's ranked
-- baseline (apps/web/tests/db/ugat-both-ends.baseline.txt — connections with
-- only ONE end: a table nothing writes, a function nothing calls). For every
-- object below the missing end was never going to be built, because an owner
-- ruling or a shipped replacement had already decided it. Retiring them is the
-- honest answer; leaving them makes the guard carry debt that is not debt.
--
-- ─── MEASURED IN PROD BEFORE WRITING (2026-09-18, project njrupjnvkjkitfctetvi)
--   vendor_contract_signatures        0 rows   (vendor_contracts: 0 rows too)
--   couple_waitlist_signups           0 rows
--   event_vendor_booth_placements     0 rows
--   inbound foreign keys onto any of the three tables: none
--     (git grep "REFERENCES public.<table>" -- supabase/migrations)
--   app callers of the six functions: none (S26 detector + git grep)
--
-- ─── 1 · vendor_contract_signatures (+ its seal trigger and function) ────────
-- Owner, 2026-05-18 (DECISION_LOG, tenth row of that day), verbatim: "we do not
-- need contract intelligence. their contract is not covered by our app. they
-- can just place it there for reference. but we will not make contracts for
-- them." Contracts are upload-only, and the supplier's Contracts page says so
-- ("Setnayan hosts the file but does not facilitate signatures"). The dual
-- e-sign table created the same morning never had a writer.
-- vendor_contracts and its status vocabulary ('sent_for_signature',
-- 'fully_signed') STAY: the app reads 'sent_for_signature' as "visible to the
-- couple", and renaming a CHECK vocabulary is a separate decision.
--
-- ─── 2 · couple_waitlist_signups ───────────────────────────────────────────
-- Setnayan went live for couples on 2026-07-24; /waitlist was reframed to
-- "we're live, start now" and its joinCoupleWaitlist action was deleted
-- (commit 3b647d484). Zero rows were ever captured. The erasure rule that
-- deleted waitlist rows by email leaves in the same PR — purge.ts records a
-- DELETE against a dropped table as an erasure FAILURE, not a throw.
--
-- ─── 3 · event_vendor_booth_placements ─────────────────────────────────────
-- The "Build #2 foundation" (2026-06-25) for vendor booths in the 3D room. The
-- booth that shipped (2026-09-05, ₱500 per event) places through
-- event_floor_booths (+ event_vendor_booth_posters); lib/seating-3d.ts joins
-- through event_floor_booths.event_vendor_id. Nothing ever read or wrote this
-- table. Two homes for one fact is exactly what RULE 0 §8 warns about.
--
-- ─── 4 · six functions with no caller ──────────────────────────────────────
--   get_pending_inquiry_basics(uuid)   The masked-lead read. The mask was
--       retired (commit e405a1e4f "the supplier sees who is asking"); the
--       Accept/Decline chips now read the same admin-scoped events row as the
--       header, so the name and the date cannot disagree.
--   unlock_vendor_event(uuid, uuid)    The tier-gated accept. Owner 2026-07-24:
--       "your inbox is never locked" — acceptInquiry routes EVERY vendor to
--       unlock_vendor_event_free (lib/chat-actions.ts). The gated original was
--       kept "byte-identical for the flag-off path"; there is no flag-off path.
--       unlock_vendor_event_free, unlock_vendor_event_hold and
--       claim_unlock_vendor_event STAY — each has a caller.
--   get_vendor_thread_summaries(uuid)  Built for the native inbox (Phase 2,
--       not started). The web inbox names its threads through
--       fetchInquiryCustomerFacts on the admin client (messages/surface.tsx).
--   list_vendor_delivery_bookings() · confirm_guest_delivery(uuid, text, text)
--   · undo_guest_delivery(uuid, text)  A per-guest delivery roster applied to
--       prod by hand and back-filled by 20271115531329 so the guards could see
--       it. No screen ever called any of the three; the anon-RPC baseline has
--       carried "ORPHANED — nothing in apps/web calls it; proposed for DROP"
--       against list_ since 2026-08-06. The prod-only TABLE
--       event_service_deliveries is NOT touched: no migration creates it, so a
--       DROP here would be a no-op in the replay and a hand-applied change in
--       prod. It stays a KNOWN_GAP in tests/db/schema-snapshot.ts.
--
-- Idempotent: every statement is IF EXISTS. The DO block at the end asserts
-- the objects are gone, so a partial apply cannot read as a full one.

BEGIN;

-- 1 · contracts are upload-only; the signature evidence table never had a writer.
--     DROP TABLE takes the seal trigger with it; the trigger function goes next.
DROP TABLE IF EXISTS public.vendor_contract_signatures;
DROP FUNCTION IF EXISTS public.vendor_contract_check_fully_signed();

-- 2 · the pre-launch waitlist; Setnayan has been live for couples since 2026-07-24.
DROP TABLE IF EXISTS public.couple_waitlist_signups;

-- 3 · the booth foundation that event_floor_booths replaced.
DROP TABLE IF EXISTS public.event_vendor_booth_placements;

-- 4 · the six functions with no caller.
DROP FUNCTION IF EXISTS public.get_pending_inquiry_basics(uuid);
DROP FUNCTION IF EXISTS public.unlock_vendor_event(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_vendor_thread_summaries(uuid);
DROP FUNCTION IF EXISTS public.list_vendor_delivery_bookings();
DROP FUNCTION IF EXISTS public.confirm_guest_delivery(uuid, text, text);
DROP FUNCTION IF EXISTS public.undo_guest_delivery(uuid, text);

-- ─── POST-CONDITIONS ───────────────────────────────────────────────────────
DO $$
DECLARE
  v_tables INT;
  v_funcs  INT;
  v_kept   INT;
BEGIN
  SELECT count(*) INTO v_tables
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
   WHERE c.relkind = 'r'
     AND c.relname IN ('vendor_contract_signatures', 'couple_waitlist_signups',
                       'event_vendor_booth_placements');
  IF v_tables <> 0 THEN
    RAISE EXCEPTION 'retire_the_booking_ends_nobody_needs: % retired table(s) still exist', v_tables;
  END IF;

  SELECT count(*) INTO v_funcs
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname IN ('vendor_contract_check_fully_signed', 'get_pending_inquiry_basics',
                       'unlock_vendor_event', 'get_vendor_thread_summaries',
                       'list_vendor_delivery_bookings', 'confirm_guest_delivery',
                       'undo_guest_delivery');
  IF v_funcs <> 0 THEN
    RAISE EXCEPTION 'retire_the_booking_ends_nobody_needs: % retired function(s) still exist', v_funcs;
  END IF;

  -- The live accept path and the shipped booth must be untouched by this file.
  SELECT count(*) INTO v_kept
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname IN ('unlock_vendor_event_free', 'unlock_vendor_event_hold',
                       'claim_unlock_vendor_event');
  IF v_kept < 3 THEN
    RAISE EXCEPTION 'retire_the_booking_ends_nobody_needs: a LIVE unlock function is missing (% of 3 found)', v_kept;
  END IF;
  IF to_regclass('public.event_floor_booths') IS NULL
     OR to_regclass('public.vendor_contracts') IS NULL THEN
    RAISE EXCEPTION 'retire_the_booking_ends_nobody_needs: a table this file must NOT touch is missing';
  END IF;
END $$;

COMMIT;
