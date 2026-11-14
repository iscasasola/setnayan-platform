-- a_supplier_tags_its_event_photos_to_inspirations
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ═══════════════════════════════════════════════════════════════════════════
-- 🏷 A SUPPLIER TAGS ITS EVENT PHOTOS TO INSPIRATIONS (DECISION_LOG 2026-11-14,
-- owner: "Yes, take its picks"; prototype
-- `prototypes/inspiration_tags_2026-11-14_fable.html`).
--
-- A photo filed in Files under a service card (event_supplier_files, grp
-- 'service') can be tagged to one or more inspiration parts. The tag IS the
-- shipped inspiration record — a `moodboard_library_assets` row
-- (asset_type 'supplier_gallery', the part in asset_subtype, the shop, the
-- card, the event) — made from a Files photo instead of a fresh upload. So
-- this adds exactly ONE column and the rules around it:
--
--   moodboard_library_assets.event_file_id → event_supplier_files(file_id)
--     · nullable (every row that is not a Files tag keeps NULL);
--     · ON DELETE SET NULL — the Files photo leaving the event never deletes a
--       library row, because `event_inspiration_assets.library_asset_id`
--       CASCADES and would take the tile off every couple's board that saved
--       it. Ruling (6): it stays on those boards, credited. The trigger in §4
--       RETIRES the tags first (today's retire rule), so a SET NULL row can
--       never fall back into the public pool as a plain upload;
--     · UNIQUE (event_file_id, asset_subtype) — one row per (photo, part);
--       NO second slot column (Ugat J45 claims `slot_key` absent).
--
-- THE SEVEN RULINGS, AND WHERE EACH IS HELD:
--   (1) shows in an inspiration WHEN IT SHOWS ON THE SHOP → the public read
--       policy (§3) adds `inspiration_photo_is_on_the_shop(event_file_id)`,
--       which asks THE ONE LISTING RULE (the view
--       event_supplier_photos_listed) live. Whatever that view decides — the
--       couple's yes today, the guest notice tomorrow — the tag follows it,
--       with no stored flag to go stale. Server reads on the service role
--       (the shop page) filter by the same view (lib/inspiration-tags.server).
--   (2) still passes Setnayan's photo check and admin approval → the row is
--       written ONLY by storeScreenedAsset (screen · watermark · store · scan)
--       and lands with approved_at NULL; the public read keeps approved_at.
--   (3) only the parts that photo's service card offers → §2's trigger:
--       the card's service must be in inspiration_part_services for the part.
--   (4) the public sees type · venue · month, never a name, and never the
--       event id → event_file_id is granted to NOBODY but the service role
--       (like source_event_id); the line comes from §5's narrow function.
--   (5) no signed-out browse page → nothing here adds one.
--   (6) made private / removed stays on saved boards, credited → §4 + SET NULL.
--   (7) photos only → §2: the Files row must be kind 'photo'.
--
-- RLS: one policy REPLACED (moodboard_library_assets_public_read — narrowed,
-- never widened: every row it admitted before that has no event_file_id is
-- still admitted; a Files tag is admitted only while its photo is listed).
--
-- 🛑 NOT APPLIED BY HAND. `deploy-prod.yml` runs `supabase db push
-- --include-all --yes` on the committed file.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · THE COLUMN ─────────────────────────────────────────────────────────
ALTER TABLE public.moodboard_library_assets
  ADD COLUMN IF NOT EXISTS event_file_id UUID
    REFERENCES public.event_supplier_files(file_id) ON DELETE SET NULL;

-- One row per (photo, part). NULLs are distinct, so every non-tag row is untouched.
-- A CONSTRAINT (not a bare index) so the Ugat map can claim it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'moodboard_library_assets_one_tag_per_part'
       AND conrelid = 'public.moodboard_library_assets'::regclass
  ) THEN
    ALTER TABLE public.moodboard_library_assets
      ADD CONSTRAINT moodboard_library_assets_one_tag_per_part UNIQUE (event_file_id, asset_subtype);
  END IF;
END $$;

COMMENT ON COLUMN public.moodboard_library_assets.event_file_id IS
  'The Files photo (event_supplier_files) this inspiration photo was tagged from (DECISION_LOG 2026-11-14). One row per (photo, part) — UNIQUE with asset_subtype. Shown publicly only while that photo is listed on the shop (inspiration_photo_is_on_the_shop, read by the public policy). ON DELETE SET NULL after the trigger retires the row, so a removed photo stays on saved boards, credited. NO grant to anon/authenticated: it names a couple''s event file, the class source_event_id is withheld for. Service role only.';

