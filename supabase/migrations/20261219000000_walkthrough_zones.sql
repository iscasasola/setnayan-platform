-- ============================================================================
-- 20261219000000_walkthrough_zones.sql
-- Seat-finding PR 6 — zone walkthrough video (the "first-person walk to your
-- table" the market ships NOWHERE).
--
-- A coordinator — OR a no-coordinator couple's delegated DIY helper — records a
-- short first-person clip walking from the entrance to a CLUSTER of tables
-- ("Garden side", "Near the stage"), uploads it, and tags the tables that live
-- in that zone. A guest who finds their seat on the FREE /[slug]/find-seat then
-- gets a "Watch the walk to your table" clip for their table's zone.
--
-- Packaging (owner 2026-06-13): the walkthrough is COORDINATOR LABOR, never a
-- Setnayan SKU — Setnayan only provides the tool, and it MUST stay delegatable
-- so a no-coordinator couple does it free (dual-path parity). So this surface is
-- writable by the couple AND a seat_plan-edit delegate; pricing/gating is parked
-- for the holistic pricing pass (built ungated = free wayfinding default).
--
-- Two additive parts + one function replace:
--   1. event_walkthrough_zones — one row per named zone, holds the clip.
--   2. event_tables.walkthrough_zone_id — which zone a table belongs to.
--   3. public_seat_lookup() gains the published clip for the matched table's
--      zone (LEFT JOIN; guests with no zone clip see exactly today's result).
-- RLS mirrors event_tables: couple (current_couple_event_ids) + coordinator
-- delegate (moderator_area_level(...,'seat_plan')='edit'). The guest read is the
-- SECURITY DEFINER RPC only — the table itself is never anon-readable.
-- ============================================================================

BEGIN;

-- 1 · Zones -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_walkthrough_zones (
  zone_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  label               TEXT NOT NULL,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  -- r2://setnayan-media/zone-walkthroughs/... — null until a clip is recorded.
  video_r2_key        TEXT,
  video_mime_type     TEXT,
  duration_seconds    INTEGER,
  poster_r2_key       TEXT,
  uploaded_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Only a zone WITH a video AND a published_at shows to guests.
  published_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_walkthrough_zones_event_idx
  ON public.event_walkthrough_zones(event_id, sort_order);

ALTER TABLE public.event_walkthrough_zones ENABLE ROW LEVEL SECURITY;

-- Couple owns the zones (mirror event_tables_couple_*).
DROP POLICY IF EXISTS event_walkthrough_zones_couple_read ON public.event_walkthrough_zones;
CREATE POLICY event_walkthrough_zones_couple_read
  ON public.event_walkthrough_zones FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_walkthrough_zones_couple_write ON public.event_walkthrough_zones;
CREATE POLICY event_walkthrough_zones_couple_write
  ON public.event_walkthrough_zones FOR ALL TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

-- Coordinator delegate with seat_plan='edit' (a DIY helper is exactly this).
DROP POLICY IF EXISTS event_walkthrough_zones_moderator_read ON public.event_walkthrough_zones;
CREATE POLICY event_walkthrough_zones_moderator_read
  ON public.event_walkthrough_zones FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_moderator_event_ids()));

DROP POLICY IF EXISTS event_walkthrough_zones_moderator_write ON public.event_walkthrough_zones;
CREATE POLICY event_walkthrough_zones_moderator_write
  ON public.event_walkthrough_zones FOR ALL TO authenticated
  USING (public.moderator_area_level(event_id, 'seat_plan') = 'edit')
  WITH CHECK (public.moderator_area_level(event_id, 'seat_plan') = 'edit');

-- 2 · Table → zone tag --------------------------------------------------------
-- Nullable: a table with no zone simply has no clip (the finder degrades to
-- today's table-label-only result). ON DELETE SET NULL so dropping a zone never
-- cascades into the seating. The existing event_tables couple/moderator FOR-ALL
-- policies already cover writes to this column.

ALTER TABLE public.event_tables
  ADD COLUMN IF NOT EXISTS walkthrough_zone_id UUID
    REFERENCES public.event_walkthrough_zones(zone_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS event_tables_walkthrough_zone_idx
  ON public.event_tables(walkthrough_zone_id)
  WHERE walkthrough_zone_id IS NOT NULL;

-- 3 · public_seat_lookup gains the zone clip ----------------------------------
-- Adding return columns changes the function's return type, which CREATE OR
-- REPLACE cannot do — DROP + CREATE (re-REVOKE/GRANT after). All existing
-- guards (min-len, LIKE-escape, published-gate, minimal columns, LIMIT 25) are
-- preserved verbatim; the only change is the LEFT JOIN to the published zone
-- clip for the matched table. walk_video_key is the stored r2:// ref — the
-- /api/seat-lookup route presigns it to a short-lived GET URL (the table itself
-- never goes anon-readable).

DROP FUNCTION IF EXISTS public.public_seat_lookup(TEXT, TEXT);

CREATE FUNCTION public.public_seat_lookup(p_slug TEXT, p_query TEXT)
RETURNS TABLE(
  display_name    TEXT,
  table_label     TEXT,
  walk_zone_label TEXT,
  walk_video_key  TEXT
)
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
    t.table_label                                        AS table_label,
    z.label                                              AS walk_zone_label,
    z.video_r2_key                                       AS walk_video_key
  FROM public.guests g
  JOIN public.event_seat_assignments a
    ON a.guest_id = g.guest_id AND a.event_id = v_event_id
  JOIN public.event_tables t
    ON t.table_id = a.table_id AND t.event_id = v_event_id
  LEFT JOIN public.event_walkthrough_zones z
    ON z.zone_id = t.walkthrough_zone_id
    AND z.event_id = v_event_id
    AND z.published_at IS NOT NULL
    AND z.video_r2_key IS NOT NULL
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
  'FREE guest seat finder (seat-finding PR 1 + zone clip PR 6): name->{table_label, optional published zone-walkthrough video} for a PUBLISHED wedding seating pack. Public/anon-callable; returns NO guest PII. Min query length 2, LIKE-escaped, published-gated, LIMIT 25. walk_video_key is an r2:// ref the route presigns.';

COMMENT ON TABLE public.event_walkthrough_zones IS
  'Seat-finding PR 6 — coordinator/DIY-recorded first-person walkthrough clips, one per named table-cluster zone. Coordinator LABOR (not a Setnayan SKU); writable by couple + seat_plan-edit delegate. Guests see only a PUBLISHED zone''s clip, via public_seat_lookup.';

COMMIT;
