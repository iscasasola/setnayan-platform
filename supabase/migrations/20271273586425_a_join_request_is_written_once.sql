-- ═══════════════════════════════════════════════════════════════════════════
-- A JOIN REQUEST IS WRITTEN ONCE — event day, no double records (L1·3)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 🪤 WHAT WAS WRONG. The ask-to-join door (`createJoinRequest`,
-- apps/web/app/join/[eventId]/actions.ts) inserted a `self_added_unlisted`
-- guest row and told the couple "Someone asked to join". Nothing stopped the
-- same form arriving twice — a double tap, a retry after the redirect was lost
-- on venue signal, the back button — so the couple got two requests and two
-- notices for one person. The per-event sanity ceiling (`SELF_JOIN_CEILING`)
-- was a COUNT read in the app and an INSERT after it: a rush at the door could
-- pass it together.
--
-- ✅ THE FIX — one writer, under one lock, keyed by the FORM:
--   1. the request form carries `request_key`, a random id minted when the form
--      is drawn; every resubmission of that same form carries the same id;
--   2. `guests.join_request_key` + UNIQUE (event_id, join_request_key);
--   3. `guest_join_request_create` takes `pg_advisory_xact_lock` on the EVENT,
--      returns the request already written under this key (`created: false` —
--      the app then updates its answers and sends NO second notice), counts the
--      event's live requests INSIDE the lock against the ceiling the app passes,
--      and only then inserts.
--
-- ⚖ WHY THE FORM'S KEY AND NOT THE NAME (+ MOBILE). The door's own rule is "A
-- NAME IS NOT A SECRET" (DECISION_LOG 2026-09-26): merging two requests because
-- they share a typed name — or a typed name and a number anyone could know —
-- would hand the second person the first person's pending ticket, which unlocks
-- when the couple accepts. A random key minted into the form only one browser
-- holds cannot be guessed, so it dedupes the double tap and nothing else.
-- (A signed-in asker is also deduped by their account, as before.)
--
-- 🔒 service_role only — the two join server actions are the callers.

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS join_request_key UUID;

COMMENT ON COLUMN public.guests.join_request_key IS
  'The random key minted into the ask-to-join form when it was drawn. A resubmission of the same form carries the same key and is answered with this row, never a second request (event-day L1·3, 20271273586425). NULL on every other row.';

CREATE UNIQUE INDEX IF NOT EXISTS guests_join_request_key_uniq
  ON public.guests (event_id, join_request_key)
  WHERE join_request_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guest_join_request_create(
  p_event_id    UUID,
  p_request_key UUID,
  p_ceiling     INTEGER,
  p_row         JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $join$
DECLARE
  r       public.guests%ROWTYPE;
  v_prior UUID;
  v_live  INTEGER;
  v_new   UUID;
BEGIN
  IF p_event_id IS NULL OR p_row IS NULL THEN
    RETURN jsonb_build_object('status', 'missing_input');
  END IF;

  -- One event's requests are written one at a time: the repeat and the ceiling
  -- are both asked inside this lock, so neither can be raced past.
  PERFORM pg_advisory_xact_lock(hashtextextended('guest_join_request:' || p_event_id::text, 0));

  IF p_request_key IS NOT NULL THEN
    SELECT guest_id INTO v_prior
      FROM public.guests
     WHERE event_id = p_event_id
       AND join_request_key = p_request_key
       AND entry_source = 'self_added_unlisted'
       AND deleted_at IS NULL;
    IF v_prior IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'ok', 'guest_id', v_prior, 'created', false);
    END IF;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_live
    FROM public.guests
   WHERE event_id = p_event_id
     AND entry_source = 'self_added_unlisted'
     AND deleted_at IS NULL;
  IF v_live >= GREATEST(COALESCE(p_ceiling, 0), 0) THEN
    RETURN jsonb_build_object('status', 'ceiling', 'live', v_live);
  END IF;

  r := jsonb_populate_record(NULL::public.guests, p_row);

  INSERT INTO public.guests (
    event_id, first_name, last_name, name_prefix, middle_name, name_suffix,
    side, group_category, role, entry_source, email,
    rsvp_status, rsvp_responded_at, meal_preference, dietary_restrictions, guest_note,
    mobile, notes, updated_at,
    photo_url, photo_source, photo_updated_at, photo_set_by_user_id,
    join_request_key
  )
  VALUES (
    p_event_id, r.first_name, r.last_name, r.name_prefix, r.middle_name, r.name_suffix,
    COALESCE(r.side, 'both'), COALESCE(r.group_category, 'other'), COALESCE(r.role, 'guest'),
    'self_added_unlisted', r.email,
    COALESCE(r.rsvp_status, 'pending'), r.rsvp_responded_at, r.meal_preference, r.dietary_restrictions, r.guest_note,
    r.mobile, r.notes, COALESCE(r.updated_at, now()),
    r.photo_url, r.photo_source, r.photo_updated_at, r.photo_set_by_user_id,
    p_request_key
  )
  RETURNING guest_id INTO v_new;

  RETURN jsonb_build_object('status', 'ok', 'guest_id', v_new, 'created', true);
END;
$join$;

COMMENT ON FUNCTION public.guest_join_request_create(UUID, UUID, INTEGER, JSONB) IS
  'Write one ask-to-join request (a self_added_unlisted guest row) under an advisory lock on the event: a request already written under this form''s key is returned (created=false), and the event''s live requests are counted against p_ceiling inside the lock (status=ceiling). service_role only.';

REVOKE ALL ON FUNCTION public.guest_join_request_create(UUID, UUID, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_join_request_create(UUID, UUID, INTEGER, JSONB) TO service_role;
