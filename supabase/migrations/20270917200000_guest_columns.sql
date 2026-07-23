-- ============================================================================
-- 20270917200000_guest_columns.sql
--
-- Guest Columns — every guest may write ONE short op-ed ("column") for the
-- couple's paper: title ≤60 + body ≤280, couple approves before publish,
-- edit-until-approved, decline returns it to the guest, submissions CLOSE
-- when the event's lifecycle phase flips to 'editorial'.
-- Corpus: OnTheDay_App_Build_Studies_2026-07-23.md § 1 (BUILD ①) +
-- DECISION_LOG 2026-07-22/23 owner rules.
--
-- NEAR-CLONE of Kwento (photo_messages, 20261113000972) — the shipped canon
-- for zero-account guest TEXT with couple review:
--   * Zero-account guests carry a custom JWT cookie (no auth.uid()) — guest
--     WRITES go ONLY through the service-role-only submit/withdraw RPCs
--     (route validates the setnayan_guest_session cookie, Tier-1 text
--     moderation runs in TS BEFORE the RPC; 'blocked' is never stored).
--   * NO INSERT policy and NO anon policy — public renders read via the
--     admin client under the fail-closed approved+clean filter.
--   * Moderation authority = member_type IN ('couple','coordinator') — the
--     photo_messages_moderate RLS shape. (Note: the kwento server actions
--     gate 'couple'-only while this RLS admits coordinator — for columns we
--     follow the RLS and admit coordinator review, per the study's § 1.2
--     finding on that live inconsistency.)
--   * consent_captured_at NOT NULL — RA 10173: no consent tick, no row
--     (stamped NOW() by the RPC, the photo_messages:53 shape).
--   * guest_id ON DELETE CASCADE — erasure-friendly for authored text.
--
-- DB-level interlock (survives any buggy code path):
--   gcol_approved_needs_screen  status='approved' => state IN ('clean','flagged')
-- Public surfaces additionally filter moderation_state='clean' (fail-closed,
-- the editorial-read canon) — an approved+flagged column stays couple-only.
--
-- INERT ON MERGE: zero readers/writers reference this table until the
-- GUEST_COLUMNS_ENABLED env flag (default OFF) ships and is flipped; the
-- RPCs are callable by service_role only.
-- ============================================================================

BEGIN;

-- ── guest_columns ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guest_columns (
  id                BIGSERIAL PRIMARY KEY,
  column_id         UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  guest_id          UUID NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,

  title             TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 60),
  body_text         TEXT NOT NULL CHECK (char_length(trim(body_text)) BETWEEN 1 AND 280),

  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','user_deleted')),
  -- Optional couple note when declining — "decline returns it": the guest sees
  -- this beside the returned column and can edit + resubmit.
  decline_note      TEXT CHECK (decline_note IS NULL OR char_length(decline_note) <= 200),
  moderation_state  TEXT NOT NULL DEFAULT 'unscreened'
                    CHECK (moderation_state IN ('unscreened','clean','flagged','blocked')),
  moderation_labels JSONB,

  author_publicly_hidden BOOLEAN NOT NULL DEFAULT FALSE,

  consent_captured_at   TIMESTAMPTZ NOT NULL,
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at             TIMESTAMPTZ,
  edit_count            INTEGER NOT NULL DEFAULT 0 CHECK (edit_count <= 5),
  reviewed_at           TIMESTAMPTZ,
  reviewed_by_user_id   UUID REFERENCES auth.users(id),
  user_deleted_at       TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ONE column per guest per event (owner rule). Edit/resubmit/revive all
  -- UPDATE this same row through the submit RPC — never a second row.
  CONSTRAINT uq_guest_columns_author UNIQUE (event_id, guest_id),
  CONSTRAINT gcol_approved_needs_screen
    CHECK (status <> 'approved' OR moderation_state IN ('clean','flagged'))
);
-- No public_id column — the photo_messages / pabati_clips precedent for
-- guest-authored rows that never surface a shareable id.
CREATE INDEX IF NOT EXISTS guest_columns_queue_idx
  ON public.guest_columns (event_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS guest_columns_guest_idx ON public.guest_columns (guest_id);

COMMENT ON TABLE public.guest_columns IS
  'Guest Columns ("the paper") — one short guest op-ed per (event, guest); couple approves before publish; submissions close at the editorial lifecycle phase. Kwento (photo_messages) near-clone.';

ALTER TABLE public.guest_columns ENABLE ROW LEVEL SECURITY;

-- Reads: admin + couple/coordinator see ALL; other authenticated event members
-- see APPROVED only. Zero-account guests read their own row via the
-- service-role route (cookie-validated), public renders via the admin client.
DROP POLICY IF EXISTS guest_columns_member_read ON public.guest_columns;
CREATE POLICY guest_columns_member_read ON public.guest_columns FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = guest_columns.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
    OR (
      status = 'approved'
      AND event_id IN (SELECT public.current_event_ids())
    )
  );