-- ── 2 · A TAG FOLLOWS ITS FILES PHOTO ─────────────────────────────────────
-- Held in the database, not only in the action: the service role skips RLS,
-- never a trigger. The event and the card are COPIED from the Files photo —
-- never typed per tag — and the part must be one the card offers.
-- ⚠ NEVER RAISES ON A NULL event_file_id: the SET NULL cascade fires an UPDATE
-- through here, and raising would turn ON DELETE SET NULL into RESTRICT.
CREATE OR REPLACE FUNCTION public.inspiration_tag_follows_its_files_photo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  f_event   UUID;
  f_shop    UUID;
  f_service UUID;
  f_grp     TEXT;
  f_kind    TEXT;
  c_service TEXT;
BEGIN
  IF NEW.event_file_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.event_file_id IS NOT DISTINCT FROM OLD.event_file_id
     AND NEW.asset_subtype IS NOT DISTINCT FROM OLD.asset_subtype
     AND NEW.vendor_profile_id IS NOT DISTINCT FROM OLD.vendor_profile_id
     AND NEW.asset_type IS NOT DISTINCT FROM OLD.asset_type
     AND NEW.vendor_service_id IS NOT DISTINCT FROM OLD.vendor_service_id
     AND NEW.source_event_id IS NOT DISTINCT FROM OLD.source_event_id THEN
    RETURN NEW;
  END IF;
  IF NEW.asset_type IS DISTINCT FROM 'supplier_gallery' THEN
    RAISE EXCEPTION 'only a supplier''s inspiration photo is tagged from Files' USING ERRCODE = 'check_violation';
  END IF;

  SELECT f.event_id, f.vendor_profile_id, f.vendor_service_id, f.grp, f.kind
    INTO f_event, f_shop, f_service, f_grp, f_kind
    FROM public.event_supplier_files f
   WHERE f.file_id = NEW.event_file_id;
  IF NOT FOUND OR f_shop IS DISTINCT FROM NEW.vendor_profile_id THEN
    RAISE EXCEPTION 'a tag names one of the shop''s own Files photos' USING ERRCODE = '42501';
  END IF;
  -- (7) Photos only — and only a photo filed under a service card.
  IF f_grp <> 'service' OR f_kind <> 'photo' OR f_service IS NULL THEN
    RAISE EXCEPTION 'only a photo filed under a service card is tagged to an inspiration' USING ERRCODE = 'check_violation';
  END IF;

  -- (3) Only a part the photo's own service card offers.
  SELECT s.category INTO c_service FROM public.vendor_services s WHERE s.vendor_service_id = f_service;
  IF c_service IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.inspiration_part_services ps
     WHERE ps.slot_key = NEW.asset_subtype AND ps.canonical_service = c_service
  ) THEN
    RAISE EXCEPTION 'that service card does not offer this inspiration' USING ERRCODE = 'check_violation';
  END IF;

  -- The event and the card are the photo's — copied, never typed.
  NEW.source_event_id := f_event;
  NEW.vendor_service_id := f_service;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.inspiration_tag_follows_its_files_photo() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS inspiration_tag_follows_its_files_photo ON public.moodboard_library_assets;
CREATE TRIGGER inspiration_tag_follows_its_files_photo
  BEFORE INSERT OR UPDATE ON public.moodboard_library_assets
  FOR EACH ROW EXECUTE FUNCTION public.inspiration_tag_follows_its_files_photo();

-- ── 3 · NOTHING REACHES AN INSPIRATION BEFORE THE SHOP SHOWS IT ───────────
-- SECURITY DEFINER so the question can be asked for a viewer who may not read
-- event_supplier_files (a couple, a visitor). It answers ONE bit — is this
-- Files photo listed on its shop right now — through THE ONE LISTING RULE.
CREATE OR REPLACE FUNCTION public.inspiration_photo_is_on_the_shop(p_file_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_file_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.event_supplier_photos_listed l WHERE l.file_id = p_file_id
  );
$$;

