-- The guest's opt-in to being named had NO WRITER. Ruling 03, half-delivered.
--
-- PR #4180 added `guest_columns.author_named_publicly` and made every public
-- surface read it, so the DEFAULT half of the owner's ruling works: no guest is
-- named unless the column says so. But nothing anywhere could ever set it —
-- not a form field, not a server action, not an RPC parameter. So the other
-- half, "and let a guest choose to be named", was unreachable.
--
-- 🚨 THIS IS THE FOURTH TIME THIS EXACT SHAPE HAS SHIPPED HERE, and the first
-- time I did it myself while spending the same day fixing the other three
-- (`papic_face_mode`, `live_media_public`, the vendor venue picker). The repo
-- even has `gates-have-handles.test.ts` built to catch it — the new column was
-- never registered with it, so the guard passed without ever looking.
--
-- 🔑 THE RULE THAT WOULD HAVE CAUGHT IT: grep the column and ask whether EVERY
-- hit is a READ. Six hits, all reads.
--
-- The write path is a SECURITY DEFINER RPC — guests have no auth.uid(), so they
-- cannot write the row directly and the table's own policies only let the couple
-- or an admin update it. The opt-in therefore has to travel THROUGH this
-- function; there is no other door for a guest.

DROP FUNCTION IF EXISTS public.guest_submit_column(UUID, TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.guest_submit_column(
  p_guest_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_moderation_state TEXT,
  p_moderation_labels JSONB DEFAULT NULL,
  -- DPO ruling 2026-08-06: the guest's OWN opt-in to being named beside their
  -- published words. Defaults FALSE so any caller that has not been updated
  -- still produces an unnamed column — the ruling's safe direction.
  p_name_me BOOLEAN DEFAULT FALSE
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
         status, moderation_state, moderation_labels, consent_captured_at,
         author_named_publicly)
      VALUES
        (v_event, p_guest_id, trim(p_title), trim(p_body),
         'pending', p_moderation_state, p_moderation_labels, NOW(),
         COALESCE(p_name_me, FALSE))
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
        author_named_publicly = COALESCE(p_name_me, FALSE),
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

REVOKE ALL ON FUNCTION public.guest_submit_column(UUID, TEXT, TEXT, TEXT, JSONB, BOOLEAN)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.guest_submit_column(UUID, TEXT, TEXT, TEXT, JSONB, BOOLEAN) IS
  'Guest submits or edits their one column. p_name_me carries the guest''s own '
  'opt-in to a public byline (DPO ruling 2026-08-06); it defaults FALSE, and an '
  'EDIT may change it in either direction — a guest who asked to be named must be '
  'able to take that back, which is the same reason withdrawal stays open to them.';
