-- ============================================================================
-- 20270920040000_seat_lookup_exact_match.sql
--
-- SEAT-FINDER anti-enumeration hardening (open-browse PR5 privacy, part a).
--
-- ROOT CAUSE: public.public_seat_lookup() matched the typed query as a SUBSTRING
-- (`display_name ILIKE '%' || q || '%'`) and returned up to 25 rows. On the
-- public /[slug]/find-seat page (no session — the shared venue QR lands anyone
-- there), a 2-char probe like 'ma' therefore returned up to 25 guests' full
-- names + table labels: a roster-enumeration oracle over the couple's entire
-- guest list, months before the event.
--
-- FIX (owner decision 2026-07-23 — "exact/prefix match, own seat only"): match
-- the typed name EXACTLY against a guest's full name (case-insensitive,
-- whitespace-collapsed), and return only that guest's own seat. A partial or
-- common query now returns NOTHING — you can no longer walk the roster; you can
-- only confirm the table of a name you already know in full. Same-name guests
-- (rare) are bounded by LIMIT 5. The tradeoff (a guest whose name the couple
-- stored differently — nickname, middle name — may get "no match") is accepted;
-- the page's empty state already asks for the name "as written on your invite".
--
-- Everything else is preserved verbatim: SECURITY DEFINER, the min-length probe
-- guard, the slug resolve, the published-plan gate, the minimal 4-column shape
-- (so the route's presign mapping is unchanged), and the walkthrough-zone join.
-- The LIKE-wildcard escaping is dropped because the match is now `=`, not LIKE.
--
-- Idempotent: CREATE OR REPLACE.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.public_seat_lookup(p_slug TEXT, p_query TEXT)
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
  v_nquery   TEXT;   -- normalized query: trimmed, whitespace-collapsed, lower-cased
BEGIN
  -- Anti-enumeration: refuse to answer a 0/1-char probe.
  IF char_length(btrim(COALESCE(p_query, ''))) < 2 THEN
    RETURN;
  END IF;

  -- Normalize the query the same way we normalize each candidate name below,
  -- so "Maria  Santos" and "maria santos" both exact-match "Maria Santos".
  v_nquery := lower(regexp_replace(btrim(p_query), '\s+', ' ', 'g'));

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
    -- EXACT full-name match only (own seat) — no substring, no enumeration.
    AND lower(regexp_replace(
          btrim(COALESCE(NULLIF(btrim(g.display_name), ''),
                         g.first_name || ' ' || g.last_name)),
          '\s+', ' ', 'g')) = v_nquery
  ORDER BY 1
  LIMIT 5;
END;
$$;

REVOKE ALL ON FUNCTION public.public_seat_lookup(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_seat_lookup(TEXT, TEXT) TO anon, authenticated;

COMMIT;
