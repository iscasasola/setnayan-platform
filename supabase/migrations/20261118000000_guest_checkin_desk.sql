-- ============================================================================
-- 20261118000000_guest_checkin_desk.sql
-- Day-of check-in desk (guests lifecycle "Day-of" step · #1220 follow-up)
--
-- One row per checked-in guest; undo = DELETE. A dedicated table (rather than
-- columns on guests) because guests' write policy is couple-only and the desk
-- must be operable by coordinators on the wedding day — this table carries its
-- own couple+coordinator policy (same actor pair as the live photo wall's
-- wall_display_sessions, 20261104000959) without touching the locked guests
-- policies.
--
-- Also widens SEATING reads (event_tables + event_seat_assignments) to
-- coordinators — additive SELECT-only policies; the desk shows each arriving
-- guest's table, and coordinators are exactly the people running the door.
-- Couple-only WRITE on seating is unchanged.
-- ============================================================================

BEGIN;

-- Composite-FK target so a check-in row can never pair guest A with event B
-- (guest_id alone is already UNIQUE; this index makes the pair referenceable).
CREATE UNIQUE INDEX IF NOT EXISTS guests_event_guest_uniq
  ON public.guests (event_id, guest_id);

CREATE TABLE public.guest_checkins (
  checkin_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL,
  guest_id              UUID NOT NULL UNIQUE,
  checked_in_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_in_by_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  method                TEXT NOT NULL DEFAULT 'qr_scan'
                          CHECK (method IN ('qr_scan', 'manual_search')),
  FOREIGN KEY (event_id, guest_id)
    REFERENCES public.guests (event_id, guest_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.guest_checkins IS
  'Day-of arrival state: one row = this guest is checked in. Undo = DELETE. checked_in_by_user_id + method are the audit trail.';

CREATE INDEX guest_checkins_event_idx
  ON public.guest_checkins (event_id, checked_in_at DESC);

ALTER TABLE public.guest_checkins ENABLE ROW LEVEL SECURITY;

-- Couple + coordinator of the event (or Setnayan admin) run the door.
CREATE POLICY guest_checkins_member_manage ON public.guest_checkins
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = guest_checkins.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple', 'coordinator')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = guest_checkins.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple', 'coordinator')
    )
  );

-- Seating read access for coordinators (SELECT-only; write stays couple-only).
CREATE POLICY event_tables_coordinator_read ON public.event_tables
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_tables.event_id
        AND em.user_id = auth.uid()
        AND em.member_type = 'coordinator'
    )
  );

CREATE POLICY event_seat_assignments_coordinator_read ON public.event_seat_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_seat_assignments.event_id
        AND em.user_id = auth.uid()
        AND em.member_type = 'coordinator'
    )
  );

COMMIT;
