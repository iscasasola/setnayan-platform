-- ============================================================================
-- The guest page reads a STAMP — one number that changes whenever anything the
-- public Event Hub shares between its viewers has changed (event-day load,
-- lane L3 · 2026-10-18)
-- ============================================================================
--
-- WHY: `/{slug}` re-read the same per-event rows on every view — 13 requests
-- for a stranger, 17–21 for an invited guest — although those rows change a
-- few times a day and are read by hundreds of guests in the hour of the event.
-- Nothing in the database said "this event's public page changed", so nothing
-- could be remembered safely (PR #6454, 2026-10-08, "Option A"; the owner chose
-- it 2026-10-18). This migration is that signal:
--
--   • `event_public_revs` — one row per event: `rev`, a value that is NEVER
--     reused (a global sequence), replaced whenever a write to a table the
--     guest page shares between viewers COMMITS.
--   • `event_public_stamp(slug)` — the page's one cheap read: which event the
--     address names, and its rev. The page keys every remembered read by it, so
--     a write is seen by the very next view (apps/web/lib/event-shared-reads.ts).
--   • `event_entitlement_facts(event)` — every per-event ownership fact the
--     render asks (orders, comp grants, internal host, founder seat, basket
--     lines) in ONE request instead of one per fact and one per product. NOT
--     remembered across requests: a comp grant expires by the clock, which no
--     write announces.
--
-- 🔒 WHY ITS OWN TABLE, NOT AN `events` COLUMN: a child table's write would
-- have to UPDATE `events` — firing every trigger `events` carries and putting
-- a row on the realtime publication for every guest write on the day.
--
-- 🔒 WHY DEFERRED (constraint triggers, INITIALLY DEFERRED): the rev row is
-- locked only at COMMIT, after every statement of the transaction has run, and
-- once per transaction per event (`bumped_xact`). An immediate trigger would
-- hold that lock from the first row of a bulk write while the same transaction
-- went on to wait for a guest's row — a deadlock path the event day never had.
--
-- 🔒 WHY A SEQUENCE, NOT rev + 1: a value is never handed out twice, so no
-- remembered read can ever be mistaken for a newer one — not even if a row here
-- were deleted and made again.
--
-- 🔒 `guests` bumps only when a column the shared read prints changes
-- (`guests_event_public_rev_upd` WHEN …): an RSVP, a face-tagging answer or an
-- avatar does not empty every guest's cache on the day. Insert / delete always
-- bump. The app refuses to remember a `guests` read that names any other
-- column (apps/web/lib/event-shared-reads.ts `GUESTS_SHARED_COLUMNS`, held equal
-- to the WHEN list below by apps/web/lib/event-shared-reads.test.ts).
--
-- ⚠ NOT STAMPED, ON PURPOSE (never remembered by the app either): money
-- (`orders`, `paparazzi_seats`, `papic_limited_snapshots`), every RPC, the
-- coordinator's live announcements, and every read about one viewer.
--
-- Service-role only: RLS on with no policy, every grant to anon/authenticated
-- revoked — nothing here is reachable from a browser.
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.event_public_rev_seq;
REVOKE ALL ON SEQUENCE public.event_public_rev_seq FROM PUBLIC, anon, authenticated;

