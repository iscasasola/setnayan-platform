-- 20270916200000_photo_tag_cap_20_live_only.sql
--
-- Owner decisions 2026-07-23 (corpus DECISION_LOG):
--  1. CAP RAISED 10 → 20 tags per photo ("20 — maximum generosity": covers
--     12-seat banquet rounds, king/long tables, and big group shots; supersedes
--     the 2026-05-09/2026-06-17 locked 10).
--  2. GHOST FIX: the cap now counts LIVE tags only (AND removed_at IS NULL).
--     Previously every "Not me" tombstone (20270131081062) permanently burned a
--     cap slot — a photo with 10 removals silently rejected ALL future tags.
--     Found by the pool-gallery build study (OnTheDay_App_Build_Studies_2026-07-23).
--
-- Three definitions updated IN LOCKSTEP so trigger and RPC pre-checks agree:
--  • enforce_photo_tag_cap()      — the DB-invariant backstop trigger
--  • papic_tag_capture()          — paparazzo QR tagging (20270108000000)
--  • papic_tag_guest_capture()    — guest-camera QR tagging (20270111577244)
-- The RPC bodies below are verbatim copies of their canonical definitions with
-- exactly two deltas each: v_cap 10→20 and the live-only count filter. The
-- "already tagged" idempotency checks deliberately still see tombstones (a
-- host/guest-removed tag must NOT be silently re-added by a re-scan — the
-- tombstone-is-the-gravestone rule from 20270131081062). CREATE OR REPLACE
-- preserves existing GRANTs. Auto-apply safe: only widens acceptance.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_photo_tag_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (
    SELECT count(*) FROM public.photo_tags
    WHERE source_table = NEW.source_table
      AND source_id = NEW.source_id
      AND removed_at IS NULL   -- live tags only: tombstones never burn slots
  ) >= 20 THEN
    RETURN NULL; -- at cap: skip this tag silently (truncate, never error)
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_photo_tag_cap() IS
  'Backstops the 20-LIVE-tags-per-photo cap (per (source_table, source_id)) across ALL writers of photo_tags. Counts removed_at IS NULL only — tombstoned tags never consume slots. At cap, silently skips the over-cap row (truncate). Owner: cap 10→20 + live-only count 2026-07-23 (supersedes the 2026-06-17 lock).';

