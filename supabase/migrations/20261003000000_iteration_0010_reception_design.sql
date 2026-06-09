-- ============================================================================
-- 20261003000000_iteration_0010_reception_design.sql
-- Mood Board Phase 2 — the stylized reception designer.
--
-- Owner directive 2026-06-09: "editing the actual feel of the whole venue" —
-- tap a part (ceiling / walls / stage / tables / entrance) and pick its
-- treatment (chandelier vs draped cloth vs string lights, etc.). The picture is
-- a palette-tinted stylized SVG venue that updates live; this column persists
-- the couple's per-part treatment choices.
--
-- Shape: { "ceiling": "chandeliers", "walls": "floral", "stage": "sweetheart",
--          "tables": "round_tall", "entrance": "floral_arch" }
-- (string keys → treatment id; unknown/absent keys fall back to a default).
--
-- Additive + idempotent. RLS unchanged (events already carries couple-write RLS).
-- ============================================================================

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS reception_design JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
