-- ============================================================================
-- 20270224120000_guest_attire.sql
--
-- Adds public.guests.attire so couples can dress each guest's 3D seat-plan
-- avatar (owner directive 2026-06-25: "the guests 3d people will follow the
-- motif of their dresses … same on the suits of the men").
--
--   gown    — wears a gown silhouette in the mood-board attire motif
--   suit    — wears a suit silhouette in the groom/attire motif
--   neutral — default; the renderer falls back to a role-implied guess
--             (gendered wedding-party roles auto-dress) then to a plain token.
--
-- text + CHECK rather than a new enum: a tiny closed set, no cross-table reuse,
-- and it sidesteps the ALTER TYPE … ADD VALUE transaction caveat. NOT NULL with
-- a constant default is a metadata-only rewrite on PG 11+ (fast on big tables).
-- RLS already lives on public.guests (enabled at CREATE TABLE), so the new
-- column inherits the table's policies — no policy change needed.
-- ============================================================================

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS attire text NOT NULL DEFAULT 'neutral'
  CONSTRAINT guests_attire_check CHECK (attire IN ('gown', 'suit', 'neutral'));
