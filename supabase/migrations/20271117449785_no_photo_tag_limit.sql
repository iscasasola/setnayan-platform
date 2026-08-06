-- 20271117449785_no_photo_tag_limit.sql
--
-- OWNER DECISION 2026-08-06: "no tag limit. we can tag as many."
-- Supersedes the 20-tag lock of 2026-07-23 (which itself superseded a 10-tag
-- lock of 2026-06-17). There is no longer a PRODUCT limit on how many guests
-- may be tagged in one photo.
--
-- WHAT WAS ACTUALLY BROKEN, and why this matters more than a number change:
-- the two capture screens hardcoded 10 while these functions had allowed 20
-- since 2026-07-23. So a paparazzo was stopped at HALF the real limit and told
-- "that's the max" — the owner's own decision never reached the screen. Both
-- the UI numbers and the server ceiling are removed in the same change.
--
-- ⚠ WHY A CEILING STILL EXISTS IN CODE, AT 100000:
-- It is NOT a product rule and no real photo can approach it — a crowded
-- wedding shot has tens of faces, not tens of thousands. It exists solely so a
-- runaway writer (a retry storm, a loop bug, a hostile client replaying a table
-- scan) cannot append unbounded rows to one photo's tag list. Removing the
-- trigger entirely would leave photo_tags with no backstop of any kind. If the
-- owner wants that too, delete enforce_photo_tag_cap() — but the honest guard
-- against abuse is a rate limit on the RPC, not a per-photo count.
--
-- Idempotent: every statement is CREATE OR REPLACE.

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
  ) >= 100000 THEN
    RETURN NULL; -- at cap: skip this tag silently (truncate, never error)
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_photo_tag_cap() IS
  'Runaway-write backstop for photo_tags, NOT a product limit. Owner removed the per-photo tag limit 2026-08-06 ("no tag limit. we can tag as many"), superseding the 20-cap of 2026-07-23 and the 10-cap of 2026-06-17. The 100000 ceiling exists only so a retry storm or loop bug cannot append unbounded rows to one photo; no real photo approaches it. Counts removed_at IS NULL only.';

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
  v_cap             CONSTANT INT := 100000; -- runaway-write backstop, NOT a product limit
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
  v_cap             CONSTANT INT := 100000; -- runaway-write backstop, NOT a product limit
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
