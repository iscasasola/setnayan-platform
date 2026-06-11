-- ============================================================================
-- 20261113000972_kwento_p0_photo_messages.sql
--
-- Kwento P0 — photo-anchored guest messages ("the story behind this moment").
-- Corpus: 0012_papic.md § Kwento. Owner-locked 2026-06-10: TEXT-ONLY V1 ·
-- FREE for every guest incl. zero-account Receivers · Live Wall captions are
-- ONE-TAP APPROVE only (no auto-publish, no hold-delay).
--
-- Corrections baked from later findings (already in the corpus):
--   * POLYMORPHIC anchor (source_table, source_id) over papic_photos |
--     papic_guest_captures — the corpus's photos(photo_id) FK was broken-on-
--     arrival (no such table). Matches shipped photo_tags / wall_feed.
--   * coordinator IS a real member_type — moderation authority is
--     member_type IN ('couple','coordinator'); no thread_join_authorizations.
--   * Zero-account guests carry a custom JWT (no auth.uid()) — guest WRITES
--     go through the service-role-only submit RPC; guest READS through the
--     audited guest_visible_messages RPC. No client-direct guest policy.
--   * print_consent defaults FALSE (fail-closed for the Kwento Magazine's
--     shareable edition until the consent string is amended).
--
-- DB-level interlocks (survive any buggy code path):
--   wall_needs_clean      wall_eligible      => moderation_state = 'clean'
--   approved_needs_screen status='approved'  => state IN ('clean','flagged')
-- ============================================================================

BEGIN;

-- ── photo_messages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.photo_messages (
  id                BIGSERIAL PRIMARY KEY,
  message_id        UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  source_table      TEXT NOT NULL CHECK (source_table IN ('papic_photos','papic_guest_captures')),
  source_id         UUID NOT NULL,
  guest_id          UUID NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,

  kind              TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text')),
  body_text         TEXT NOT NULL CHECK (char_length(body_text) BETWEEN 1 AND 280),
  prompt_text       TEXT,

  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','user_deleted')),
  moderation_state  TEXT NOT NULL DEFAULT 'unscreened'
                    CHECK (moderation_state IN ('unscreened','clean','flagged','blocked')),
  moderation_labels JSONB,

  wall_eligible          BOOLEAN NOT NULL DEFAULT FALSE,
  hide_from_wall         BOOLEAN NOT NULL DEFAULT FALSE,
  author_publicly_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  baked_into_render      BOOLEAN NOT NULL DEFAULT FALSE,
  print_consent          BOOLEAN NOT NULL DEFAULT FALSE,

  consent_captured_at   TIMESTAMPTZ NOT NULL,
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at             TIMESTAMPTZ,
  edit_count            INTEGER NOT NULL DEFAULT 0 CHECK (edit_count <= 3),
  reviewed_by_couple_at TIMESTAMPTZ,
  reviewed_by_user_id   UUID REFERENCES auth.users(id),
  user_deleted_at       TIMESTAMPTZ,
  hard_deleted_at       TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_photo_messages_author    UNIQUE (source_table, source_id, guest_id),
  CONSTRAINT wall_needs_clean            CHECK (wall_eligible = FALSE OR moderation_state = 'clean'),
  CONSTRAINT approved_needs_screen       CHECK (status <> 'approved' OR moderation_state IN ('clean','flagged'))
);
CREATE INDEX IF NOT EXISTS photo_messages_queue_idx
  ON public.photo_messages (event_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS photo_messages_guest_idx ON public.photo_messages (guest_id);
CREATE INDEX IF NOT EXISTS photo_messages_src_idx
  ON public.photo_messages (source_table, source_id);

ALTER TABLE public.photo_messages ENABLE ROW LEVEL SECURITY;

-- Reads: admin + couple/coordinator see ALL; other authenticated event
-- members see APPROVED only. Zero-account guests read via the RPC below.
DROP POLICY IF EXISTS photo_messages_member_read ON public.photo_messages;
CREATE POLICY photo_messages_member_read ON public.photo_messages FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = photo_messages.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
    OR (
      status = 'approved'
      AND event_id IN (SELECT public.current_event_ids())
    )
  );

-- Moderation updates (status / wall flags) — couple/coordinator/admin. The
-- column discipline lives in the server actions; the CHECK interlocks are the
-- DB backstop.
DROP POLICY IF EXISTS photo_messages_moderate ON public.photo_messages;
CREATE POLICY photo_messages_moderate ON public.photo_messages FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = photo_messages.event_id
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