-- Moderation updates (approve / decline / hide byline) — couple/coordinator/
-- admin. Column discipline lives in the server actions; the CHECK interlock is
-- the DB backstop.
DROP POLICY IF EXISTS guest_columns_moderate ON public.guest_columns;
CREATE POLICY guest_columns_moderate ON public.guest_columns FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = guest_columns.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR event_id IN (SELECT public.current_event_ids())
  );
-- NO INSERT policy — guest authoring goes ONLY through the service-role
-- submit RPC (zero-account guests have no auth.uid()).

-- ── guest_submit_column — the ONLY guest write path (service-role) ──────────
-- Tier-1 text moderation runs in TS BEFORE this call ('blocked' is rejected
-- inline and never inserted); this RPC owns the integrity rules: the block
-- lever (guest_message_blocks, shared with Kwento), the EDITORIAL-PHASE
-- cutoff, the per-guest advisory lock, the edit burst guard, and the
-- one-column-per-guest upsert with edit-resets-moderation.
--
-- EDITORIAL-PHASE CUTOFF (owner rule 2026-07-22/23): submissions close when
-- the lifecycle phase flips to 'editorial'. Mirrors getLifecyclePhase
-- (apps/web/lib/invitation-widgets.ts): phase = 'editorial' exactly when
-- NOW() is past the event-date midnight anchor + 8 hours (day-of-mode's
-- LIVE_WINDOW_END — 'post' starts at T+8h and maps to 'editorial', as does
-- every later instant). The midnight anchor is Asia/Manila civil time (the
-- PH-first canon, schedule_pools precedent) — the TS side anchors to the
-- viewer's local midnight, which for the PH audience is the same instant.
-- A NULL event_date = 'save_the_date' phase → submissions stay open.
-- Already-submitted columns REMAIN approvable after the cutoff — the
-- moderation path (RLS UPDATE) is untouched by this gate.
CREATE OR REPLACE FUNCTION public.guest_submit_column(
  p_guest_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_moderation_state TEXT,
  p_moderation_labels JSONB DEFAULT NULL
)
RETURNS SETOF public.guest_columns
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event UUID;
  v_event_date DATE;
  v_existing public.guest_columns%ROWTYPE;
