-- ============================================================================
-- 20261108000000_ugc_moderation.sql
-- User-generated-content moderation tooling for the Papic guest galleries.
--
-- WHY THIS EXISTS
--   Apple App Store guideline 1.2 (Safety · User-Generated Content) and Google
--   Play's UGC policy both require an app that lets users post media to provide:
--     (a) a filter for objectionable content        — exists (NSFW filter)
--     (b) an in-app mechanism to REPORT content      — this migration adds the
--                                                       reports table + admin route
--     (c) the ability to BLOCK an abusive user       — event_blocked_users below
--     (d) a published terms-of-use defining           — ugc_terms_accepted_at
--         objectionable content + an acceptance gate    acceptance stamp below
--     (e) reports reaching a moderator within a       — admin (is_admin) RLS +
--         reasonable window                              /admin/user-reports queue
--
--   The only UGC surface in V1 is the Papic guest camera (iteration 0012): a
--   wedding guest, identified by a guest-session cookie (guest_id, NOT a users
--   row), captures photos that land in public.papic_guest_captures. There is no
--   gallery-comment feature, so per-comment reporting is intentionally NOT built
--   here (the target_type CHECK still allows 'comment' for forward-compat).
--
-- DESIGN DECISIONS (owner-locked + faithful-to-code choices)
--   * Block is EVENT-SCOPED (owner-locked): a guest blocked from one event's
--     gallery is unaffected on every other event. Enforced server-side inside
--     papic_record_guest_capture (a blocked guest's capture is rejected) — see
--     section 4.
--   * The abusive uploader is a GUEST (guest_id), not a Setnayan user account,
--     so event_blocked_users keys on blocked_guest_id (the real actor) rather
--     than the spec's nominal blocked_user_id. blocked_by_user_id IS a users row
--     (the couple/host who clicked Block). Documented as a deviation.
--   * Terms acceptance is stored as a minimal per-guest stamp
--     (guests.ugc_terms_accepted_at) rather than a new table — the guest row is
--     the natural per-event participant record and already carries per-guest
--     state (qr_token, photo_consent). One column, no backfill.
--
-- IDEMPOTENT + RLS AT CREATE TIME. Safe to (re-)apply. Does NOT touch prod here.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. user_reports — the in-app report queue.
--
--    A report can be filed by a signed-in user (reporter_user_id) OR by a guest
--    via a SECURITY DEFINER path (reporter_user_id NULL, reporter_guest_id set).
--    target_type photo|comment|user names what is being reported; target_id is
--    the opaque id of that thing (a capture_id, a guest_id, etc.). Reports route
--    BOTH to the couple (their event's queue) AND to Setnayan admins.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_reports (
  id                 BIGSERIAL PRIMARY KEY,
  report_id          UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  public_id          TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('W'),
  reporter_user_id   UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
    -- The signed-in reporter (couple/host/admin). NULL when a guest reports via
    -- the SECURITY DEFINER report_guest_capture() path.
  reporter_guest_id  UUID REFERENCES public.guests(guest_id) ON DELETE SET NULL,
    -- The guest reporter, when a report comes from a guest-session surface.
  event_id           UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  target_type        TEXT NOT NULL CHECK (target_type IN ('photo', 'comment', 'user')),
  target_id          TEXT NOT NULL,
    -- Opaque id of the reported thing: a papic_guest_captures.capture_id for a
    -- photo, a guests.guest_id for a user, etc. TEXT keeps it target-agnostic.
  reason             TEXT NOT NULL
                       CHECK (reason IN (
                         'nudity_sexual',
                         'violence',
                         'hate_harassment',
                         'spam',
                         'not_my_event',
                         'other'
                       )),
  details            TEXT,
  status             TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'actioned', 'dismissed')),
  action_taken       TEXT,
    -- Free-text note of what the moderator did (hidden / blocked uploader /
    -- escalated / dismissed). Mirrors vendor_disputes.resolution_notes.
  reviewed_by        UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_reports_event_id_idx
  ON public.user_reports(event_id);
CREATE INDEX IF NOT EXISTS user_reports_status_idx
  ON public.user_reports(status);
CREATE INDEX IF NOT EXISTS user_reports_created_at_idx
  ON public.user_reports(created_at);
CREATE INDEX IF NOT EXISTS user_reports_target_idx
  ON public.user_reports(target_type, target_id);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- A signed-in reporter may file (INSERT) a report as themselves and read back
-- their own reports.
DROP POLICY IF EXISTS user_reports_reporter_insert ON public.user_reports;
CREATE POLICY user_reports_reporter_insert ON public.user_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_user_id = auth.uid());

DROP POLICY IF EXISTS user_reports_reporter_read ON public.user_reports;
CREATE POLICY user_reports_reporter_read ON public.user_reports
  FOR SELECT
  TO authenticated
  USING (reporter_user_id = auth.uid());