-- ── guest_message_blocks — the per-(event,guest) block lever ────────────────
CREATE TABLE IF NOT EXISTS public.guest_message_blocks (
  id          BIGSERIAL PRIMARY KEY,
  block_id    UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  guest_id    UUID NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  blocked_by  UUID REFERENCES auth.users(id),
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ,
  CONSTRAINT uq_guest_message_block UNIQUE (event_id, guest_id)
);
ALTER TABLE public.guest_message_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guest_message_blocks_manage ON public.guest_message_blocks;
CREATE POLICY guest_message_blocks_manage ON public.guest_message_blocks FOR ALL
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = guest_message_blocks.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR event_id IN (SELECT public.current_event_ids())
  );

-- ── submit_photo_message — the ONLY guest write path (service-role) ─────────
-- Tier-1 text moderation runs in TS BEFORE this call ('blocked' is rejected
-- inline and never inserted); this RPC owns the integrity rules: anchor
-- validity, the block lever, the 10/event cap (rejected messages COUNT so
-- rejection throttles a bad actor), the 3-per-60s burst guard, and the
-- one-caption-per-(photo,guest) upsert with edit-resets-moderation.
CREATE OR REPLACE FUNCTION public.submit_photo_message(
  p_guest_id UUID,
  p_source_table TEXT,
  p_source_id UUID,
  p_body TEXT,
  p_prompt TEXT,
  p_moderation_state TEXT,
  p_moderation_labels JSONB DEFAULT NULL
)
RETURNS SETOF public.photo_messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event UUID;
  v_anchor_event UUID;
  v_existing public.photo_messages%ROWTYPE;
BEGIN
  IF p_moderation_state NOT IN ('clean','flagged') THEN
    RAISE EXCEPTION 'kwento:invalid_state';
  END IF;
  IF p_body IS NULL OR char_length(trim(p_body)) < 1 OR char_length(p_body) > 280 THEN
    RAISE EXCEPTION 'kwento:invalid_body';
  END IF;

  SELECT g.event_id INTO v_event FROM public.guests g
    WHERE g.guest_id = p_guest_id AND g.deleted_at IS NULL;
  IF v_event IS NULL THEN RAISE EXCEPTION 'kwento:unknown_guest'; END IF;

  -- Block lever.
  IF EXISTS (
    SELECT 1 FROM public.guest_message_blocks b
    WHERE b.event_id = v_event AND b.guest_id = p_guest_id AND b.revoked_at IS NULL
  ) THEN RAISE EXCEPTION 'kwento:blocked'; END IF;

  -- Anchor must exist and belong to the SAME event.
  IF p_source_table = 'papic_photos' THEN
    SELECT pp.event_id INTO v_anchor_event FROM public.papic_photos pp WHERE pp.photo_id = p_source_id;
  ELSIF p_source_table = 'papic_guest_captures' THEN
    SELECT gc.event_id INTO v_anchor_event FROM public.papic_guest_captures gc WHERE gc.capture_id = p_source_id;
  ELSE
    RAISE EXCEPTION 'kwento:invalid_anchor';
  END IF;
  IF v_anchor_event IS NULL OR v_anchor_event <> v_event THEN
    RAISE EXCEPTION 'kwento:invalid_anchor';
  END IF;

  -- Serialize this guest's submissions (cap + burst are race-safe).
  PERFORM pg_advisory_xact_lock(hashtextextended('kwento:' || p_guest_id::text, 0));

  -- Burst: max 3 per rolling 60s.
  IF (SELECT count(*) FROM public.photo_messages m
      WHERE m.guest_id = p_guest_id AND m.submitted_at > NOW() - INTERVAL '60 seconds') >= 3 THEN
    RAISE EXCEPTION 'kwento:burst';
  END IF;

  SELECT * INTO v_existing FROM public.photo_messages m
    WHERE m.source_table = p_source_table AND m.source_id = p_source_id
      AND m.guest_id = p_guest_id;

  IF v_existing.id IS NULL THEN
    -- Cap: 10 per event per guest (rejected/user_deleted included by design).
    IF (SELECT count(*) FROM public.photo_messages m
        WHERE m.event_id = v_event AND m.guest_id = p_guest_id) >= 10 THEN
      RAISE EXCEPTION 'kwento:cap';
    END IF;
    RETURN QUERY
      INSERT INTO public.photo_messages
        (event_id, source_table, source_id, guest_id, body_text, prompt_text,
         status, moderation_state, moderation_labels, consent_captured_at)
      VALUES
        (v_event, p_source_table, p_source_id, p_guest_id, p_body, p_prompt,
         'pending', p_moderation_state, p_moderation_labels, NOW())
      RETURNING *;
  ELSE
    -- Edit path: resets moderation + pulls wall eligibility (anti
    -- bait-and-switch); locked once baked into a render; max 3 edits.
    IF v_existing.baked_into_render THEN RAISE EXCEPTION 'kwento:baked'; END IF;
    IF v_existing.user_deleted_at IS NOT NULL THEN RAISE EXCEPTION 'kwento:deleted'; END IF;
    IF v_existing.edit_count >= 3 THEN RAISE EXCEPTION 'kwento:edit_limit'; END IF;
    RETURN QUERY
      UPDATE public.photo_messages m SET
        body_text = p_body,
        prompt_text = p_prompt,
        status = 'pending',
        moderation_state = p_moderation_state,
        moderation_labels = p_moderation_labels,
        wall_eligible = FALSE,
        edited_at = NOW(),
        edit_count = m.edit_count + 1,
        reviewed_by_couple_at = NULL,
        reviewed_by_user_id = NULL,
        updated_at = NOW()
      WHERE m.id = v_existing.id
      RETURNING *;
    -- An edited caption must leave the projection until re-approved.
    UPDATE public.wall_feed wf SET caption_text = NULL, caption_message_id = NULL
      WHERE wf.caption_message_id = v_existing.message_id;
  END IF;
