-- a_suppliers_own_item_goes_in_at_once
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
--
-- ✏️ A SUPPLIER'S EDIT TO THEIR OWN ITEM GOES IN AT ONCE — THE DATABASE'S RECORD GUARD AGREES WITH THE SERVER.
--
-- Two shipped rules met on one row:
--   · #8080 (Unichat F, migration 20271356061492) made `schedule_request_auto_accept_guard` refuse an accept nobody
--     pressed (`auto_agreed = true`) unless the event's Auto-agree is ON or the request is the supplier's own backstage
--     moment inside the venue's window.
--   · #8094 (owner 2026-11-21, DECISION_LOG "'THEIR EVENT' DOOR SHAPE + SCHEDULE RULE": *"they cannot edit schedules not
--     attributed to their service"* — and the controller call: *"Their edit applies at once. The hosts get a notice and
--     can undo it."*) applies a supplier's change to a moment that is THEIRS at once, whatever the event's switch
--     (`editsOwnItem` · `requestEditsOwnItem`, apps/web/lib/schedule-suggestion-decide.server.ts).
-- With only #8080's guard, that own-item accept was refused by the database and the request silently waited for the
-- hosts. This migration adds the one case #8094 allows — and nothing wider (controller, 22 Nov 2026):
--
--   an `adjust` of an EXISTING moment (`block_id` set), asked by the shop (`to_host`), whose `responsible_vendor_ids`
--   hold one of THAT shop's own bookings on THAT event (`event_vendors.marketplace_vendor_id = vendor_profile_id`).
--
-- That is `editsOwnItem` exactly: the same columns, the same booking match (no status filter, as the server reads it).
-- A new moment, a delete, a host's ask, or another shop's moment still needs Auto-agree or a person.
-- Everything else in the function is #8080's body, unchanged. No table, column, policy or grant; the trigger is
-- unchanged (it already calls this function by name).
-- Held by apps/web/tests/db/a-suppliers-own-item-goes-in-at-once.db.test.ts.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.schedule_request_auto_accept_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auto   BOOLEAN;
  v_block  public.event_schedule_blocks%ROWTYPE;
  v_ok     BOOLEAN := FALSE;
BEGIN
  IF NOT (NEW.status = 'accepted' AND COALESCE(NEW.auto_agreed, FALSE) AND NOT COALESCE(OLD.auto_agreed, FALSE)) THEN
    RETURN NEW;
  END IF;
  SELECT supplier_requests_auto_agree INTO v_auto FROM public.events WHERE event_id = NEW.event_id;
  IF COALESCE(v_auto, FALSE) THEN
    RETURN NEW; -- the host's standing choice: every request goes in (ruled 1 Nov, starts OFF).
  END IF;
  IF COALESCE(NEW.direction, 'to_host') <> 'to_supplier' THEN
    IF NEW.kind = 'new' THEN
      v_ok := public.backstage_window_verdict(NEW.proposed_parent_block_id, NEW.proposed_start_at, NEW.proposed_end_at) = 'at_once';
    ELSIF NEW.kind = 'adjust' AND NEW.block_id IS NOT NULL THEN
      -- The server moves the moment before it marks the request: check where it landed.
      SELECT * INTO v_block FROM public.event_schedule_blocks WHERE block_id = NEW.block_id AND event_id = NEW.event_id;
      IF FOUND THEN
        -- ✏️ #8094: the shop's OWN item (its booking is among the moment's responsible suppliers) goes in at once.
        IF NEW.vendor_profile_id IS NOT NULL AND EXISTS (
             SELECT 1
               FROM public.event_vendors ev
              WHERE ev.event_id = NEW.event_id
                AND ev.marketplace_vendor_id = NEW.vendor_profile_id
                AND ev.vendor_id = ANY (COALESCE(v_block.responsible_vendor_ids, '{}'::uuid[]))
           ) THEN
          v_ok := TRUE;
        ELSIF v_block.parent_block_id IS NOT NULL THEN
          v_ok := public.backstage_window_verdict(v_block.parent_block_id, v_block.start_at, v_block.end_at) = 'at_once';
        END IF;
      END IF;
    END IF;
  END IF;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'schedulerequest:needs_a_person'
      USING HINT = 'Only a supplier''s own moment, or its own backstage moment inside the venue''s hours, goes in without the host. This one waits for the host or coordinator.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_request_auto_accept_guard() FROM PUBLIC, anon, authenticated;

-- Post-condition: the guard is still attached (this migration only replaced its body).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'event_schedule_suggestions_auto_accept_guard'
       AND tgrelid = 'public.event_schedule_suggestions'::regclass
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'event_schedule_suggestions_auto_accept_guard is missing — 20271356061492 must apply first';
  END IF;
END;
$$;

COMMIT;