-- The couple reads every report filed against content in one of their events
-- (current_event_ids() = the caller's event memberships) so their own
-- moderation surface can show them.
DROP POLICY IF EXISTS user_reports_couple_read ON public.user_reports;
CREATE POLICY user_reports_couple_read ON public.user_reports
  FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

-- Setnayan admins read everything and update (triage / resolve) any report.
DROP POLICY IF EXISTS user_reports_admin_read ON public.user_reports;
CREATE POLICY user_reports_admin_read ON public.user_reports
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS user_reports_admin_update ON public.user_reports;
CREATE POLICY user_reports_admin_update ON public.user_reports
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.user_reports IS
  'UGC report queue (Apple 1.2 / Google Play UGC). One row per report filed '
  'against Papic guest gallery content. Routes to both the couple (event RLS) '
  'and Setnayan admins (is_admin). Guest-filed reports come through the '
  'SECURITY DEFINER report_guest_capture() fn.';

-- ----------------------------------------------------------------------------
-- 2. event_blocked_users — EVENT-SCOPED block list.
--
--    A row here blocks `blocked_guest_id` from uploading to `event_id`'s Papic
--    gallery. The block is scoped to the single event by design (owner-locked).
--    blocked_by_user_id is the couple/host who issued the block.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_blocked_users (
  id                 BIGSERIAL PRIMARY KEY,
  event_id           UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  blocked_guest_id   UUID NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,
    -- The blocked UPLOADER. Named blocked_guest_id (not the spec's
    -- blocked_user_id) because the abusive uploader in the only V1 UGC surface
    -- is a guest identified by guest_id, not a Setnayan users row.
  blocked_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  reason             TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, blocked_guest_id)
);

CREATE INDEX IF NOT EXISTS event_blocked_users_event_id_idx
  ON public.event_blocked_users(event_id);

ALTER TABLE public.event_blocked_users ENABLE ROW LEVEL SECURITY;

-- The event couple manages (read/insert/delete) block rows for their own event.
-- Pattern B (event-member couple). Admin full.
DROP POLICY IF EXISTS event_blocked_users_couple_all ON public.event_blocked_users;
CREATE POLICY event_blocked_users_couple_all ON public.event_blocked_users
  FOR ALL
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_blocked_users.event_id
        AND em.user_id = auth.uid()
        AND em.member_type = 'couple'
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_blocked_users.event_id
        AND em.user_id = auth.uid()
        AND em.member_type = 'couple'
    )
  );

COMMENT ON TABLE public.event_blocked_users IS
  'Event-scoped block list (owner-locked). A row blocks blocked_guest_id from '
  'uploading to event_id''s Papic gallery; the block never leaks to other '
  'events. Enforced server-side in papic_record_guest_capture().';

-- ----------------------------------------------------------------------------
-- 3. Terms acceptance — minimal per-guest stamp.
--
--    The guest row IS the per-event participant record, so the one-time UGC
--    terms acceptance lives there. No new table, no backfill.
-- ----------------------------------------------------------------------------

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS ugc_terms_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.guests.ugc_terms_accepted_at IS
  'When this guest accepted the UGC terms of use (objectionable-content rules) '
  'before their first Papic capture. NULL = not yet accepted; the guest camera '
  'gates the first upload on this. Set via papic_accept_ugc_terms().';

