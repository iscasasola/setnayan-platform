-- ════════════════════════════════════════════════════════════════════════════
-- 🕕 A SUPPLIER'S OWN TIMES, BEFORE THE HOSTS' PROGRAM EXISTS
-- Owner-approved supplier cut 5, 2026-11-14 (DECISION_LOG "THE SEVEN SUPPLIER
-- CUTS ARE APPROVED"; prototype
-- prototypes/supplier_eleven_jobs_cuts_2026-11-14_fable.html § 5).
--
-- The timed walk: a booked supplier's Schedule tab said "The hosts haven't made
-- their chapters yet" with ZERO controls, while the chat pinned "DUE NOW · Set
-- your call time on their Schedule". A supplier's times could only be sent as a
-- request against a chapter the host made (a schedule request needs a parent
-- chapter), so before the program existed there was nowhere to put them.
--
-- This table is that place: ONE row per booked shop per event — the call time,
-- the arrival and the finish, as the VENUE'S WALL CLOCK on the event day
-- ('HH:MM', never an instant: a wall clock stored as an instant is the
-- 480-minute bug this repo has paid for). Once the hosts build their program the
-- times slot in as the same "<shop> arrives" / "<shop> is done" requests My
-- times already files (`filed_at` records when), and the chat's call-time pin
-- counts a call time set here as set.
--
-- ADD-ONLY: a new table; nothing existing is altered or dropped.
-- Idempotent: IF NOT EXISTS / DROP POLICY IF EXISTS throughout.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.supplier_own_times (
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  call_clock        TEXT NULL CHECK (call_clock   IS NULL OR call_clock   ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  arrive_clock      TEXT NULL CHECK (arrive_clock IS NULL OR arrive_clock ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  done_clock        TEXT NULL CHECK (done_clock   IS NULL OR done_clock   ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  -- When the times were slotted into the hosts' program (filed as requests). NULL = not yet.
  filed_at          TIMESTAMPTZ NULL,
  updated_by        UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, vendor_profile_id)
);

ALTER TABLE public.supplier_own_times ENABLE ROW LEVEL SECURITY;

-- Privileges: revoke first, then grant back only the verbs the policies below use
-- (SELECT · INSERT · UPDATE — there is no DELETE policy, so no DELETE grant).
REVOKE ALL ON public.supplier_own_times FROM PUBLIC;
REVOKE ALL ON public.supplier_own_times FROM anon;
REVOKE ALL ON public.supplier_own_times FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.supplier_own_times TO authenticated;

-- The shop (owner or team) reads its own row, on an event it is booked for.
DROP POLICY IF EXISTS supplier_own_times_shop_read ON public.supplier_own_times;
CREATE POLICY supplier_own_times_shop_read
  ON public.supplier_own_times FOR SELECT TO authenticated
  USING (
    (vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      OR vendor_profile_id IN (SELECT public.current_vendor_ids()))
    AND event_id IN (SELECT public.current_vendor_booked_event_ids())
  );

-- The event's people read every booked shop's times (the hosts own the program).
DROP POLICY IF EXISTS supplier_own_times_event_read ON public.supplier_own_times;
CREATE POLICY supplier_own_times_event_read
  ON public.supplier_own_times FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()) OR public.is_admin());

-- The shop writes its OWN row only, on an event it is booked for, signed as itself. Nobody else writes it.
DROP POLICY IF EXISTS supplier_own_times_shop_insert ON public.supplier_own_times;
CREATE POLICY supplier_own_times_shop_insert
  ON public.supplier_own_times FOR INSERT TO authenticated
  WITH CHECK (
    (vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      OR vendor_profile_id IN (SELECT public.current_vendor_ids()))
    AND event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND updated_by = auth.uid()
  );

DROP POLICY IF EXISTS supplier_own_times_shop_update ON public.supplier_own_times;
CREATE POLICY supplier_own_times_shop_update
  ON public.supplier_own_times FOR UPDATE TO authenticated
  USING (
    (vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      OR vendor_profile_id IN (SELECT public.current_vendor_ids()))
    AND event_id IN (SELECT public.current_vendor_booked_event_ids())
  )
  WITH CHECK (
    (vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      OR vendor_profile_id IN (SELECT public.current_vendor_ids()))
    AND event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND updated_by = auth.uid()
  );

COMMENT ON TABLE public.supplier_own_times IS
  'A booked supplier''s own call time, arrival and finish for one event, as the venue''s wall clock (HH:MM) on the event day — set before the hosts build their program (owner-approved supplier cut 5, 2026-11-14). Slotted into the program as the "<shop> arrives" / "<shop> is done" requests once it exists (filed_at). The chat''s call-time pin counts call_clock as a set call time. Migration 20271346335702.';
