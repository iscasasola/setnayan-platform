-- service card opens: one embed path between vendor_services and vendor_profiles
-- ============================================================================
-- 🛑 PROD INCIDENT 2026-11-12: /suppliers rendered "Something on our end didn't work." (digest 1065388292) and
-- /explore failed the same read. Vercel log, verbatim:
--   PGRST201: Could not embed because more than one relationship was found for 'vendor_services' and
--   'vendor_profiles' … 'vendor_profiles!vendor_services_vendor_profile_id_fkey', 'vendor_profiles!vendor_service_card_view_days'
--
-- WHY: 20271337268841 gave the opens ledger a foreign key to BOTH vendor_profiles and vendor_services, with both in
-- its primary key. PostgREST reads a table like that as a many-to-many JUNCTION, so every
-- `vendor_services → vendor_profiles(...)` embed in the app (≈ a dozen reads: the supplier landing pages, Explore,
-- the marketplace cards, journal spotlights…) suddenly had two paths and refused to pick one.
--
-- FIX: drop the ledger's vendor_profile_id foreign key. Nothing is lost —
--   · the shop is already pinned: record_service_card_view() refuses a card whose vendor_profile_id differs;
--   · deletion still cascades: a deleted shop deletes its services (vendor_services FK ON DELETE CASCADE), and a
--     deleted service deletes its opens (the FK kept below).
-- The column, the primary key and the indexes stay as they are.
-- Guarded by apps/web/tests/db/one-embed-path-services-to-shops.db.test.ts.
-- NEVER APPLIED BY HAND — the pipeline pushes it. KEEP IDEMPOTENT.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  c TEXT;
BEGIN
  FOR c IN
    SELECT con.conname
      FROM pg_constraint con
     WHERE con.conrelid = 'public.vendor_service_card_view_days'::regclass
       AND con.contype = 'f'
       AND con.confrelid = 'public.vendor_profiles'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.vendor_service_card_view_days DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

COMMENT ON COLUMN public.vendor_service_card_view_days.vendor_profile_id IS
  'The shop the card belongs to (checked by record_service_card_view). Deliberately NO foreign key: a second FK to vendor_profiles makes PostgREST read this ledger as a vendor_services↔vendor_profiles junction and every services→shop embed fails with PGRST201 (prod incident 2026-11-12). Deletion cascades through vendor_service_id.';

NOTIFY pgrst, 'reload schema';

COMMIT;