-- No FOREIGN KEY on purpose: a child row deleted by an event's own cascade
-- bumps at COMMIT, after the event is gone — a reference would refuse that and
-- take the event's deletion down with it. An orphan row is harmless.
CREATE TABLE IF NOT EXISTS public.event_public_revs (
  event_id     UUID        PRIMARY KEY,
  rev          BIGINT      NOT NULL,
  bumped_xact  xid8,
  bumped_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.event_public_revs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.event_public_revs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.event_public_revs TO service_role;

COMMENT ON TABLE public.event_public_revs IS
  'One row per event: rev changes (a never-reused sequence value) whenever a committed write touches a table the '
  'public guest page shares between viewers. The page keys its remembered reads by it (apps/web/lib/event-shared-reads.ts). '
  'Service-role only. Migration 20271275959355.';

-- ── The bump: once per transaction per event, at COMMIT ────────────────────
CREATE OR REPLACE FUNCTION public.event_public_rev_bump(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_event_id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.event_public_revs AS r (event_id, rev, bumped_xact, bumped_at)
  VALUES (p_event_id, nextval('public.event_public_rev_seq'), pg_current_xact_id(), NOW())
  ON CONFLICT (event_id) DO UPDATE
     SET rev = EXCLUDED.rev, bumped_xact = EXCLUDED.bumped_xact, bumped_at = EXCLUDED.bumped_at
   WHERE r.bumped_xact IS DISTINCT FROM EXCLUDED.bumped_xact;
END;
$$;
REVOKE ALL ON FUNCTION public.event_public_rev_bump(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.event_public_rev_on_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.event_public_rev_bump(NEW.event_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.event_public_rev_bump(OLD.event_id);
  ELSE
    PERFORM public.event_public_rev_bump(NEW.event_id);
    IF OLD.event_id IS DISTINCT FROM NEW.event_id THEN
      PERFORM public.event_public_rev_bump(OLD.event_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.event_public_rev_on_write() FROM PUBLIC, anon, authenticated;

-- ── The stamped tables (apps/web/lib/event-shared-reads.ts SHARED_EVENT_TABLES)
-- Every row of each carries `event_id`. A table added there must be added here
-- — apps/web/lib/event-shared-reads.test.ts and
-- apps/web/tests/db/the-guest-page-stamp-moves-with-every-shared-write.db.test.ts
-- fail until it is.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'events',
    'invitation_widgets',
    'event_editorial',
    'event_vendors',
    'event_recaps',
    'event_floor_plan',
    'event_schedule_blocks',
    'march_not_walking',
    'march_walks',
    'creator_chapters'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_event_public_rev', t);
    EXECUTE format(
      'CREATE CONSTRAINT TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I '
      'DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.event_public_rev_on_write()',
      t || '_event_public_rev', t
    );
  END LOOP;
END;
$$;

-- `guests`: every insert and delete; an update only when a printed column changes.
DROP TRIGGER IF EXISTS guests_event_public_rev ON public.guests;
CREATE CONSTRAINT TRIGGER guests_event_public_rev
  AFTER INSERT OR DELETE ON public.guests
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.event_public_rev_on_write();

DROP TRIGGER IF EXISTS guests_event_public_rev_upd ON public.guests;
CREATE CONSTRAINT TRIGGER guests_event_public_rev_upd
  AFTER UPDATE ON public.guests
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN ((
    OLD.event_id, OLD.guest_id, OLD.deleted_at, OLD.display_name, OLD.name_prefix, OLD.first_name,
    OLD.middle_name, OLD.last_name, OLD.name_suffix, OLD.role, OLD.extra_roles,
    OLD.plus_one_of_guest_id, OLD.couple_with_guest_id, OLD.attire, OLD.gender
  ) IS DISTINCT FROM (
    NEW.event_id, NEW.guest_id, NEW.deleted_at, NEW.display_name, NEW.name_prefix, NEW.first_name,
    NEW.middle_name, NEW.last_name, NEW.name_suffix, NEW.role, NEW.extra_roles,
    NEW.plus_one_of_guest_id, NEW.couple_with_guest_id, NEW.attire, NEW.gender
  ))
  EXECUTE FUNCTION public.event_public_rev_on_write();

-- Every event that exists gets its first rev now; a new event gets one from its
-- own insert. An event with NO row is never remembered (its stamp reads null).
INSERT INTO public.event_public_revs (event_id, rev)
SELECT e.event_id, nextval('public.event_public_rev_seq')
  FROM public.events e
ON CONFLICT (event_id) DO NOTHING;

-- ── The page's one read: which event this address names, and its rev ───────
-- The same predicate as the shell's own read (`slug ILIKE`); more than one row
-- and the page reads directly, as before (apps/web/lib/event-shared-reads.ts).
CREATE OR REPLACE FUNCTION public.event_public_stamp(p_slug TEXT)
RETURNS TABLE (event_id UUID, rev BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT e.event_id, r.rev
    FROM public.events e
    LEFT JOIN public.event_public_revs r ON r.event_id = e.event_id
   WHERE p_slug IS NOT NULL
     AND e.slug ILIKE p_slug;
$$;
REVOKE ALL ON FUNCTION public.event_public_stamp(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_public_stamp(TEXT) TO service_role;

-- ── Every per-event ownership fact, in one request ─────────────────────────
-- Each part is the SAME question the render asked separately: the order rows
-- (`orders.service_key, status`); `event_comp_active_skus`;
-- `event_host_is_internal`; `event_host_holds_founder_seat`; and every row
-- `event_basket_orders_granting` answers, for every service code at once. Any
-- failure fails the whole call and the app asks each fact the old way.
-- Service role only — the order rows are the couple's bill.
CREATE OR REPLACE FUNCTION public.event_entitlement_facts(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_event_id IS NULL OR coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'orders', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('service_key', o.service_key, 'status', o.status))
        FROM public.orders o
       WHERE o.event_id = p_event_id
    ), '[]'::jsonb),
    'comp_skus', to_jsonb(public.event_comp_active_skus(p_event_id)),
    'host_internal', public.event_host_is_internal(p_event_id),
    'founder_seat', public.event_host_holds_founder_seat(p_event_id),
    'basket', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('service_code', i.service_code, 'order_id', i.order_id, 'status', o.status::TEXT))
        FROM public.onboarding_order_items i
        JOIN public.orders o ON o.order_id = i.order_id
       WHERE o.event_id = p_event_id
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.event_entitlement_facts(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_entitlement_facts(UUID) TO service_role;
