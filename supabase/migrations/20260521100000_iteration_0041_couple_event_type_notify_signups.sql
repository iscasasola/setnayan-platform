-- ============================================================================
-- 20260521100000_iteration_0041_couple_event_type_notify_signups.sql
--
-- Iteration 0041 — Multi-event support. Email-capture table for couples
-- (or anonymous visitors) interested in a Coming-Soon event_type. Mirrors
-- the iteration 0043 pattern from `couple_wedding_type_notify_signups`
-- (faith-gating) but indexed by event_type instead of ceremony_type.
--
-- When a couple lands on /vendors?event_type=debut (auto-applied by
-- PR #189 from their primary event's event_type) and the marketplace is
-- empty, the Coming-Soon banner from PR #184 surfaces a form: "Notify me
-- when debut vendors are live." Submissions land here. Ops uses the data
-- to prioritize vendor recruitment per event_type per region.
--
-- user_id is nullable so the form works pre-account (anonymous browse
-- visitors can sign up). Signed-in submissions stamp user_id for
-- attribution; anonymous submissions stay attached to email only.
--
-- Idempotent — IF NOT EXISTS + DROP POLICY IF EXISTS pattern.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.couple_event_type_notify_signups (
  signup_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  email             TEXT NOT NULL,
  event_type        TEXT NOT NULL
                    CHECK (event_type IN (
                      'wedding','birthday','celebration','travel',
                      'corporate','tournament','christening',
                      'gender_reveal','debut'
                    )),
  region            TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_type_notify_signups_event_type_idx
  ON public.couple_event_type_notify_signups (event_type);

CREATE INDEX IF NOT EXISTS event_type_notify_signups_email_idx
  ON public.couple_event_type_notify_signups (LOWER(email));

ALTER TABLE public.couple_event_type_notify_signups ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + auth) can insert a signup. We trust the form throttling
-- + the indexed lookups; spam volume is contained by the email being
-- queryable for admin de-dupe.
DROP POLICY IF EXISTS event_type_notify_signups_insert ON public.couple_event_type_notify_signups;
CREATE POLICY event_type_notify_signups_insert
  ON public.couple_event_type_notify_signups FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

-- Reads are admin-only. The couple who signed up doesn't need to see
-- their own row (the form's success state confirms the signup); only
-- ops needs the data, via /admin or direct query.
DROP POLICY IF EXISTS event_type_notify_signups_admin_read ON public.couple_event_type_notify_signups;
CREATE POLICY event_type_notify_signups_admin_read
  ON public.couple_event_type_notify_signups FOR SELECT
  TO authenticated
  USING (public.is_admin());

COMMIT;
