-- Souvenir / favor handoff tracking (owner 2026-06-28).
--
-- The day-of souvenir table: staff scan a guest's personal QR (the same
-- guests.qr_token the check-in desk + photographers already use) to confirm the
-- guest has received their giveaway. One row = this guest got their souvenir;
-- undo = DELETE. Mirrors guest_checkins exactly (its own table, NOT a column on
-- guests, because guests' write policy is couple-only and the souvenir table
-- must be operable by coordinators on the day — same actor pair as the door).
--
-- claimed_by_user_id + method are the audit trail. method 'qr_scan' (scanned at
-- the table) or 'manual_search' (found by name).

CREATE TABLE public.guest_souvenir_claims (
  claim_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL,
  guest_id           UUID NOT NULL UNIQUE,
  claimed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_by_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  method             TEXT NOT NULL DEFAULT 'qr_scan'
                       CHECK (method IN ('qr_scan', 'manual_search')),
  FOREIGN KEY (event_id, guest_id)
    REFERENCES public.guests (event_id, guest_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.guest_souvenir_claims IS
  'Day-of souvenir/favor handoff: one row = this guest received their souvenir. Undo = DELETE. claimed_by_user_id + method are the audit trail.';

CREATE INDEX guest_souvenir_claims_event_idx
  ON public.guest_souvenir_claims (event_id, claimed_at DESC);

ALTER TABLE public.guest_souvenir_claims ENABLE ROW LEVEL SECURITY;

-- Couple + coordinator of the event (or Setnayan admin) run the souvenir table.
-- Same actor pair + structure as guest_checkins_member_manage.
CREATE POLICY guest_souvenir_claims_member_manage ON public.guest_souvenir_claims
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = guest_souvenir_claims.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple', 'coordinator')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = guest_souvenir_claims.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple', 'coordinator')
    )
  );
