-- a_card_kind_must_be_a_known_word  (SUP-21 / SC-10)
--
-- `vendor_services.category` is plain TEXT, and `save_vendor_service` validates
-- nothing. The only fence was `parseCategory()` in
-- app/vendor-dashboard/services/actions.ts. Any other writer (an RPC, an admin
-- script, a future action) could store a word no screen knows how to name.
-- This makes the database refuse a card kind that is in NONE of the
-- vocabularies the app already uses.
--
-- ── WHY A TRIGGER, NOT A CHECK ─────────────────────────────────────────────
-- A CHECK cannot read another table. Three of the four vocabularies below live
-- in admin-managed tables *on purpose*: "an admin adding a trade makes it a
-- card kind with no deploy" (the parseCategory docblock, owner 2026-08-28,
-- "yes their own words"). A CHECK with a hard-coded list would refuse the
-- next leaf an admin adds, and a re-listed vocabulary drops values later on.
-- So nothing is listed here. Every vocabulary is read live.
--
-- ── THE UNION (exactly the sources the card-naming trigger
--    fill_service_card_title reads, plus the legacy enum) ─────────────────────
--   1. the `vendor_category` enum: the legacy keys. It holds 58 values, a strict
--      superset of the 52 in lib/vendors.ts VENDOR_CATEGORIES (measured
--      2026-09-18), so no key the app accepts is refused.
--   2. canonical_service_taxonomy.canonical_service: the coverage leaves.
--   3. service_categories.id: the taxonomy tree. Needed because one of the two
--      live production cards is `host_mc`, a tree tile id that is in neither
--      of the other two (measured 2026-09-18: `select category, count(*)
--      from vendor_services group by 1` → host_mc 1, live_band 1). The naming
--      trigger already names it from this table ("Host / MC").
--   4. canonical_service_schemas.canonical_service: the display-name table the
--      naming trigger reads FIRST. A kind it can name is a known kind. In prod
--      every schema key is also a taxonomy leaf (0 schema-only keys, measured
--      2026-09-18), so this widens nothing today. It only keeps the two
--      readers agreeing if that ever stops being true.
--
-- ── WHEN IT CHECKS ─────────────────────────────────────────────────────────
-- On INSERT, and on UPDATE only when `category` actually changes. A row whose
-- word was legal when written, and whose leaf an admin later retires, can
-- still have its price or photo edited. Refusing that would punish the
-- supplier for an admin's taxonomy change.
-- The database accepts hidden and retired leaves. The stricter "only a
-- VISIBLE leaf" rule stays in parseCategory, where the chooser lives. This
-- layer only refuses words in NO vocabulary.
--
-- Idempotent: CREATE OR REPLACE FUNCTION; DROP TRIGGER IF EXISTS; CREATE TRIGGER.

CREATE OR REPLACE FUNCTION public.tg_vendor_services_kind_is_known()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.category IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.category IS NOT DISTINCT FROM OLD.category THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
       SELECT 1
         FROM pg_catalog.pg_enum e
         JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
         JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'vendor_category'
          AND e.enumlabel = NEW.category
     )
     OR EXISTS (
       SELECT 1 FROM public.canonical_service_taxonomy c
        WHERE c.canonical_service = NEW.category
     )
     OR EXISTS (
       SELECT 1 FROM public.service_categories sc
        WHERE sc.id = NEW.category
     )
     OR EXISTS (
       SELECT 1 FROM public.canonical_service_schemas s
        WHERE s.canonical_service = NEW.category
     )
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unknown service kind "%": not a vendor_category key, a coverage leaf, a taxonomy node, or a named canonical service.', NEW.category
    USING ERRCODE = 'check_violation',
          HINT = 'File the card under a kind from the coverage picker or the legacy category list.';
END;
$$;

REVOKE ALL ON FUNCTION public.tg_vendor_services_kind_is_known() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_vendor_services_kind_is_known() FROM anon, authenticated;

COMMENT ON FUNCTION public.tg_vendor_services_kind_is_known() IS
  'SUP-21: refuses a vendor_services.category in none of the four live vocabularies (vendor_category enum, canonical_service_taxonomy, service_categories, canonical_service_schemas). Checks on INSERT and on a category change only. Migration 20271234232465.';

DROP TRIGGER IF EXISTS trg_before_vendor_services_kind_is_known ON public.vendor_services;
CREATE TRIGGER trg_before_vendor_services_kind_is_known
  BEFORE INSERT OR UPDATE OF category ON public.vendor_services
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_vendor_services_kind_is_known();
