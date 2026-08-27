-- paperwork_and_honeymoon_go_on_sale
-- ============================================================================
-- TWO OF THE FOUR ADMIN-ONLY BRANCHES GO ON SALE. THE OTHER TWO STAY SHUT.
--
-- Owner ruling 2026-08-27, verbatim, asked which of officiants / counselling /
-- marriage paperwork / honeymoon should become things a supplier can list and a
-- couple can book:
--
--   *"for priest (there are rules) so this needs to be under their church
--     (which is at the ceremony venue).
--     marriage-paper helper yes.
--     honeymoon planner yes"*
--
--   officiants           SHUT — a priest is not shopped for. `officiant-auto-
--                        resolve.ts` has surfaced "the priest from your parish
--                        officiates" since 2026-05-30; that IS the ruling,
--                        already built.
--   counseling_seminars  SHUT — he was not asked about it, so it does not move.
--                        Pre-Cana attaches to the rite the way the officiant
--                        does. Opening it is his call, not a tidy-up.
--   wedding_paperwork    OPENED (3 services)
--   travel_honeymoon     OPENED (2 services)
--
-- ⚠ VISIBILITY IS TWO FLAGS, NOT ONE. `getCoverageTaxonomy` (the /open-shop
-- picker + the coverage editor) and the `no-service-lands-in-misc` guard both
-- require the LEAF to be visible AND its BRANCH to be visible AND the branch's
-- PARENT to be visible. Flipping only the branch leaves five services that no
-- vendor can select and no couple can find, with nothing anywhere reporting it.
-- Both levels move here, in one transaction.
--
-- 🔑 THE COARSE CATEGORY IS THE THIRD THING, AND IT IS AN ENUM.
-- `vendor_profiles.services[]` and every marketplace filter store
-- `public.vendor_category`, and `BRANCH_TO_VENDOR_CATEGORY` is the only bridge
-- from a branch to one. A visible branch missing from that map files every
-- vendor under it as "Miscellaneous" — measured at 194 of 246 services on
-- 2026-08-09, which is why that guard exists. So the enum gains two values
-- here and the TypeScript map gains the two rows in the same PR. A value the
-- code writes but the enum lacks is REJECTED, NOT THROWN: the INSERT fails at
-- runtime and the only symptom is a vendor whose signup did not stick.
--
-- ⚖ AND PAPERWORK CHANGES FOLDER: `venue` → `planning`.
-- It was a sibling of Ceremony under "Venues & churches" — correct while it was
-- an admin-only filing cabinet, wrong the moment a couple can browse it. Nobody
-- hunting for someone to expedite a marriage licence opens "Venues & churches";
-- they open "Coordinators & planners", which is where Travel & Honeymoon
-- already sits. Both leaves and the branch move together so this table's
-- folder_id = branch parent_id invariant holds (pinned by
-- tests/db/every-service-has-a-tile.db.test.ts).
--
-- Idempotent: ADD VALUE IF NOT EXISTS + UPDATE by explicit key.
-- ============================================================================

-- ---- 0. the enum ------------------------------------------------------------
-- ALTER TYPE … ADD VALUE cannot run inside an explicit transaction block, so
-- this lives OUTSIDE the BEGIN/COMMIT below (same pattern as 20260514100000 and
-- 20270825683668). Nothing in this migration USES the new values, so the
-- "cannot use a value added in the same transaction" rule is not in play.
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'wedding_paperwork';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'travel_honeymoon';

BEGIN;

-- ---- 1. Paperwork & Government moves to Coordinators & planners -------------
UPDATE public.service_categories
   SET parent_id = 'planning', sort_order = 5, updated_at = now()
 WHERE id = 'wedding_paperwork';

UPDATE public.canonical_service_taxonomy
   SET folder_id = 'planning', updated_at = now()
 WHERE tile_id = 'wedding_paperwork';

-- ---- 2. the two branches become couple-visible ------------------------------
UPDATE public.service_categories
   SET marketplace_hidden = FALSE, updated_at = now()
 WHERE id IN ('wedding_paperwork', 'travel_honeymoon');

-- ---- 3. …and so do the five services under them -----------------------------
-- Named explicitly rather than `WHERE tile_id IN (…)`: the branches are the
-- home of exactly these five today, and a blanket update would silently sweep
-- in anything an admin files there later without a second look.
UPDATE public.canonical_service_taxonomy
   SET marketplace_hidden = FALSE, updated_at = now()
 WHERE canonical_service IN (
   'marriage_license_expediting',
   'apostille_dfa_authentication',
   'visa_wedding_logistics',
   'honeymoon_planner',
   'destination_wedding_travel_coordinator'
 );

-- ---- 4. the two that stay shut, asserted rather than assumed ----------------
-- A migration that opens two of four is one careless WHERE away from opening
-- all four. This fails the deploy instead of shipping a supplier category the
-- owner never agreed to.
DO $$
DECLARE
  leaked INT;
BEGIN
  SELECT count(*) INTO leaked
    FROM public.service_categories
   WHERE id IN ('officiants', 'counseling_seminars')
     AND coalesce(marketplace_hidden, FALSE) = FALSE;
  IF leaked > 0 THEN
    RAISE EXCEPTION 'officiants/counseling_seminars must stay admin-only (% visible)', leaked;
  END IF;

  SELECT count(*) INTO leaked
    FROM public.canonical_service_taxonomy
   WHERE tile_id IN ('officiants', 'counseling_seminars')
     AND coalesce(marketplace_hidden, FALSE) = FALSE;
  IF leaked > 0 THEN
    RAISE EXCEPTION 'a celebrant/counselling service became sellable (% visible)', leaked;
  END IF;
END $$;

COMMIT;
