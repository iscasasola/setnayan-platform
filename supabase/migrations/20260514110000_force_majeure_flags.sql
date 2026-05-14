-- ============================================================================
-- 20260514110000_force_majeure_flags.sql
-- Iteration 0019 — Force-majeure flags (Phase 2 of admin queues + couple
-- dispute flow).
--
-- A couple flags a force-majeure event (typhoon, family emergency, vendor /
-- venue cancellation, other) against their event — optionally scoped to a
-- specific contracted vendor. An admin (is_internal/is_team_member) reviews
-- via /admin/force-majeure and routes to one of six resolutions: refund,
-- reschedule, partial credit, mediation, resolved, dismissed.
--
-- Auto-resolve at +7 days is captured here (auto_resolve_at) so the admin
-- queue can surface a countdown; the cron that actually flips stale rows is
-- out of V1 scope.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. force_majeure_flags
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.force_majeure_flags (
  flag_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id               TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('F'),
  event_id                UUID NOT NULL
                          REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- Nullable: a couple may flag a whole-event force-majeure (e.g. typhoon
  -- forces the whole wedding to reschedule) without singling out a vendor.
  -- Note: event_vendors's primary key column is `vendor_id`. We retain the
  -- semantic name `event_vendor_id` on this row so future readers don't
  -- mistake it for a vendor_profiles foreign key.
  event_vendor_id         UUID
                          REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  couple_user_id          UUID
                          REFERENCES auth.users(id) ON DELETE SET NULL,
  flag_type               TEXT NOT NULL
                          CHECK (flag_type IN (
                            'typhoon',
                            'family_emergency',
                            'vendor_cancellation',
                            'venue_cancellation',
                            'other'
                          )),
  description             TEXT NOT NULL
                          CHECK (length(description) >= 30 AND length(description) <= 4000),
  evidence_urls           TEXT[] NOT NULL DEFAULT '{}',
  status                  TEXT NOT NULL DEFAULT 'open'
                          CHECK (status IN (
                            'open',
                            'under_review',
                            'refund_issued',
                            'rescheduled',
                            'partial_credit',
                            'mediation',
                            'resolved',
                            'dismissed'
                          )),
  resolution_notes        TEXT,
  admin_handler_user_id   UUID
                          REFERENCES auth.users(id) ON DELETE SET NULL,
  auto_resolve_at         TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  resolved_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS force_majeure_flags_event_id_idx
  ON public.force_majeure_flags(event_id);
CREATE INDEX IF NOT EXISTS force_majeure_flags_event_vendor_id_idx
  ON public.force_majeure_flags(event_vendor_id);
CREATE INDEX IF NOT EXISTS force_majeure_flags_status_idx
  ON public.force_majeure_flags(status);
CREATE INDEX IF NOT EXISTS force_majeure_flags_created_at_idx
  ON public.force_majeure_flags(created_at DESC);

ALTER TABLE public.force_majeure_flags ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. RLS
--
--   • Couple (event_members.member_type='couple') can SELECT their own event's
--     flags and INSERT new ones. They cannot UPDATE — once filed, the admin
--     handles the resolution.
--   • Admin (is_admin() helper from the base migration) can SELECT and UPDATE
--     every row. UPDATE covers the "take ownership" + 6 resolution flows.
--   • Public (anonymous / unrelated users) cannot see flags at all.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS force_majeure_couple_read ON public.force_majeure_flags;
CREATE POLICY force_majeure_couple_read
  ON public.force_majeure_flags FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS force_majeure_couple_insert ON public.force_majeure_flags;
CREATE POLICY force_majeure_couple_insert
  ON public.force_majeure_flags FOR INSERT
  TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    AND couple_user_id = auth.uid()
  );

-- Admin update covers take-ownership and the 6 resolution flows.
DROP POLICY IF EXISTS force_majeure_admin_update ON public.force_majeure_flags;
CREATE POLICY force_majeure_admin_update
  ON public.force_majeure_flags FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. updated_at trigger
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_force_majeure_flags_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS force_majeure_flags_set_updated_at
  ON public.force_majeure_flags;
CREATE TRIGGER force_majeure_flags_set_updated_at
  BEFORE UPDATE ON public.force_majeure_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_force_majeure_flags_set_updated_at();

COMMIT;