REVOKE ALL ON FUNCTION public.inspiration_photo_is_on_the_shop(UUID) FROM PUBLIC;
-- The public read policy calls it for every viewer, so every viewer must hold EXECUTE.
GRANT EXECUTE ON FUNCTION public.inspiration_photo_is_on_the_shop(UUID) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS moodboard_library_assets_public_read ON public.moodboard_library_assets;
CREATE POLICY moodboard_library_assets_public_read ON public.moodboard_library_assets
  FOR SELECT
  USING (
    approved_at IS NOT NULL
    AND retired_at IS NULL
    AND (event_file_id IS NULL OR public.inspiration_photo_is_on_the_shop(event_file_id))
  );

-- ── 4 · A FILES PHOTO THAT LEAVES ITS SERVICE LEAVES ITS INSPIRATIONS ─────
-- Removed from the event, or re-filed under another card: its tags are
-- RETIRED (today's retire rule — off the pool, still on every board that
-- saved it, credited). Retired before the FK's SET NULL, so a tag can never
-- become a plain, un-gated upload.
CREATE OR REPLACE FUNCTION public.retire_tags_of_a_files_photo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.vendor_service_id IS NOT DISTINCT FROM OLD.vendor_service_id
     AND NEW.grp IS NOT DISTINCT FROM OLD.grp THEN
    RETURN NEW;
  END IF;
  UPDATE public.moodboard_library_assets
     SET retired_at = NOW()
   WHERE event_file_id = OLD.file_id AND retired_at IS NULL;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.retire_tags_of_a_files_photo() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS retire_tags_of_a_files_photo ON public.event_supplier_files;
CREATE TRIGGER retire_tags_of_a_files_photo
  BEFORE DELETE OR UPDATE OF vendor_service_id, grp ON public.event_supplier_files
  FOR EACH ROW EXECUTE FUNCTION public.retire_tags_of_a_files_photo();

-- ── 5 · THE PUBLIC EVENT LINE — type · venue · month, never a name or an id ─
-- For publicly-readable tags only (the same three predicates as the policy).
-- Returns the part keys the same photo is ALSO shown in ("Also in").
CREATE OR REPLACE FUNCTION public.inspiration_tag_event_lines(p_asset_ids UUID[])
RETURNS TABLE (asset_id UUID, event_type TEXT, venue_name TEXT, event_month DATE, also_in TEXT[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT a.asset_id,
         e.event_type::TEXT,
         NULLIF(btrim(e.venue_name), ''),
         date_trunc('month', e.event_date)::DATE,
         COALESCE((
           SELECT array_agg(o.asset_subtype ORDER BY o.asset_subtype)
             FROM public.moodboard_library_assets o
            WHERE o.event_file_id = a.event_file_id
              AND o.asset_id <> a.asset_id
              AND o.approved_at IS NOT NULL
              AND o.retired_at IS NULL
         ), ARRAY[]::TEXT[])
    FROM public.moodboard_library_assets a
    JOIN public.event_supplier_files f ON f.file_id = a.event_file_id
    JOIN public.events e ON e.event_id = f.event_id
   WHERE a.asset_id = ANY (p_asset_ids[1:500])
     AND a.asset_type = 'supplier_gallery'
     AND a.approved_at IS NOT NULL
     AND a.retired_at IS NULL
     AND public.inspiration_photo_is_on_the_shop(a.event_file_id);
$$;

REVOKE ALL ON FUNCTION public.inspiration_tag_event_lines(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inspiration_tag_event_lines(UUID[]) TO anon, authenticated, service_role;

-- ── 6 · GRANTS — the new column is the service role's alone ───────────────
GRANT ALL ON public.moodboard_library_assets TO service_role;

DO $$
DECLARE
  rle TEXT;
BEGIN
  FOREACH rle IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_column_privilege(rle, 'public.moodboard_library_assets', 'event_file_id', 'SELECT')
       OR has_column_privilege(rle, 'public.moodboard_library_assets', 'event_file_id', 'INSERT')
       OR has_column_privilege(rle, 'public.moodboard_library_assets', 'event_file_id', 'UPDATE') THEN
      RAISE EXCEPTION 'refusing to finish: % holds a privilege on event_file_id — a handle on a couple''s event file', rle;
    END IF;
    IF has_column_privilege(rle, 'public.moodboard_library_assets', 'source_event_id', 'SELECT') THEN
      RAISE EXCEPTION 'refusing to finish: % can read source_event_id again', rle;
    END IF;
  END LOOP;
END $$;

COMMIT;
