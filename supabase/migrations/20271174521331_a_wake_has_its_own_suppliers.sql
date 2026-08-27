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
--      taxonomy above is only what a vendor NAVIGATES. Not one of the 55 was for
--      a death, and `no-service-lands-in-misc.db.test.ts` exists precisely to
--      refuse a branch with nowhere to land (owner 2026-08-09: *"we do not like
--      having categories under misc"*).
--
-- ⚖ THREE, NOT SIX, AND THAT IS THE INDUSTRY AND NOT LAZINESS. In the
--      Philippines a funeral home IS the bundled business — it holds the chapel,
--      does the embalming, sells the casket and provides the hearse. A memorial
--      park and a crematorium are separate companies. So four of the six new
--      branches fold into `funeral_home`, and the two that are genuinely
--      different trades get their own. A casket retailer filed under
--      `funeral_home` is where a family would look for one.
--
-- ⚠ ADDED, NEVER USED IN THIS MIGRATION. A new enum value cannot be referenced
--      in the transaction that creates it; nothing below writes one.
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'funeral_home';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'cremation';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'memorial_park';

-- 1 ── the folder.
INSERT INTO public.service_categories
       (id, parent_id, tier, kind, label_en, label_short, slug, sort_order, scope,
        status, service_nature, icon_name, applicable_event_types)
VALUES ('farewell', NULL, 1, 'branch',
        'Funeral homes & farewell', 'Farewell', 'farewell', 15, 'global',
        'active', 'service', 'Feather', NULL)
    ON CONFLICT (id) DO NOTHING;

-- 2 ── its leaves. Scoped to the wake and nothing else.
INSERT INTO public.service_categories
       (id, parent_id, tier, kind, label_en, label_short, slug, sort_order, scope,
        status, service_nature, applicable_event_types)
VALUES
  ('funeral_home',  'farewell', 2, 'leaf', 'Funeral homes & chapels',   'Funeral homes', 'funeral-homes',   71, 'global', 'active', 'service', ARRAY['wake']),
  ('casket_urn',    'farewell', 2, 'leaf', 'Caskets & urns',            'Caskets & urns','caskets-urns',    72, 'global', 'active', 'service', ARRAY['wake']),
  ('cremation',     'farewell', 2, 'leaf', 'Cremation',                 'Cremation',     'cremation',       73, 'global', 'active', 'service', ARRAY['wake']),
  ('memorial_park', 'farewell', 2, 'leaf', 'Memorial parks & interment','Memorial parks','memorial-parks',  74, 'global', 'active', 'service', ARRAY['wake']),
  ('hearse',        'farewell', 2, 'leaf', 'Hearse & funeral transport','Hearse',        'hearse',          75, 'global', 'active', 'service', ARRAY['wake']),
  ('embalming',     'farewell', 2, 'leaf', 'Embalming & preparation',   'Preparation',   'embalming',       76, 'global', 'active', 'service', ARRAY['wake'])
    ON CONFLICT (id) DO NOTHING;

-- 3 ── 🛑 THE OFFICIANT IS DELIBERATELY *NOT* TOUCHED, and this block is the
--      record of a change I wrote and then removed.
--
--      I had this migration add `wake` to the `officiants` leaf, on the
--      reasoning that onboarding asks which rite is being held and never offers
--      the priest who leads it. Measured before shipping: `officiants` is
--      `marketplace_hidden = true` — an ADMIN-ONLY filing cabinet, and its own
--      docblock in lib/taxonomy.ts says why: an officiant is not someone you
--      hire from a marketplace, they come with the parish. The 25 deliberately
--      unsold canonicals under it exist so they have a home in the admin tree
--      instead of piling into "Unfiled".
--
--      🔑 SO THE SCOPE WOULD HAVE SURFACED NOTHING, and — worse — the guard I
--      had written for it would have reported success. A gate with no handle,
--      certified by its own test. That reasoning applies to a funeral Mass
--      exactly as it does to a wedding: the priest comes with the parish.
--
--      ⚠ THE SAME IS TRUE OF `livestream`, which I earlier recorded as "already
--      reached by every type because its scope is NULL". True and irrelevant:
--      it is `marketplace_hidden` too. So the onboarding answer *"let them watch
--      the service"* does NOT today resolve to a bookable supplier. That is a
--      real gap, it is NOT this migration's to close, and it is written here
--      rather than left as a pleasant assumption.

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
  IF v_own <> 6 THEN
    RAISE EXCEPTION 'refusing to apply: expected 6 wake-only farewell leaves, found %', v_own;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.service_categories WHERE id='farewell' AND tier=1 AND status='active') THEN
    RAISE EXCEPTION 'refusing to apply: the farewell branch is missing — its leaves would be orphaned and unreachable';
  END IF;

  -- …and every new leaf must be marketplace-VISIBLE. This is the check the
  -- officiant mistake earns: a leaf that is scoped correctly and hidden shows a
  -- family nothing, and every other assertion here would still pass.
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
