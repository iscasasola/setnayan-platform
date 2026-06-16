-- ============================================================================
-- 20270108000000_papic_qr_tagging.sql
-- Iteration 0012 Papic — the scan-to-tag leg of the capture pipeline.
--
-- The seat-capture surface (apps/web/app/papic/seat/[token]) lets a claimed
-- paparazzo shoot photos + clips into papic_photos, but there was no way to
-- record WHO is in a shot. The photo_tags table shipped with the Live Photo
-- Wall schema (20261104000959) with reads for couple/coordinator/admin and
-- WRITES intentionally locked to "service-role / DEFINER RPC" — a paparazzo is
-- neither a couple member nor an admin, so a direct INSERT is (correctly) RLS-
-- blocked. This migration adds that DEFINER RPC.
--
-- papic_tag_capture(p_token, p_photo_id, p_guest_token, p_table_ref):
--   * AUTH — resolves the seat by its claim token AND claimer_user_id = auth.uid()
--     AND revoked_at IS NULL. A non-claimer (or revoked seat) gets 'not_your_seat'.
--     auth.uid() reads the caller's JWT even under SECURITY DEFINER, so the
--     definer's elevated rights never widen WHO can tag.
--   * OWNERSHIP — the photo must belong to that seat (a claimer can only tag
--     their own captures), so a claimer can't tag another crew's photo.
--   * EVENT SCOPE — guest / table are resolved ONLY within the seat's event_id
--     (wedding-scoped, corpus constraint). A guest/table QR from another wedding
--     never resolves.
--   * Individual QR  → tags ONE guest (source='individual_qr').
--   * Table QR       → fans out to every guest SEATED at that table
--     (event_seat_assignments), alphabetized, source='table_qr'.
--   * 10-TAG CAP per photo (corpus hard constraint: "Max 10 tags per photo,
--     combined individual + table"). A table fan-out that would exceed the cap
--     is truncated alphabetically and the RPC returns truncated=true so the
--     capture UI can warn the paparazzo (corpus pitfall #3).
--   * UNTAGGED-STILL-DELIVERED — tagging is purely additive; nothing here gates
--     a photo's delivery. An un-tagged photo already lands in the couple's
--     gallery (the capture pipeline owns that), so a failed/skipped tag is
--     harmless.
--
-- The table QR resolves by EITHER public_id (what the seating print pack's
-- table sign encodes today: `?t=<S89T-…>`) OR qr_token (the 32-hex token the
-- 20261101000000 publish-QR migration reserved for this fan-out) — so the RPC
-- works against signs already at a venue regardless of which the couple printed.
--
-- Downstream: a written tag feeds (a) the couple gallery's per-photo tag chips
-- (lib/papic-gallery.ts) and (b) each tagged guest's live "photos of you" feed
-- (lib/guest-live-gallery.ts) — both already read photo_tags. The NSFW screen
-- still gates visibility (moderation_state='clean'); tagging doesn't bypass it.
--
-- Additive + idempotent (CREATE OR REPLACE). No table or RLS changes.
-- ============================================================================

BEGIN;

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
  v_cap             CONSTANT INT := 10;   -- max tags per photo (corpus hard cap)
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
  WHERE source_table = 'papic_photos' AND source_id = p_photo_id;
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

REVOKE ALL ON FUNCTION public.papic_tag_capture(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.papic_tag_capture(TEXT, UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.papic_tag_capture(TEXT, UUID, TEXT, TEXT) IS
  'Papic scan-to-tag (iteration 0012). A claimed paparazzo tags one of THEIR captures with a guest QR (one guest) or a table QR (fan-out to seated guests). SECURITY DEFINER because photo_tags has no user-facing write policy; auth.uid() + the seat claim token still gate WHO can tag. Event-scoped, 10-tag/photo cap with alphabetized truncation, idempotent re-scan. Returns a JSONB result the capture UI renders.';

COMMIT;