CREATE OR REPLACE FUNCTION public.papic_tag_capture(
  p_token       TEXT,
  p_photo_id    UUID,
  p_guest_token TEXT DEFAULT NULL,
  p_table_ref   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap             CONSTANT INT := 20;   -- max tags per photo (corpus hard cap)
  v_seat_id         UUID;
  v_event_id        UUID;
  v_current         INT;
  v_remaining       INT;
  v_guest_id        UUID;
  v_name            TEXT;
  v_table_id        UUID;
  v_table_label     TEXT;
  v_total_at_table  INT;
  v_candidate_count INT;
  v_added           INT;
  v_names           JSONB;
BEGIN
  -- AUTH: the seat is the capability. Resolve it ONLY when the caller is its
  -- claimer and it isn't revoked — this single read is both lookup + authz.
  SELECT s.seat_id, s.event_id
    INTO v_seat_id, v_event_id
  FROM public.paparazzi_seats s
  WHERE s.claim_qr_token = btrim(COALESCE(p_token, ''))
    AND s.claimer_user_id = auth.uid()
    AND s.revoked_at IS NULL
  LIMIT 1;

  IF v_seat_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_your_seat');
  END IF;

  -- OWNERSHIP: the photo must be one of THIS seat's captures.
  PERFORM 1
  FROM public.papic_photos p
  WHERE p.photo_id = p_photo_id
    AND p.paparazzi_seat_id = v_seat_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_your_photo');
  END IF;

  SELECT count(*) INTO v_current
  FROM public.photo_tags
  WHERE source_table = 'papic_photos' AND source_id = p_photo_id
    AND removed_at IS NULL;
  v_remaining := v_cap - v_current;

  -- ---- Individual QR → one guest -------------------------------------------
  IF p_guest_token IS NOT NULL AND btrim(p_guest_token) <> '' THEN
    SELECT g.guest_id,
           COALESCE(NULLIF(btrim(g.display_name), ''),
                    btrim(g.first_name || ' ' || g.last_name))
      INTO v_guest_id, v_name
    FROM public.guests g
    WHERE g.event_id = v_event_id
      AND lower(g.qr_token) = lower(btrim(p_guest_token))
      AND g.deleted_at IS NULL
    LIMIT 1;

    IF v_guest_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'guest_not_found');
    END IF;

    -- Already on this photo — a no-op success (idempotent re-scan).
    IF EXISTS (
      SELECT 1 FROM public.photo_tags
      WHERE source_table = 'papic_photos' AND source_id = p_photo_id
        AND guest_id = v_guest_id
    ) THEN
      RETURN jsonb_build_object(
        'ok', true, 'kind', 'guest', 'added', 0, 'already', true,
        'names', jsonb_build_array(v_name),
        'tag_count', v_current, 'cap_reached', v_current >= v_cap
      );
    END IF;

    IF v_remaining < 1 THEN
      RETURN jsonb_build_object(
        'ok', false, 'error', 'cap_reached', 'tag_count', v_current
      );
    END IF;

    INSERT INTO public.photo_tags (event_id, source_table, source_id, guest_id, source)
    VALUES (v_event_id, 'papic_photos', p_photo_id, v_guest_id, 'individual_qr')
    ON CONFLICT (source_table, source_id, guest_id) DO NOTHING;

    RETURN jsonb_build_object(
      'ok', true, 'kind', 'guest', 'added', 1,
      'names', jsonb_build_array(v_name),
      'tag_count', v_current + 1, 'cap_reached', (v_current + 1) >= v_cap
    );
  END IF;

  -- ---- Table QR → fan out to seated guests (cap-aware, alphabetized) --------
  IF p_table_ref IS NOT NULL AND btrim(p_table_ref) <> '' THEN
    SELECT t.table_id, t.table_label
      INTO v_table_id, v_table_label
    FROM public.event_tables t
    WHERE t.event_id = v_event_id
      AND (
        upper(t.public_id) = upper(btrim(p_table_ref))
        OR lower(t.qr_token) = lower(btrim(p_table_ref))
      )
    LIMIT 1;

    IF v_table_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'table_not_found');
    END IF;

    WITH seated AS (
      SELECT g.guest_id,
             COALESCE(NULLIF(btrim(g.display_name), ''),
                      btrim(g.first_name || ' ' || g.last_name)) AS name
      FROM public.event_seat_assignments a
      JOIN public.guests g
        ON g.guest_id = a.guest_id
       AND g.deleted_at IS NULL
      WHERE a.event_id = v_event_id
        AND a.table_id = v_table_id
    ),
    candidates AS (
      -- Guests not already tagged on this photo, alphabetized; the cap then
      -- truncates the tail (corpus: "alphabetize … and truncate").
      SELECT s.guest_id, s.name,
             row_number() OVER (ORDER BY s.name, s.guest_id) AS rn
      FROM seated s
      WHERE NOT EXISTS (
        SELECT 1 FROM public.photo_tags pt
        WHERE pt.source_table = 'papic_photos'
          AND pt.source_id = p_photo_id
          AND pt.guest_id = s.guest_id
      )
    ),
    to_add AS (
      SELECT guest_id, name FROM candidates WHERE rn <= GREATEST(v_remaining, 0)
    ),
    ins AS (
      INSERT INTO public.photo_tags (event_id, source_table, source_id, guest_id, source)
      SELECT v_event_id, 'papic_photos', p_photo_id, guest_id, 'table_qr'
      FROM to_add
      ON CONFLICT (source_table, source_id, guest_id) DO NOTHING
      RETURNING guest_id
    )
    SELECT
      (SELECT count(*)::int FROM seated),
      (SELECT count(*)::int FROM candidates),
      (SELECT count(*)::int FROM ins),
      (SELECT COALESCE(jsonb_agg(name ORDER BY name), '[]'::jsonb) FROM to_add)
    INTO v_total_at_table, v_candidate_count, v_added, v_names;

    RETURN jsonb_build_object(
      'ok', true, 'kind', 'table', 'table_label', v_table_label,
      'added', v_added, 'names', v_names,
      'total_at_table', v_total_at_table,
      'truncated', (v_candidate_count > GREATEST(v_remaining, 0)),
      'tag_count', v_current + v_added,
      'cap_reached', (v_current + v_added) >= v_cap
    );
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'no_target');
END;
$$;

