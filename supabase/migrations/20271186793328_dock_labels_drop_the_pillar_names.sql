-- dock_labels_drop_the_pillar_names
--
-- ── THE HOMEPAGE DOCK STILL SAID "SURI", AND FOUR OTHER RETIRED NAMES ───────
--
-- The Suri→Sai rename (PR #5035, 2026-08-31) changed the CODE and left the
-- DATA. `homepage_background_videos` slot 4 has been live and published this
-- whole time with `label = 'Suri · Setnayan AI'`, so every visitor to the
-- homepage kept seeing the old name — the rename was complete everywhere
-- except the one place customers actually look.
--
-- 🔑 A RENAME THAT ONLY TOUCHES CODE IS NOT A RENAME. These labels are rows,
-- seeded by 20270328031951 and last edited by 20270328649472 — which is the
-- precedent this migration follows: that one renamed Likhaan→Likha,
-- Planuhan→Plano, Surian→Suri exactly this way.
--
-- ── THE WIDER DECISION THIS CARRIES OUT (owner, 2026-08-31 / 2026-09-01) ────
-- The five Filipino pillar names are retired in favour of plain functional
-- ones. The owner picked the plain form over keeping a "Name · Descriptor"
-- pair, and chose "Planner" over "3D Plan" for slot 3 — the planning surface,
-- not the 3D venue walk, which is a different feature.
--
--   slot 1  Ala Ala · Memory Hub      → Memories
--   slot 2  Likha · Creative Studio   → Studio
--   slot 3  Plano · Planner           → Planner
--   slot 4  Suri · Setnayan AI        → Sai
--   slot 5  Tiangge · Marketplace     → Marketplace
--
-- ⚠ `pillar_key` IS DELIBERATELY NOT TOUCHED. The keys still read 'ala-ala',
-- 'suri', 'tiangge' and so on. Measured before writing this: `pillar_key` is
-- SELECTed and carried through `lib/background-videos.ts` into the admin
-- manager, but NOTHING anywhere branches on its value — no icon map, no
-- routing, no equality test. Renaming the keys would change no behaviour a
-- customer can see while adding the risk that one unfound reference goes
-- stale. The label is what renders; the key is an identifier, and identifiers
-- are allowed to carry their history.
--
-- IDEMPOTENT: every statement is a targeted UPDATE guarded on BOTH the slot and
-- the exact label it replaces, so a re-apply is a no-op rather than a second
-- rename of something an admin has since edited by hand.

BEGIN;

UPDATE public.homepage_background_videos
  SET label = 'Memories'
  WHERE slot = 1 AND label = 'Ala Ala · Memory Hub';

UPDATE public.homepage_background_videos
  SET label = 'Studio'
  WHERE slot = 2 AND label = 'Likha · Creative Studio';

UPDATE public.homepage_background_videos
  SET label = 'Planner'
  WHERE slot = 3 AND label = 'Plano · Planner';

UPDATE public.homepage_background_videos
  SET label = 'Sai'
  WHERE slot = 4 AND label = 'Suri · Setnayan AI';

UPDATE public.homepage_background_videos
  SET label = 'Marketplace'
  WHERE slot = 5 AND label = 'Tiangge · Marketplace';

-- ── POST-CONDITION: no retired pillar name survives in a label ──────────────
-- The house style (see 20271183769435) is to ASSERT the outcome rather than
-- trust the UPDATEs, so a silently-zero-row rename fails loudly here instead of
-- shipping green and leaving the old name on the homepage — which is exactly
-- how this defect survived a whole rename in the first place.
--
-- 'Plano' is matched as a whole word so it cannot be tripped by the legitimate
-- word "Planner", which is the label slot 3 is meant to keep.
DO $$
DECLARE
  stale INTEGER;
BEGIN
  SELECT count(*) INTO stale
  FROM public.homepage_background_videos
  WHERE label ~* '(Ala Ala|Likhaan|Likha|Planuhan|\mPlano\M|Surian|Suri|Tiangge)';

  IF stale > 0 THEN
    RAISE EXCEPTION
      'dock labels still carry a retired pillar name in % row(s) — the rename did not land',
      stale;
  END IF;
END $$;

COMMIT;
