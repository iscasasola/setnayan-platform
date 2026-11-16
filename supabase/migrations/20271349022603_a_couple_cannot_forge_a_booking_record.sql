-- a_couple_cannot_forge_a_booking_record — HOLE 1 (controller sweep 2026-11-16), CLOSED.
--
-- `event_vendors_couple_write` is FOR ALL with no column list. The guards on the row protect the supplier's lock
-- ANSWER (`guard_event_vendor_lock_handshake`) and the COMPLETION columns — nothing protected WHO the booking is with,
-- HOW it came about, or a row born finished. Proven open by
-- `apps/web/tests/db/hole-1-a-couple-can-forge-a-booking-record.db.test.ts` (#7841): a couple's own session could
--   1a · INSERT a 'complete' booking with another shop (no supplier yes) → counted by
--        `vendor_public_completed_events_stats` and `shop_booked_loop_count`;
--   1b · UPDATE a plain typed row into another shop's 'delivered' booking (repoint);
--   1c · relabel a Setnayan-sourced booking as the supplier's own invite → `booking_fee_attribution_for` says 'import'.
--
-- ── WHAT THIS REFUSES, AND WHY NOT MORE ─────────────────────────────────────────────────────────────────────────
-- Only for an ordinary signed-in writer (current_user authenticated / anon). SECURITY DEFINER RPCs (vendor_claim_locked_qr,
-- vendor_agree_to_lock, the reuse/claim paths …) run as their owner and the admin client as service_role — exempt,
-- exactly as in guard_event_vendor_lock_handshake. Every refusal below was checked against every couple-session writer
-- in apps/web (2026-11-16 map):
--   · `source` — never set to a supplier-brought source (vendor_invite · vendor_locked_qr · reuse_accept: the ones
--     booking_fee_attribution_for reads as free); on UPDATE it may only be FILLED when empty (inquiry-actions fills a
--     NULL source from the thread), never rewritten.
--   · `marketplace_vendor_id` — set at INSERT (Find, packages, the wizard, inquiries); never changed afterwards.
--   · `linked_vendor_profile_id` — only NULL or the row's own marketplace_vendor_id (finalize / chat "book" stamp it,
--     revert clears it). A row cannot be linked to a shop it was not saved from.
--   · a row tied to a shop is never BORN 'delivered'/'complete', and a couple never writes 'complete' on one (only the
--     admin/RPC completion paths do). 'delivered' by UPDATE stays — acknowledgeHandover writes it.
-- 🔑 NOT refused: a couple moving their own shop row to 'contracted' without a supplier yes. With the lock handshake
-- flag off that IS the shipped booking path (finalizeVendor, lockPackage, the wizard, chat "book"); refusing it would
-- break booking. That is a product question, not this hole.
--
-- Adds only: one function, one trigger. No data is written. RLS is unchanged.

CREATE OR REPLACE FUNCTION public.guard_event_vendor_provenance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $guard$
DECLARE
  supplier_brought CONSTANT TEXT[] := ARRAY['vendor_invite', 'vendor_locked_qr', 'reuse_accept'];
  shop_row BOOLEAN := NEW.marketplace_vendor_id IS NOT NULL OR NEW.linked_vendor_profile_id IS NOT NULL;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.source = ANY (supplier_brought) THEN
      RAISE EXCEPTION 'a booking''s source ''%'' is set only by the supplier''s own flow', NEW.source
        USING ERRCODE = '42501';
    END IF;
    IF NEW.linked_vendor_profile_id IS NOT NULL
       AND NEW.linked_vendor_profile_id IS DISTINCT FROM NEW.marketplace_vendor_id THEN
      RAISE EXCEPTION 'a booking can only be linked to the shop it was saved from'
        USING ERRCODE = '42501';
    END IF;
    IF shop_row AND NEW.status IN ('delivered', 'complete') THEN
      RAISE EXCEPTION 'a booking with a shop cannot be created already %', NEW.status
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.source IS DISTINCT FROM OLD.source
     AND (OLD.source IS NOT NULL OR NEW.source = ANY (supplier_brought)) THEN
    RAISE EXCEPTION 'a booking''s source is kept as it was made'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.marketplace_vendor_id IS DISTINCT FROM OLD.marketplace_vendor_id THEN
    RAISE EXCEPTION 'a booking cannot be moved to another shop'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.linked_vendor_profile_id IS DISTINCT FROM OLD.linked_vendor_profile_id
     AND NEW.linked_vendor_profile_id IS NOT NULL
     AND NEW.linked_vendor_profile_id IS DISTINCT FROM NEW.marketplace_vendor_id THEN
    RAISE EXCEPTION 'a booking can only be linked to the shop it was saved from'
      USING ERRCODE = '42501';
  END IF;
  IF shop_row AND NEW.status = 'complete' AND OLD.status IS DISTINCT FROM 'complete' THEN
    RAISE EXCEPTION 'a booking with a shop is marked complete by the completion flow, not directly'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$guard$;

COMMENT ON FUNCTION public.guard_event_vendor_provenance() IS
  'BEFORE INSERT OR UPDATE guard on event_vendors (HOLE 1, 2026-11-16). For authenticated/anon writers only: source is never a supplier-brought value (vendor_invite, vendor_locked_qr, reuse_accept) and is only ever filled, never rewritten; marketplace_vendor_id never changes after insert; linked_vendor_profile_id is NULL or the row''s own marketplace_vendor_id; a shop row is never born delivered/complete and is never written complete directly. SECURITY DEFINER RPCs and service_role are exempt. Proven by hole-1-a-couple-cannot-forge-a-booking-record.db.test.ts.';

DROP TRIGGER IF EXISTS event_vendors_guard_provenance ON public.event_vendors;
CREATE TRIGGER event_vendors_guard_provenance
  BEFORE INSERT OR UPDATE ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_vendor_provenance();