END;
$$;

-- ── guest_visible_messages — the audited zero-account reader ───────────────
CREATE OR REPLACE FUNCTION public.guest_visible_messages(
  p_event_id UUID,
  p_guest_id UUID,
  p_mode TEXT
)
RETURNS SETOF public.photo_messages
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.* FROM public.photo_messages m
  WHERE m.event_id = p_event_id
    AND m.hard_deleted_at IS NULL
    AND (
      ( p_mode = 'mine' AND m.guest_id = p_guest_id AND m.user_deleted_at IS NULL )
      OR
      ( p_mode = 'public'
        AND m.status = 'approved'
        AND m.author_publicly_hidden = FALSE
        AND m.user_deleted_at IS NULL
        AND (
          (m.source_table = 'papic_photos' AND EXISTS (
            SELECT 1 FROM public.papic_photos pp
            WHERE pp.photo_id = m.source_id AND pp.hidden_at IS NULL))
          OR
          (m.source_table = 'papic_guest_captures' AND EXISTS (
            SELECT 1 FROM public.papic_guest_captures gc
            WHERE gc.capture_id = m.source_id AND gc.hidden_at IS NULL))
        )
      )
    )
  ORDER BY m.submitted_at ASC
  LIMIT 200;
$$;

-- ── wall_approve_caption / wall_clear_caption — the one-tap wall gate ───────
-- Owner-locked 2026-06-10: a caption reaches the projector ONLY on an
-- explicit couple/coordinator approve. The wall_needs_clean CHECK backstops a
-- mistap on a flagged message at the DB level.
CREATE OR REPLACE FUNCTION public.wall_approve_caption(p_message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_msg public.photo_messages%ROWTYPE;
BEGIN
  SELECT * INTO v_msg FROM public.photo_messages WHERE message_id = p_message_id;
  IF v_msg.id IS NULL THEN RETURN FALSE; END IF;

  IF NOT (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = v_msg.event_id AND em.user_id = auth.uid()
      AND em.member_type IN ('couple','coordinator')
  )) THEN
    RAISE EXCEPTION 'not authorized to moderate kwento';
  END IF;

  IF v_msg.moderation_state <> 'clean' THEN
    RAISE EXCEPTION 'kwento:not_clean';  -- flagged is NEVER wall-eligible
  END IF;

  UPDATE public.photo_messages SET
    status = CASE WHEN status = 'pending' THEN 'approved' ELSE status END,
    wall_eligible = TRUE,
    hide_from_wall = FALSE,
    reviewed_by_couple_at = NOW(),
    reviewed_by_user_id = auth.uid(),
    updated_at = NOW()
  WHERE id = v_msg.id;

  UPDATE public.wall_feed wf SET
    caption_text = v_msg.body_text,
    caption_message_id = v_msg.message_id
  WHERE wf.source_table = v_msg.source_table AND wf.source_id = v_msg.source_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.wall_clear_caption(p_message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_msg public.photo_messages%ROWTYPE;
BEGIN
  SELECT * INTO v_msg FROM public.photo_messages WHERE message_id = p_message_id;
  IF v_msg.id IS NULL THEN RETURN FALSE; END IF;

  IF NOT (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = v_msg.event_id AND em.user_id = auth.uid()
      AND em.member_type IN ('couple','coordinator')
  )) THEN
    RAISE EXCEPTION 'not authorized to moderate kwento';
  END IF;

  UPDATE public.photo_messages SET
    hide_from_wall = TRUE,
    wall_eligible = FALSE,
    updated_at = NOW()
  WHERE id = v_msg.id;

  UPDATE public.wall_feed wf SET caption_text = NULL, caption_message_id = NULL
    WHERE wf.caption_message_id = v_msg.message_id;

  RETURN TRUE;
END;
$$;

-- ── grants ──────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.submit_photo_message(UUID, TEXT, UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guest_visible_messages(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wall_approve_caption(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.wall_clear_caption(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wall_approve_caption(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wall_clear_caption(UUID) TO authenticated;

COMMIT;