BEGIN
  IF p_moderation_state NOT IN ('clean','flagged') THEN
    RAISE EXCEPTION 'gcol:invalid_state';
  END IF;
  IF p_title IS NULL OR char_length(trim(p_title)) < 1 OR char_length(trim(p_title)) > 60 THEN
    RAISE EXCEPTION 'gcol:invalid_title';
  END IF;
  IF p_body IS NULL OR char_length(trim(p_body)) < 1 OR char_length(trim(p_body)) > 280 THEN
    RAISE EXCEPTION 'gcol:invalid_body';
  END IF;

  SELECT g.event_id INTO v_event FROM public.guests g
    WHERE g.guest_id = p_guest_id AND g.deleted_at IS NULL;
  IF v_event IS NULL THEN RAISE EXCEPTION 'gcol:unknown_guest'; END IF;

  -- Block lever (shared with Kwento — one lever silences a hostile guest's
  -- words everywhere).
  IF EXISTS (
    SELECT 1 FROM public.guest_message_blocks b
    WHERE b.event_id = v_event AND b.guest_id = p_guest_id AND b.revoked_at IS NULL
  ) THEN RAISE EXCEPTION 'gcol:blocked'; END IF;

  -- Editorial-phase cutoff (see header comment). Gates NEW submissions AND
  -- edits — "submissions close" closes the whole authoring path; withdraw
  -- (RA 10173 takedown) and couple moderation stay open.
  SELECT e.event_date INTO v_event_date FROM public.events e WHERE e.event_id = v_event;
  IF v_event_date IS NOT NULL
     AND NOW() > (v_event_date::timestamp AT TIME ZONE 'Asia/Manila') + INTERVAL '8 hours' THEN
    RAISE EXCEPTION 'gcol:submissions_closed';
  END IF;

  -- Serialize this guest's submissions (upsert + burst are race-safe).
  PERFORM pg_advisory_xact_lock(hashtextextended('gcol:' || p_guest_id::text, 0));

  SELECT * INTO v_existing FROM public.guest_columns c
    WHERE c.event_id = v_event AND c.guest_id = p_guest_id;

  IF v_existing.id IS NULL THEN
    RETURN QUERY
      INSERT INTO public.guest_columns
        (event_id, guest_id, title, body_text,
         status, moderation_state, moderation_labels, consent_captured_at)
      VALUES
        (v_event, p_guest_id, trim(p_title), trim(p_body),
         'pending', p_moderation_state, p_moderation_labels, NOW())
      RETURNING *;
  ELSE
    -- Edit path — EDIT-UNTIL-APPROVED: an approved column is out of the
    -- guest's hands (withdraw first, then this path revives it). Rejected
    -- ("declined — returned to the guest") and user_deleted rows revive
    -- through this same UPDATE — that IS the decline-returns-it loop.
    -- (Deviation from kwento:deleted-is-terminal: a column is the guest's
    -- single slot, so a withdrawn/declined slot must be reusable.)
    IF v_existing.status = 'approved' THEN RAISE EXCEPTION 'gcol:already_published'; END IF;
    IF v_existing.edit_count >= 5 THEN RAISE EXCEPTION 'gcol:edit_limit'; END IF;
    -- Burst guard: one row per guest, so the kwento 3-per-60s row count can't
    -- work here — throttle rapid successive edits on the same row instead.
    IF v_existing.updated_at > NOW() - INTERVAL '20 seconds' THEN
      RAISE EXCEPTION 'gcol:burst';
    END IF;
    RETURN QUERY
      UPDATE public.guest_columns c SET
        title = trim(p_title),
        body_text = trim(p_body),
        status = 'pending',
        moderation_state = p_moderation_state,
        moderation_labels = p_moderation_labels,
        decline_note = NULL,
        edited_at = NOW(),
        edit_count = c.edit_count + 1,
        reviewed_at = NULL,
        reviewed_by_user_id = NULL,
        user_deleted_at = NULL,
        updated_at = NOW()
      WHERE c.id = v_existing.id
      RETURNING *;
  END IF;
END;
$$;

-- ── guest_withdraw_column — RA 10173 self-serve takedown (service-role) ─────
-- Works pre- AND post-approval, and stays open after the editorial cutoff
-- (a guest can always pull their own words). Instantly drops the column from
-- every public render (they all filter status='approved'). Returns TRUE only
-- when a row actually flipped — a FALSE lets the route report not_found
-- instead of a false success.
CREATE OR REPLACE FUNCTION public.guest_withdraw_column(p_guest_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event UUID;
  v_count INTEGER;
BEGIN
  SELECT g.event_id INTO v_event FROM public.guests g
    WHERE g.guest_id = p_guest_id AND g.deleted_at IS NULL;
  IF v_event IS NULL THEN RETURN FALSE; END IF;

  UPDATE public.guest_columns c SET
    status = 'user_deleted',
    user_deleted_at = NOW(),
    updated_at = NOW()
  WHERE c.event_id = v_event AND c.guest_id = p_guest_id
    AND c.status <> 'user_deleted';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

-- ── grants — service-role ONLY (the kwento tighter variant: the write path
-- carries authored guest PII, so no anon/authenticated execution at all) ─────
REVOKE ALL ON FUNCTION public.guest_submit_column(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guest_withdraw_column(UUID) FROM PUBLIC, anon, authenticated;

COMMIT;
