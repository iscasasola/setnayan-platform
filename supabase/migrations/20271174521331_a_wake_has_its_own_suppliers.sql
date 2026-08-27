-- ============================================================================
-- A WAKE HAS ITS OWN SUPPLIERS — AND UNTIL NOW IT HAD NONE
-- ============================================================================
--
-- Owner ruling 2026-08-27, asked directly and answered yes: **we list death-care
-- suppliers.**
--
-- ── WHAT WAS WRONG, MEASURED ────────────────────────────────────────────────
--
-- The marketplace holds 276 canonical services. **Not one of them was for a
-- death.** No funeral home, no chapel, no casket, no urn, no cremation, no
-- memorial park, no hearse. The seven categories a wake could reach were all
-- SHARED leaves borrowed from celebrations — coordinator, catering, florist,
-- choir, photo & video, printing, guest shuttle — every one of which also serves
-- a wedding, and none of which is the thing a family is actually arranging in
-- the first hours after a death.
--
-- Meanwhile **253 of the 276 are scoped to no event type at all**, which means
-- they show for everything. So a family who has just lost someone opened the
-- marketplace and was offered mobile bars, photo booths and dessert spreads —
-- and found nothing for the funeral itself. That is worse than an empty list.
--
-- This migration fixes the second half of that sentence: the wake now has
-- suppliers of its own. **Hiding the celebration services is a separate change**
-- and is deliberately not attempted here — it is a filter over every other type
-- and deserves its own blast radius.
--
-- ── ONE THING THAT ALREADY EXISTED, AND WAS SIMPLY NOT REACHED ──────────────
--
-- 🔑 `officiants` IS NOT NEW AND IS NOT ADDED HERE — it is a shipped leaf under
-- `venue` that a wake could not reach. Onboarding asks the family which rite
-- they are holding (a funeral Mass, a memorial service) and adds `choir` and
-- `printing` for it — but never the priest, pastor or imam who leads it. One
-- array element, not a new category. RULE 0: found, not built.
--
-- ⚠ AND `livestream` NEEDED NOTHING. Its `applicable_event_types` is NULL, which
-- means every type reaches it, so the onboarding answer "let them watch the
-- service" already resolves. Verified rather than assumed — adding `wake` to a
-- NULL array would have converted an everything-leaf into a one-type leaf and
-- silently removed it from sixteen other types.
--
-- ── THE NEW FOLDER, AND WHY IT IS ITS OWN ───────────────────────────────────
--
-- Six leaves under one new tier-1 branch, `farewell`. They could have been
-- scattered into existing folders — a hearse under "Cars & transport", a casket
-- under "Specialty" — and that is exactly the reason not to. A family arranging
-- a funeral should find these together, in one place, not by hunting through
-- folders named for weddings. The folder sorts LAST (15) so no celebration's
-- marketplace changes shape.
--
-- ⚖ EVERY NEW LEAF IS SCOPED TO `wake` ALONE. A casket has no business in a
-- birthday's category list, and an unscoped leaf shows everywhere — which is the
-- defect described at the top of this file, pointed in the other direction.
-- ============================================================================

