-- ============================================================================
-- Iteration 0008 — Table rotation + per-seat removal (connect tables)
-- ============================================================================
-- Owner direction 2026-06-09: couples connect tables into custom patterns
-- (serpentine S-curves, circles, U-shapes — see reference layouts) by ROTATING
-- a table and removing the chair on the edge where it meets another table.
--
-- Two additive, non-destructive columns on event_tables:
--   • rotation_deg   — table orientation in degrees (0–359), applied by the
--                      editor canvas + print PDF when placing chairs/body.
--   • removed_seats  — seat indices (0-based into tableGeometry's seat slots)
--                      that have NO chair, so the joining edge can be cleared.
--                      Effective capacity = capacity − (valid removed indices).
--
-- RLS unchanged: couples read+write tables on their own event (Pattern B); these
-- columns ride the existing event_tables policies.
-- ============================================================================

ALTER TABLE public.event_tables
  ADD COLUMN IF NOT EXISTS rotation_deg  INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS removed_seats INTEGER[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.event_tables.rotation_deg IS
  'Iteration 0008 · table orientation in degrees (0–359). Lets couples rotate a '
  'table so wedges/banquets can be connected edge-to-edge into custom patterns.';
COMMENT ON COLUMN public.event_tables.removed_seats IS
  'Iteration 0008 · 0-based seat-slot indices with no chair (deleted). Clears the '
  'edge where two tables meet. Effective capacity = capacity − valid removed.';
