-- only_a_host_books_and_an_unbooked_coordinator_leaves
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================
-- 🔒 Ship review of #8094 (21 Nov 2026), FIX-FIRST items 1 and 2 — owner 2026-11-21 "no booking, no paying".
--
-- ── 1 · ONLY A HOST BOOKS — AT THE DATABASE ─────────────────────────────────
-- `updateVendorStatus` refuses a non-host who moves a supplier row INTO booked, but only that action knew:
-- `event_vendors_moderator_write` plus the `status` column grant let a coordinator with `vendors = edit` set
-- `status = 'contracted'` straight through PostgREST. `event_vendors_only_a_host_books_trg` refuses it for every
-- browser writer who is not a host of the event (`current_couple_event_ids()`), on INSERT and on UPDATE. Moving a
-- booked row along (delivered, complete) or back is not booking and stays theirs. The server (service role), definer
-- functions (a supplier agreeing a lock) and platform admins are not browser hosts-or-not and are unchanged.
--
-- ── 2 · AN UNBOOKED COORDINATOR LEAVES ──────────────────────────────────────
-- The booking opens the coordinator's seat automatically (`lib/coordinator-grant.ts`). Nothing closed it when the
-- booking was cancelled — and once the row is no longer booked, `supplier_proposes_only_for` stops capping the seat.
--   · `event_moderators.opened_by_event_vendor_id` — the booking that opened this seat. NULL = a host added it by
--     hand, and it is never touched here.
--   · `event_vendors_unbooked_closes_its_seat_trg` — when that booking leaves the booked set, or its row is deleted,
--     the seat IT opened is closed (`removed_at`, reason 'booking_cancelled'). `sync_delegate_membership` then drops
--     the membership, as it does for a seat a host removes.
--
-- Never applied by hand — the pipeline's `db push --include-all` applies it.
-- ============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ── 1 · only a host books ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.event_vendors_only_a_host_books()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status::text IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND (TG_OP = 'INSERT' OR OLD.status::text NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete'))
     AND current_user IN ('authenticated', 'anon')
     AND NOT COALESCE(public.is_admin(), false)
     AND NEW.event_id NOT IN (SELECT public.current_couple_event_ids())
  THEN
    RAISE EXCEPTION 'ONLY_A_HOST_BOOKS: only a host of the event can book a supplier' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.event_vendors_only_a_host_books() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_vendors_only_a_host_books_trg ON public.event_vendors;
CREATE TRIGGER event_vendors_only_a_host_books_trg
  BEFORE INSERT OR UPDATE OF status ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.event_vendors_only_a_host_books();

-- ── 2 · the seat a booking opened, and its closing ──────────────────────────
ALTER TABLE public.event_moderators
  ADD COLUMN IF NOT EXISTS opened_by_event_vendor_id UUID NULL
  REFERENCES public.event_vendors(vendor_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.event_moderators.opened_by_event_vendor_id IS
  'The booking (event_vendors row) that opened this seat automatically (lib/coordinator-grant.ts). NULL = a host added the seat by hand. When that booking leaves the booked set or is deleted, event_vendors_unbooked_closes_its_seat_trg closes this seat — and only this one.';

CREATE INDEX IF NOT EXISTS event_moderators_opened_by_event_vendor_idx
  ON public.event_moderators (opened_by_event_vendor_id)
  WHERE opened_by_event_vendor_id IS NOT NULL AND removed_at IS NULL;

CREATE OR REPLACE FUNCTION public.event_vendors_unbooked_closes_its_seat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     OR (OLD.status::text IN ('contracted', 'deposit_paid', 'delivered', 'complete')
         AND NEW.status::text NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete'))
  THEN
    UPDATE public.event_moderators m
       SET removed_at = NOW(), removal_reason = 'booking_cancelled', updated_at = NOW()
     WHERE m.opened_by_event_vendor_id = OLD.vendor_id
       AND m.removed_at IS NULL;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.event_vendors_unbooked_closes_its_seat() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_vendors_unbooked_closes_its_seat_trg ON public.event_vendors;
CREATE TRIGGER event_vendors_unbooked_closes_its_seat_trg
  AFTER UPDATE OF status ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.event_vendors_unbooked_closes_its_seat();

DROP TRIGGER IF EXISTS event_vendors_deleted_closes_its_seat_trg ON public.event_vendors;
CREATE TRIGGER event_vendors_deleted_closes_its_seat_trg
  BEFORE DELETE ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.event_vendors_unbooked_closes_its_seat();

COMMIT;