-- 0 ── THE COARSE CATEGORIES. `vendor_category` is the 55-value enum that is
--      actually STORED on a shop and drives every marketplace filter; the
--      taxonomy below is only what a vendor NAVIGATES. Not one of the 55 was for
--      a death, and `no-service-lands-in-misc.db.test.ts` exists precisely to
--      refuse a branch with nowhere to land (owner 2026-08-09: *"we do not like
--      having categories under misc"*).
--
-- ⚖ THREE, NOT SIX, AND THAT IS THE INDUSTRY AND NOT LAZINESS. In the
--      Philippines the funeral home IS the bundled business — it holds the
--      chapel, does the embalming, sells the casket and provides the hearse. A
--      memorial park and a crematorium are separate companies. So the casket,
--      the hearse and the embalming are SERVICES under the funeral home rather
--      than trades of their own.
--
-- ⚠ ADDED, NEVER USED IN THIS MIGRATION. A new enum value cannot be referenced
--      in the transaction that creates it; nothing below writes one.
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'funeral_home';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'cremation';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'memorial_park';

-- ── EVERY ROW BELOW IS GENERATED, NOT HAND-WRITTEN ──────────────────────────
--
-- 🔑 `scripts/gen-taxonomy-seed.ts` emits these from `lib/taxonomy.ts`, which is
-- the authored source of truth for the tree during the Phase-1 transition. My
-- first cut of this migration hand-wrote SIX branches; the code defines THREE
-- tiles, and the two would have disagreed from the day they landed — a DB with
-- branches the code has no tile for. Regenerated and spliced instead, so DB and
-- code say the same thing by construction.
--
-- Re-run after any change to TAXONOMY_MAP or the folder/tile maps:
--   npx tsx scripts/gen-taxonomy-seed.ts

-- 1 ── the branch + its three tiles.
INSERT INTO public.service_categories
  (id, parent_id, tier, kind, label_en, label_short, slug, sort_order, scope, marketplace_hidden)
VALUES
  ('farewell', NULL, 1, 'branch', 'Funeral homes & farewell', 'Farewell', 'farewell', 15, 'global', FALSE),
  ('funeral_home', 'farewell', 2, 'leaf', 'Funeral Home', NULL, 'funeral-homes', 75, 'global', FALSE),
  ('cremation', 'farewell', 2, 'leaf', 'Cremation', NULL, 'cremation', 76, 'global', FALSE),
  ('memorial_park', 'farewell', 2, 'leaf', 'Memorial Park', NULL, 'memorial-parks', 77, 'global', FALSE)
    ON CONFLICT (id) DO NOTHING;

-- 2 ── the twelve services under them.
--      🇵🇭 `body_repatriation` is not padding — a family burying an OFW is
--      arranging exactly this, and no wedding-shaped taxonomy would have
--      produced it.
INSERT INTO public.canonical_service_taxonomy
  (canonical_service, folder_id, tile_id, phase, faith, is_ph, is_setnayan, is_rental, dietary, is_tradition, marketplace_hidden, secondary_tiles)
VALUES
  ('funeral_chapel', 'farewell', 'funeral_home', 'V1.5+', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('wake_package', 'farewell', 'funeral_home', 'V1.5+', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('casket', 'farewell', 'funeral_home', 'V1.5+', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('urn', 'farewell', 'funeral_home', 'V1.5+', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('embalming_preparation', 'farewell', 'funeral_home', 'V1.5+', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('hearse_funeral_transport', 'farewell', 'funeral_home', 'V1.5+', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('body_repatriation', 'farewell', 'funeral_home', 'V1.5+', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('cremation_service', 'farewell', 'cremation', 'V1.5+', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('columbarium_niche', 'farewell', 'cremation', 'V1.5+', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('memorial_lot', 'farewell', 'memorial_park', 'V1.5+', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('interment_service', 'farewell', 'memorial_park', 'V1.5+', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('mausoleum', 'farewell', 'memorial_park', 'V1.5+', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[])
    ON CONFLICT (canonical_service) DO NOTHING;

-- 3 ── the SCOPE, which the generator does not emit because `lib/taxonomy.ts`
--      does not carry it. Both tables, so a filter reading either one agrees.
--      ⚖ Scoped to the wake ALONE: an unscoped leaf shows at every celebration,
--      which is a casket in a birthday's category list.
UPDATE public.service_categories
   SET applicable_event_types = ARRAY['wake']
 WHERE parent_id = 'farewell'
   AND applicable_event_types IS DISTINCT FROM ARRAY['wake'];

UPDATE public.canonical_service_taxonomy
   SET applicable_event_types = ARRAY['wake']
 WHERE folder_id = 'farewell'
   AND applicable_event_types IS DISTINCT FROM ARRAY['wake'];

COMMENT ON TABLE public.service_categories IS
  'The marketplace taxonomy. NOTE (2026-08-27): a wake reaches its own '
  'death-care leaves under the `farewell` branch, scoped to that type alone. '
  'A leaf whose applicable_event_types is NULL shows for EVERY type — do not '
  '"add wake" to one of those, it converts an everything-leaf into a one-type '
  'leaf and removes it from the other sixteen.';

-- ── REFUSE TO APPLY IF THE WAKE STILL HAS NOTHING OF ITS OWN ────────────────
DO $guard$
DECLARE
  v_own   INTEGER;
  v_total INTEGER;
BEGIN
  SELECT count(*) INTO v_own
    FROM public.service_categories
   WHERE parent_id = 'farewell' AND status = 'active'
     AND applicable_event_types = ARRAY['wake'];
  IF v_own <> 3 THEN
    RAISE EXCEPTION 'refusing to apply: expected 3 wake-only farewell leaves, found %', v_own;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.service_categories WHERE id='farewell' AND tier=1 AND status='active') THEN
    RAISE EXCEPTION 'refusing to apply: the farewell branch is missing — its leaves would be orphaned and unreachable';
  END IF;

  -- …and every new leaf must be marketplace-VISIBLE. This is the check the
  -- officiant mistake earns: a leaf that is scoped correctly and hidden shows a
  -- family nothing, and every other assertion here would still pass.
  -- …and every tile must carry SERVICES. A tile with zero canonicals is a DEAD
  -- SHELF: marketplace search short-circuits on it and the vendor picker prunes
  -- the branch, so the trade is unfindable with no error anywhere. This is the
  -- guard `taxonomy-tile-reachability` enforces in code; asserted here too
  -- because the data is what actually decides.
  IF (SELECT count(*) FROM public.canonical_service_taxonomy WHERE folder_id='farewell') < 12 THEN
    RAISE EXCEPTION 'refusing to apply: the farewell tiles have fewer than 12 services — a tile with none renders as an empty shelf and the trade becomes unfindable';
  END IF;

  IF EXISTS (SELECT 1 FROM public.service_categories
              WHERE parent_id = 'farewell' AND marketplace_hidden IS TRUE) THEN
    RAISE EXCEPTION 'refusing to apply: a farewell leaf is marketplace_hidden — it would be scoped to the wake and invisible to the family';
  END IF;

  -- …and no new leaf may have escaped its scope. An unscoped leaf shows at every
  -- celebration, which is a casket in a birthday's category list.
  SELECT count(*) INTO v_total
    FROM public.service_categories
   WHERE parent_id = 'farewell'
     AND (applicable_event_types IS NULL OR cardinality(applicable_event_types) <> 1);
  IF v_total <> 0 THEN
    RAISE EXCEPTION 'refusing to apply: % farewell leaf/leaves are not scoped to the wake alone', v_total;
  END IF;
END;
$guard$;
