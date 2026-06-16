-- ============================================================================
-- 20261215000000_public_seat_lookup.sql
-- Seat-finding PR 1 — the FREE guest "find your seat" lookup.
--
-- Design tier-(a) baseline: a guest scans the shared/master venue QR (which
-- lands on /[slug]), taps "Find your seat", types their name, and sees their
-- table label. No app, no login, no paid SKU — the generic free finder that a
-- PH rival (RSVPMePls) gates behind a ₱8,995 plan. The richer personalized
-- entrance->table map stays the paid /[slug]/find-my-table surface.
--
-- Safety lives in the DB, not just the app (same posture as
-- get_vendor_seat_plan's published-gate + minimal-columns model):
--   * SECURITY DEFINER so an anon/public caller can read across THIS event's
--     guests without a per-guest RLS session — but the function returns ONLY
--     {display_name, table_label}; guest_id / qr_token / contact / meal never
--     cross.
--   * PUBLICATION GATE — nothing is searchable until the couple publishes the
--     seating pack (event_floor_plan.published_at IS NOT NULL). Drafts stay
--     invisible (mirrors the vendor viewer's published gate).
--   * MIN QUERY LENGTH (>= 2) + LIKE-wildcard escaping + LIMIT 25, so the
--     surface can't be used to dump the roster with '%' or a single char.
--   * Soft-deleted guests (deleted_at) excluded; only guests actually seated
--     at a table in THIS event are returned.
-- Wedding-only (event_type), matching every other guest-facing seating surface.
-- Additive + idempotent (CREATE OR REPLACE) — safe on a live DB; no table or
-- RLS changes.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.public_seat_lookup(p_slug TEXT, p_query TEXT)
RETURNS TABLE(display_name TEXT, table_label TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_query    TEXT;
BEGIN
  -- Anti-enumeration: refuse to answer a 0/1-char probe.
  v_query := btrim(COALESCE(p_query, ''));
  IF char_length(v_query) < 2 THEN
    RETURN;
  END IF;

  -- Escape LIKE wildcards so a typed '%' / '_' can't widen the match.
  v_query := replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_');

  -- Resolve the wedding by slug (case-insensitive, like every other slug read).
  SELECT e.event_id INTO v_event_id
  FROM public.events e
  WHERE e.slug ILIKE p_slug
    AND e.event_type = 'wedding'
  LIMIT 1;
  IF v_event_id IS NULL THEN
    RETURN;
  END IF;

  -- Publication gate — a draft plan is never searchable.
  IF NOT EXISTS (
    SELECT 1 FROM public.event_floor_plan fp
    WHERE fp.event_id = v_event_id AND fp.published_at IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(NULLIF(btrim(g.display_name), ''),
             btrim(g.first_name || ' ' || g.last_name))  AS display_name,
    t.table_label                                        AS table_label
  FROM public.guests g
  JOIN public.event_seat_assignments a
    ON a.guest_id = g.guest_id AND a.event_id = v_event_id
  JOIN public.event_tables t
    ON t.table_id = a.table_id AND t.event_id = v_event_id
  WHERE g.event_id = v_event_id
    AND g.deleted_at IS NULL
    AND COALESCE(NULLIF(btrim(g.display_name), ''),
                 btrim(g.first_name || ' ' || g.last_name))
        ILIKE '%' || v_query || '%' ESCAPE '\'
  ORDER BY 1
  LIMIT 25;
END;
$$;

REVOKE ALL ON FUNCTION public.public_seat_lookup(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_seat_lookup(TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.public_seat_lookup(TEXT, TEXT) IS
  'FREE guest seat finder (seat-finding PR 1): name->table_label for a PUBLISHED wedding seating pack. Public/anon-callable; returns ONLY {display_name, table_label}, never guest PII. Min query length 2, LIKE-escaped, published-gated, LIMIT 25.';

COMMIT;
