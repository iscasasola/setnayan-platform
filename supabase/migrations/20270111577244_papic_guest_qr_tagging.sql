-- ============================================================================
-- 20270111577244_papic_guest_qr_tagging.sql
-- Iteration 0012 Papic — scan-to-tag for the GUEST disposable camera.
--
-- The seat-capture surface already has scan-to-tag via papic_tag_capture
-- (20270108000000), but it's keyed on a SEAT claim token + auth.uid() — the
-- guest camera (apps/web/app/papic/guest) has neither: a guest is identified
-- only by the setnayan_guest_session cookie (no Supabase auth session), and
-- their shots land in papic_guest_captures, which the seat RPC can't target
-- (it hardcodes source_table='papic_photos'). So guest-camera photos had NO
-- tag path at all — QR or face. This migration adds the guest-side DEFINER RPC
-- so QR-scan tagging (the owner-confirmed fallback) works on BOTH cameras.
--
-- papic_tag_guest_capture(p_guest_id, p_capture_id, p_guest_token, p_table_ref):
--   * AUTH/OWNERSHIP — the capture must be the SHOOTER's own (papic_guest_captures
--     .guest_id = p_guest_id AND capture_id = p_capture_id AND not hidden). The
--     route validates the guest-session cookie and passes session.guest_id, then
--     calls this via the service-role client; the function trusts p_guest_id only
--     after confirming it owns the capture, so a guest can only tag THEIR shots.
--   * EVENT SCOPE — guest / table resolve ONLY within the capture's event_id
--     (wedding-scoped). A guest/table QR from another wedding never resolves.
--   * Individual QR  → tags ONE guest (source='individual_qr').
--   * Table QR       → fans out to seated guests, alphabetized, source='table_qr'.
--   * 10-TAG CAP per capture (corpus hard cap), alphabetized truncation on the
--     fan-out; the photo_tags cap trigger (20270110120000) backstops it too.
--   * UNTAGGED-STILL-DELIVERED — tagging is additive; nothing gates delivery.
--   * Idempotent re-scan of an already-tagged guest → no-op success.
--
-- Mirrors papic_tag_capture's guest/table resolution + cap logic exactly, but
-- keyed on guest-capture ownership instead of seat claim. Granted to
-- service_role ONLY (the route is the gate) — tighter than the seat RPC's
-- authenticated grant, since there's no auth.uid() backstop here.
--
-- Additive + idempotent (CREATE OR REPLACE). No table or RLS changes.
-- ============================================================================

BEGIN;

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
  v_cap             CONSTANT INT := 10;   -- max tags per capture (corpus hard cap)
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
  WHERE source_table = 'papic_guest_captures' AND source_id = p_capture_id;
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

REVOKE ALL ON FUNCTION public.papic_tag_guest_capture(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.papic_tag_guest_capture(UUID, UUID, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.papic_tag_guest_capture(UUID, UUID, TEXT, TEXT) IS
  'Papic scan-to-tag for the GUEST disposable camera (iteration 0012). A guest tags one of THEIR own papic_guest_captures with a guest QR (one guest) or a table QR (fan-out to seated guests). SECURITY DEFINER because photo_tags has no user-facing write policy; ownership is enforced by capture.guest_id = p_guest_id, and the route (which validated the guest-session cookie) is the gate — granted to service_role only. Event-scoped, 10-tag/capture cap with alphabetized truncation, idempotent re-scan. Returns a JSONB result the camera renders.';

COMMIT;
