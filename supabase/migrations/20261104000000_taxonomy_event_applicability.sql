-- ============================================================================
-- 20261104000000_taxonomy_event_applicability.sql
--
-- Phase 1 of the taxonomy single-source unification — MULTI-EVENT applicability
-- (owner-approved 2026-06-10; design doc Taxonomy_Event_Faith_Scoping_Design_
-- 2026-06-10.md §2 + §7 Phase 1).
--
-- Adds "which category serves which event type" to the ONE taxonomy spine.
--   • service_categories.applicable_event_types  — PRIMARY control (tile grain)
--   • canonical_service_taxonomy.applicable_event_types — optional per-service override
--   • event_type_vocab — validation lookup (NOT the live enum; see below)
--
-- FAIL-OPEN: NULL / empty array = universal (serves ALL event types). Every
-- existing row backfills to NULL → byte-identical wedding behavior on landing;
-- onboarding a new event type means NARROWING the ~10 wedding-only tiles OUT,
-- never re-tagging all 54. Pure additive schema; no app behavior change (the
-- read-through resolves NULL to universal, wired in a later phase).
-- ============================================================================

BEGIN;

-- 1. event_type_vocab — the validation source of truth.
-- Deliberately a TABLE, not the public.event_type ENUM: that enum is evolved by
-- a RENAME-recreate-swap migration, and a trigger that casts to it (or reads
-- enum_range()) would THROW mid-swap and re-impose the hard constraint we use
-- TEXT[] to avoid. A vocab table survives the swap; a value dropped from the
-- enum degrades to a harmless dead string instead of a migration failure.
CREATE TABLE IF NOT EXISTS public.event_type_vocab (
  event_type  TEXT PRIMARY KEY,
  label_en    TEXT NOT NULL,
  sort_order  INT  NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_type_vocab ENABLE ROW LEVEL SECURITY;
-- Mirrors canonical_service_schemas: public read, admin-only write.
DROP POLICY IF EXISTS event_type_vocab_read_all ON public.event_type_vocab;
CREATE POLICY event_type_vocab_read_all
  ON public.event_type_vocab FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS event_type_vocab_admin_write ON public.event_type_vocab;
CREATE POLICY event_type_vocab_admin_write
  ON public.event_type_vocab FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Seed from the current event_type enum (idempotent).
INSERT INTO public.event_type_vocab (event_type, label_en, sort_order) VALUES
  ('wedding',       'Wedding',       1),
  ('birthday',      'Birthday',      2),
  ('celebration',   'Celebration',   3),
  ('travel',        'Travel',        4),
  ('corporate',     'Corporate',     5),
  ('tournament',    'Tournament',    6),
  ('christening',   'Christening',   7),
  ('gender_reveal', 'Gender Reveal', 8),
  ('debut',         'Debut',         9),
  ('anniversary',   'Anniversary',   10),
  ('graduation',    'Graduation',    11),
  ('reunion',       'Reunion',       12)
ON CONFLICT (event_type) DO NOTHING;

-- 2. applicable_event_types — tile (primary) + canonical (override). NULL=universal.
ALTER TABLE public.service_categories
  ADD COLUMN IF NOT EXISTS applicable_event_types TEXT[];
ALTER TABLE public.canonical_service_taxonomy
  ADD COLUMN IF NOT EXISTS applicable_event_types TEXT[];

-- GIN indexes for the reverse "which tiles serve event X" query.
CREATE INDEX IF NOT EXISTS service_categories_event_types_idx
  ON public.service_categories USING GIN (applicable_event_types);
CREATE INDEX IF NOT EXISTS canonical_taxonomy_event_types_idx
  ON public.canonical_service_taxonomy USING GIN (applicable_event_types);

-- 3. Validate each array member ∈ event_type_vocab. A trigger (not a FK / enum
-- cast) so it survives the enum swap. NULL / empty array is always valid.
CREATE OR REPLACE FUNCTION public.validate_applicable_event_types()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  bad TEXT;
BEGIN
  IF NEW.applicable_event_types IS NULL
     OR cardinality(NEW.applicable_event_types) = 0 THEN
    RETURN NEW;
  END IF;
  SELECT string_agg(et, ', ') INTO bad
    FROM unnest(NEW.applicable_event_types) AS et
   WHERE et NOT IN (SELECT event_type FROM public.event_type_vocab WHERE status = 'active');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'applicable_event_types has unknown event type(s): %', bad;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validate_event_types_service_categories ON public.service_categories;
CREATE TRIGGER validate_event_types_service_categories
  BEFORE INSERT OR UPDATE OF applicable_event_types ON public.service_categories
  FOR EACH ROW EXECUTE FUNCTION public.validate_applicable_event_types();

DROP TRIGGER IF EXISTS validate_event_types_canonical_taxonomy ON public.canonical_service_taxonomy;
CREATE TRIGGER validate_event_types_canonical_taxonomy
  BEFORE INSERT OR UPDATE OF applicable_event_types ON public.canonical_service_taxonomy
  FOR EACH ROW EXECUTE FUNCTION public.validate_applicable_event_types();

COMMENT ON COLUMN public.service_categories.applicable_event_types IS
  'TEXT[] of event_type_vocab keys this tile serves. NULL/empty = universal (all events) — FAIL-OPEN. Primary multi-event control (tile grain). Phase 1, 2026-06-10.';
COMMENT ON COLUMN public.canonical_service_taxonomy.applicable_event_types IS
  'Optional per-service override of the tile applicable_event_types. NULL = inherit the tile; non-NULL wins. Phase 1, 2026-06-10.';

COMMIT;
