-- photo delivery artifacts allow guest captures
--
-- Papic storage PR-4 (Drive resilience + guest-capture delivery release). The
-- 0009 Photo Delivery join table `photo_delivery_artifacts` was born photo-only:
-- its source_table CHECK admitted 'papic_photos' alone (the migration comment
-- even said "CHECK widens when a new source table joins"). Guest-camera captures
-- live in `papic_guest_captures`, so a guest clip/photo could never be enqueued
-- for a manual "Release to Drive". This widens the CHECK to admit guest captures
-- so lib/photo-delivery-release.ts can back them up before the guest-inclusive
-- full-res drop runs.
--
-- Purely a constraint relaxation: no new column, no data change, no RLS change.
-- source_photo_id has NO foreign key (it is a plain UUID that holds a photo_id OR
-- a capture_id), so a guest capture_id slots in without any FK conflict. The
-- dedupe unique index is (event_id, source_table, source_id) — already keyed on
-- source_table — so seat rows and guest rows for the same event never collide.
--
-- Idempotent: DROP the old CHECK by name, then re-add the widened one only if a
-- constraint of that name is absent (re-apply-safe).

DO $$
BEGIN
  -- Drop whatever CHECK currently constrains source_table (name is
  -- auto-generated `photo_delivery_artifacts_source_table_check`), then re-add
  -- the widened membership. Guarded so a re-run is a no-op.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.photo_delivery_artifacts'::regclass
      AND conname = 'photo_delivery_artifacts_source_table_check'
  ) THEN
    ALTER TABLE public.photo_delivery_artifacts
      DROP CONSTRAINT photo_delivery_artifacts_source_table_check;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.photo_delivery_artifacts'::regclass
      AND conname = 'photo_delivery_artifacts_source_table_check'
  ) THEN
    ALTER TABLE public.photo_delivery_artifacts
      ADD CONSTRAINT photo_delivery_artifacts_source_table_check
      CHECK (source_table IN ('papic_photos', 'papic_guest_captures'));
  END IF;
END $$;

COMMENT ON COLUMN public.photo_delivery_artifacts.source_table IS
  '0009 Photo Delivery — which capture table the source row lives in. Papic storage PR-4 widened this from papic_photos-only to also admit papic_guest_captures so guest-camera clips/photos can be released to the couple''s Drive. source_photo_id holds the matching photo_id OR capture_id (no FK — a plain UUID).';
