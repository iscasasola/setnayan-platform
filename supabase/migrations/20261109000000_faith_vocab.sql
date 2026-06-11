-- ============================================================================
-- 20261109000000_faith_vocab.sql
--
-- Phase 2 of the taxonomy unification — FAITH RECONCILIATION
-- (Taxonomy_Event_Faith_Scoping_Design_2026-06-10.md §3 + §7 Phase 2).
--
-- The faith vocabulary becomes a lookup table instead of a hardcoded 5-value
-- CHECK. Storage stays TITLE-CASE — the marketplace compares faith with strict
-- `===` against title-case FaithKey (passesReligionFilter), so lowercasing the
-- column would silently hide every faith-tagged service. Zero data mutation:
-- the 21 existing tagged rows (officiants / seminars / counseling) all satisfy
-- the new FK as-is.
--
--   • faith_vocab — single source of truth for faith keys (admin-editable).
--     Seeds the 8 FaithKey values the app already knows + Civil (is_civil).
--   • canonical_service_taxonomy.faith: 5-value CHECK → FK to faith_vocab.
--     Widens the taggable set (Chinese / Jewish / Born Again were in the app's
--     FaithKey union but UNTAGGABLE in the DB until now) and delete-protects
--     any vocab row that's in use.
-- ============================================================================

BEGIN;

-- 1. faith_vocab — mirrors event_type_vocab (public read, admin write).
CREATE TABLE IF NOT EXISTS public.faith_vocab (
  faith_key   TEXT PRIMARY KEY,
  label_en    TEXT NOT NULL,
  sort_order  INT  NOT NULL DEFAULT 0,
  -- Civil is a first-class key for civil/no-religion weddings: matches the
  -- civil-officiant canonicals; never a tag on ordinary services.
  is_civil    BOOLEAN NOT NULL DEFAULT FALSE,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.faith_vocab ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS faith_vocab_read_all ON public.faith_vocab;
CREATE POLICY faith_vocab_read_all
  ON public.faith_vocab FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS faith_vocab_admin_write ON public.faith_vocab;
CREATE POLICY faith_vocab_admin_write
  ON public.faith_vocab FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Title-case keys — MUST match the app's FaithKey union exactly.
INSERT INTO public.faith_vocab (faith_key, label_en, sort_order, is_civil) VALUES
  ('Catholic',   'Catholic',          1, FALSE),
  ('Christian',  'Christian',         2, FALSE),
  ('Born Again', 'Born Again',        3, FALSE),
  ('INC',        'Iglesia ni Cristo', 4, FALSE),
  ('Muslim',     'Muslim',            5, FALSE),
  ('Jewish',     'Jewish',            6, FALSE),
  ('Chinese',    'Chinese',           7, FALSE),
  ('Cultural',   'Cultural',          8, FALSE),
  ('Civil',      'Civil (no religion)', 9, TRUE)
ON CONFLICT (faith_key) DO NOTHING;

-- 2. Widen: 5-value CHECK → FK to faith_vocab. The 21 live tagged rows are all
-- within the seeded set, so this is additive — no data UPDATE, no orphan window.
ALTER TABLE public.canonical_service_taxonomy
  DROP CONSTRAINT IF EXISTS canonical_service_taxonomy_faith_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'canonical_service_taxonomy_faith_fk'
  ) THEN
    ALTER TABLE public.canonical_service_taxonomy
      ADD CONSTRAINT canonical_service_taxonomy_faith_fk
      FOREIGN KEY (faith) REFERENCES public.faith_vocab(faith_key);
  END IF;
END $$;

-- 3. Fail loud — every live faith value must resolve in the vocab.
DO $$
DECLARE bad TEXT;
BEGIN
  SELECT string_agg(DISTINCT faith, ', ') INTO bad
    FROM public.canonical_service_taxonomy t
   WHERE t.faith IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.faith_vocab v WHERE v.faith_key = t.faith);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'canonical_service_taxonomy.faith value(s) missing from faith_vocab: %', bad;
  END IF;
END $$;

COMMENT ON TABLE public.faith_vocab IS
  'Faith vocabulary for wedding faith-exclusivity (title-case keys matching the app FaithKey union — NEVER lowercase; the marketplace compares ===). Civil (is_civil) is the civil/no-religion key. Phase 2, 2026-06-11.';

COMMIT;