-- ----------------------------------------------------------------------------
-- 4. Enforce the block + the terms gate in the capture path.
--
--    papic_record_guest_capture (migration 20260718000000) is the SECURITY
--    DEFINER fn the public guest-camera route calls to record a capture. We
--    re-create it here with two additional, authoritative gates BEFORE the
--    quota check:
--      * blocked     — a row in event_blocked_users for this (event, guest)
--                      rejects the capture with status 'blocked'.
--      * terms       — a guest with NULL ugc_terms_accepted_at is rejected with
--                      status 'terms_required' so the client shows the gate.
--    Everything else (ownership, advisory lock, quota) is unchanged.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.papic_record_guest_capture(
  p_guest_id      UUID,
  p_r2_object_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits CONSTANT INTEGER := 150;
  v_event_id     UUID;
  v_owns         BOOLEAN;
  v_used         INTEGER;
  v_blocked      BOOLEAN;
  v_terms_at     TIMESTAMPTZ;
BEGIN
  -- Resolve the guest's event. A deleted guest cannot capture.
  SELECT event_id, ugc_terms_accepted_at INTO v_event_id, v_terms_at
  FROM public.guests
  WHERE guest_id = p_guest_id
    AND deleted_at IS NULL;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_guest');
  END IF;

  v_owns := public.papic_event_owns_service(v_event_id, 'PAPIC_GUEST');
  IF NOT v_owns THEN
    RETURN jsonb_build_object('status', 'not_owned');
  END IF;

  -- UGC moderation gate 1 — event-scoped block. A blocked uploader cannot
  -- deposit anything into this event's gallery (Apple 1.2 / Play UGC: block).
  SELECT EXISTS (
    SELECT 1 FROM public.event_blocked_users b
    WHERE b.event_id = v_event_id
      AND b.blocked_guest_id = p_guest_id
  ) INTO v_blocked;
  IF v_blocked THEN
    RETURN jsonb_build_object('status', 'blocked');
  END IF;

  -- UGC moderation gate 2 — one-time terms acceptance. The first upload is
  -- gated on the guest having accepted the objectionable-content terms.
  IF v_terms_at IS NULL THEN
    RETURN jsonb_build_object('status', 'terms_required');
  END IF;

  -- Advisory lock keyed on the guest so two simultaneous captures from the
  -- same phone serialize through the count check.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_guest_id::text, 0));

  SELECT COUNT(*)::INTEGER INTO v_used
  FROM public.papic_guest_captures
  WHERE guest_id = p_guest_id;

  IF v_used >= v_credits THEN
    RETURN jsonb_build_object(
      'status', 'quota_exhausted',
      'total', v_credits,
      'used', v_used,
      'remaining', 0
    );
  END IF;

  INSERT INTO public.papic_guest_captures (event_id, guest_id, r2_object_key)
  VALUES (v_event_id, p_guest_id, p_r2_object_key);

  RETURN jsonb_build_object(
    'status', 'ok',
    'total', v_credits,
    'used', v_used + 1,
    'remaining', GREATEST(0, v_credits - (v_used + 1))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.papic_record_guest_capture(UUID, TEXT) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- 5. papic_accept_ugc_terms — stamp a guest's one-time terms acceptance.
--
--    SECURITY DEFINER because the guest camera is a public, RLS-less surface
--    (the guest is identified by the guest-session cookie, not auth.uid()).
--    Idempotent: only stamps the first time (COALESCE keeps the original ts).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.papic_accept_ugc_terms(
  p_guest_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT event_id INTO v_event_id
  FROM public.guests
  WHERE guest_id = p_guest_id
    AND deleted_at IS NULL;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_guest');
  END IF;

  UPDATE public.guests
  SET ugc_terms_accepted_at = COALESCE(ugc_terms_accepted_at, NOW())
  WHERE guest_id = p_guest_id;

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

GRANT EXECUTE ON FUNCTION public.papic_accept_ugc_terms(UUID) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- 6. report_guest_capture — guest-filed report of a gallery photo.
--
--    Lets a guest report another guest's capture without a Setnayan account
--    (SECURITY DEFINER; the guest is the guest-session cookie). Records a
--    user_reports row that the couple + admins both see. Idempotent-ish: a
--    guest can only file one open report per target (avoids spam) via a guard.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.report_guest_capture(
  p_reporter_guest_id UUID,
  p_capture_id        UUID,
  p_reason            TEXT,
  p_details           TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id     UUID;
  v_target_event UUID;
  v_exists       BOOLEAN;
BEGIN
  IF p_reason NOT IN ('nudity_sexual','violence','hate_harassment','spam','not_my_event','other') THEN
    RETURN jsonb_build_object('status', 'bad_reason');
  END IF;

  -- The reporter must be a live guest; resolve their event.
  SELECT event_id INTO v_event_id
  FROM public.guests
  WHERE guest_id = p_reporter_guest_id
    AND deleted_at IS NULL;
  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_guest');
  END IF;

  -- The reported capture must exist and belong to the reporter's event (a
  -- guest can only report content in their own gallery).
  SELECT event_id INTO v_target_event
  FROM public.papic_guest_captures
  WHERE capture_id = p_capture_id;
  IF v_target_event IS NULL OR v_target_event <> v_event_id THEN
    RETURN jsonb_build_object('status', 'invalid_target');
  END IF;

  -- One open report per (reporter, target) — keeps the queue clean.
  SELECT EXISTS (
    SELECT 1 FROM public.user_reports
    WHERE reporter_guest_id = p_reporter_guest_id
      AND target_type = 'photo'
      AND target_id = p_capture_id::text
      AND status = 'open'
  ) INTO v_exists;
  IF v_exists THEN
    RETURN jsonb_build_object('status', 'already_reported');
  END IF;

  INSERT INTO public.user_reports
    (reporter_guest_id, event_id, target_type, target_id, reason, details)
  VALUES
    (p_reporter_guest_id, v_event_id, 'photo', p_capture_id::text, p_reason, p_details);

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_guest_capture(UUID, UUID, TEXT, TEXT) TO authenticated, anon;

COMMIT;
