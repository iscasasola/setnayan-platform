-- ============================================================================
-- 20271288430455_inspiration_parts_are_the_photo_keys.sql
-- Created via `pnpm migration:new`. Idempotent: every constraint and trigger is
-- dropped IF EXISTS before it is (re-)added; CREATE OR REPLACE FUNCTION.
--
-- 🧩 STEP ② OF THE APPROVED REDESIGN (owner 2026-10-26: "Approve the redesign
-- package — build the nine steps in order, each final"; corpus
-- `prototypes/admin_inspiration_groups_2026-10-25/PLAN.md` § 1): the two photo
-- tables stop carrying a hard-coded list of slot keys and point at
-- `public.inspiration_parts` (step ①, migration 20271287668170) instead.
--
--   event_inspiration_assets.slot_key
--     CHECK event_inspiration_assets_slot_key_check_v3 (29 literals)  → DROPPED
--     FK    event_inspiration_assets_slot_key_is_a_part
--           → inspiration_parts(slot_key) ON DELETE RESTRICT           → ADDED
--
--   moodboard_library_assets.asset_subtype — POLYMORPHIC (it is a slot key only
--   when asset_type = 'supplier_gallery'; for figure_attire / florals /
--   venue_scene it is that library's own vocabulary), so an FK cannot hold it:
--     the slot IN-list inside moodboard_library_assets_supplier_gallery_shape
--     → REMOVED (same name, the shop + rights-warranty halves verbatim)
--     trigger moodboard_library_assets_subtype_is_a_part                 → ADDED
--
-- BOTH FAIL LOUDLY ON AN UNKNOWN KEY, AS THE CHECK DID. Nothing is rewritten:
-- photos keep their keys. Measured on prod before writing (2026-10-26,
-- read-only): every stored board row's slot_key is one of the 29 parts (7 rows),
-- and there are 0 supplier_gallery rows — so the FK validates and no row moves.
--
-- Why it matters: a new part is now ONE admin row (step ③), not a migration +
-- three const edits + a CHECK widen; and a part with photos can no longer be
-- deleted out from under them (the FK, on top of step ①'s trigger).
-- ============================================================================

BEGIN;

-- ── 1. The couple's board: CHECK → FK ───────────────────────────────────────
ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_slot_key_check_v3;

ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_slot_key_is_a_part;
ALTER TABLE public.event_inspiration_assets
  ADD CONSTRAINT event_inspiration_assets_slot_key_is_a_part
  FOREIGN KEY (slot_key) REFERENCES public.inspiration_parts(slot_key) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS event_inspiration_assets_slot_key_idx
  ON public.event_inspiration_assets (slot_key);

-- ── 2. The supplier gallery: the IN-list leaves the shape CHECK ─────────────
ALTER TABLE public.moodboard_library_assets
  DROP CONSTRAINT IF EXISTS moodboard_library_assets_supplier_gallery_shape;
ALTER TABLE public.moodboard_library_assets
  ADD CONSTRAINT moodboard_library_assets_supplier_gallery_shape
  CHECK (
    asset_type <> 'supplier_gallery'
    OR (
      vendor_profile_id IS NOT NULL
      AND (approved_at IS NULL OR rights_warranted_at IS NOT NULL)
    )
  );

-- …and a trigger holds the slot instead, for supplier_gallery rows only.
CREATE OR REPLACE FUNCTION public.moodboard_library_assets_subtype_is_a_part()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.asset_type = 'supplier_gallery'
     AND NOT EXISTS (SELECT 1 FROM public.inspiration_parts p WHERE p.slot_key = NEW.asset_subtype) THEN
    RAISE EXCEPTION 'a supplier gallery photo names inspiration part %, which does not exist', NEW.asset_subtype
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS moodboard_library_assets_subtype_is_a_part ON public.moodboard_library_assets;
CREATE TRIGGER moodboard_library_assets_subtype_is_a_part
  BEFORE INSERT OR UPDATE OF asset_type, asset_subtype ON public.moodboard_library_assets
  FOR EACH ROW EXECUTE FUNCTION public.moodboard_library_assets_subtype_is_a_part();

-- ── Said out loud ───────────────────────────────────────────────────────────
DO $$
DECLARE
  def TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_inspiration_assets_slot_key_check_v3'
               AND connamespace = 'public'::regnamespace) THEN
    RAISE EXCEPTION 'refusing to finish: the board''s slot CHECK is still there';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_inspiration_assets_slot_key_is_a_part'
                   AND contype = 'f' AND connamespace = 'public'::regnamespace) THEN
    RAISE EXCEPTION 'refusing to finish: the board''s FK into inspiration_parts is missing';
  END IF;
  SELECT pg_get_constraintdef(c.oid) INTO def FROM pg_constraint c
   WHERE c.conname = 'moodboard_library_assets_supplier_gallery_shape' AND c.connamespace = 'public'::regnamespace;
  IF def IS NULL OR position('asset_subtype' IN def) > 0 OR position('rights_warranted_at' IN def) = 0 THEN
    RAISE EXCEPTION 'refusing to finish: the gallery shape CHECK is not the shop + warranty halves alone: %', def;
  END IF;
END $$;

COMMIT;