CREATE OR REPLACE FUNCTION public.papic_tag_guest_capture(
  p_guest_id    UUID,
  p_capture_id  UUID,
  p_guest_token TEXT DEFAULT NULL,
  p_table_ref   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap             CONSTANT INT := 20;   -- max tags per capture (corpus hard cap)
  v_event_id        UUID;
  v_current         INT;
  v_remaining       INT;
  v_guest_id        UUID;
  v_name            TEXT;
  v_table_id        UUID;
  v_table_label     TEXT;
  v_total_at_table  INT;
  v_candidate_count INT;
  v_added           INT;
  v_names           JSONB;
BEGIN
  -- AUTH/OWNERSHIP: resolve the capture ONLY when it is the shooter's own and
  -- not hidden. This single read is both lookup + authz (the route already
  -- validated the cookie that yields p_guest_id).
  SELECT c.event_id
    INTO v_event_id
  FROM public.papic_guest_captures c
  WHERE c.capture_id = p_capture_id
    AND c.guest_id = p_guest_id
    AND c.hidden_at IS NULL
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_your_photo');
  END IF;

  SELECT count(*) INTO v_current
  FROM public.photo_tags
  WHERE source_table = 'papic_guest_captures' AND source_id = p_capture_id
    AND removed_at IS NULL;
  v_remaining := v_cap - v_current;

  -- ---- Individual QR → one guest -------------------------------------------
  IF p_guest_token IS NOT NULL AND btrim(p_guest_token) <> '' THEN
    SELECT g.guest_id,
           COALESCE(NULLIF(btrim(g.display_name), ''),
                    btrim(g.first_name || ' ' || g.last_name))
      INTO v_guest_id, v_name
    FROM public.guests g
    WHERE g.event_id = v_event_id
      AND lower(g.qr_token) = lower(btrim(p_guest_token))
      AND g.deleted_at IS NULL
    LIMIT 1;

    IF v_guest_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'guest_not_found');
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.photo_tags
      WHERE source_table = 'papic_guest_captures' AND source_id = p_capture_id
        AND guest_id = v_guest_id
    ) THEN
      RETURN jsonb_build_object(
        'ok', true, 'kind', 'guest', 'added', 0, 'already', true,
        'names', jsonb_build_array(v_name),
        'tag_count', v_current, 'cap_reached', v_current >= v_cap
      );
    END IF;

    IF v_remaining < 1 THEN
      RETURN jsonb_build_object(
        'ok', false, 'error', 'cap_reached', 'tag_count', v_current
      );
    END IF;

    INSERT INTO public.photo_tags (event_id, source_table, source_id, guest_id, source)
    VALUES (v_event_id, 'papic_guest_captures', p_capture_id, v_guest_id, 'individual_qr')
    ON CONFLICT (source_table, source_id, guest_id) DO NOTHING;

    RETURN jsonb_build_object(
      'ok', true, 'kind', 'guest', 'added', 1,
      'names', jsonb_build_array(v_name),
      'tag_count', v_current + 1, 'cap_reached', (v_current + 1) >= v_cap
    );
  END IF;

  -- ---- Table QR → fan out to seated guests (cap-aware, alphabetized) --------
  IF p_table_ref IS NOT NULL AND btrim(p_table_ref) <> '' THEN
    SELECT t.table_id, t.table_label
      INTO v_table_id, v_table_label
    FROM public.event_tables t
    WHERE t.event_id = v_event_id
      AND (
        upper(t.public_id) = upper(btrim(p_table_ref))
        OR lower(t.qr_token) = lower(btrim(p_table_ref))
      )
    LIMIT 1;

    IF v_table_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'table_not_found');
    END IF;

    WITH seated AS (
      SELECT g.guest_id,
             COALESCE(NULLIF(btrim(g.display_name), ''),
                      btrim(g.first_name || ' ' || g.last_name)) AS name
      FROM public.event_seat_assignments a
      JOIN public.guests g
        ON g.guest_id = a.guest_id
       AND g.deleted_at IS NULL
      WHERE a.event_id = v_event_id
        AND a.table_id = v_table_id
    ),
    candidates AS (
      SELECT s.guest_id, s.name,
             row_number() OVER (ORDER BY s.name, s.guest_id) AS rn
      FROM seated s
      WHERE NOT EXISTS (
        SELECT 1 FROM public.photo_tags pt
        WHERE pt.source_table = 'papic_guest_captures'
          AND pt.source_id = p_capture_id
          AND pt.guest_id = s.guest_id
      )
    ),
    to_add AS (
      SELECT guest_id, name FROM candidates WHERE rn <= GREATEST(v_remaining, 0)
    ),
    ins AS (
      INSERT INTO public.photo_tags (event_id, source_table, source_id, guest_id, source)
      SELECT v_event_id, 'papic_guest_captures', p_capture_id, guest_id, 'table_qr'
      FROM to_add
      ON CONFLICT (source_table, source_id, guest_id) DO NOTHING
      RETURNING guest_id
    )
    SELECT
      (SELECT count(*)::int FROM seated),
      (SELECT count(*)::int FROM candidates),
      (SELECT count(*)::int FROM ins),
      (SELECT COALESCE(jsonb_agg(name ORDER BY name), '[]'::jsonb) FROM to_add)
    INTO v_total_at_table, v_candidate_count, v_added, v_names;

    RETURN jsonb_build_object(
      'ok', true, 'kind', 'table', 'table_label', v_table_label,
      'added', v_added, 'names', v_names,
      'total_at_table', v_total_at_table,
      'truncated', (v_candidate_count > GREATEST(v_remaining, 0)),
      'tag_count', v_current + v_added,
      'cap_reached', (v_current + v_added) >= v_cap
    );
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'no_target');
END;
$$;

COMMIT;
