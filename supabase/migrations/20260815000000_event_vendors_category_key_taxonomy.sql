-- ============================================================================
-- 20260815000000 — event_vendors.category_key (taxonomy-keyed) · PR-1 (EXPAND)
-- ============================================================================
-- Fully taxonomy-driven onboarding — step 1 of 4 (expand-only · NO behavior change).
-- Spec: Onboarding_Taxonomy_Driven_Spec_2026-06-04.md (corpus root).
--
-- Reverses the locked "couple-side vendor_category does NOT auto-expand" decision
-- (DECISION_LOG 2026-05-30) — owner-ratified 2026-06-04.
--
-- WHAT  add event_vendors.category_key TEXT, FK → service_categories(id), and
--       backfill it from the legacy vendor_category enum via the authoritative
--       enum→tile bridge (apps/web/lib/vendor-category-taxonomy.ts).
-- WHY   a fully taxonomy-driven picker can offer a freshly-promoted tile the rigid
--       vendor_category enum can't store. category_key is taxonomy-keyed TEXT, so
--       couple-side storage auto-grows with the tree.
-- SAFE  expand-only. The legacy `category` enum column is UNTOUCHED and stays the
--       source of truth. category_key is nullable here, dual-written in PR-2, read
--       in PR-3, and the enum is dropped only in PR-4. Reversible until then.
-- RLS   event_vendors already has RLS (enabled at CREATE TABLE, iteration 0006).
--       ADD COLUMN inherits existing policies — no policy change needed.
-- ============================================================================

-- 1. Add the column (nullable during the expand phase).
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS category_key TEXT;

-- 2. Backfill legacy enum → canonical TILE id (service_categories.id, tier 2).
--    Mapping is the authoritative bridge (vendor-category-taxonomy.ts):
--      A · clean 1:1
--      B · coarse alias → scalar = PRIMARY tile (legacy enum keeps the coarse value)
--      C · couple-only EXEMPT → left NULL (officiant / church_fees / security / misc)
--    The EXISTS guard guarantees every written value is a live tier-2 tile, so the
--    FK (step 3) can never fail on a backfilled row. IS NULL makes this idempotent.
UPDATE public.event_vendors ev
SET category_key = m.tile_id
FROM (
  VALUES
    -- A · clean 1:1
    ('venue',                  'reception'),
    ('religious_venue',        'ceremony_venue'),
    ('catering',               'catering'),
    ('photographer',           'photo_video'),
    ('videographer',           'photo_video'),
    ('florist',                'florist'),
    ('cake_maker',             'cake'),
    ('host_emcee',             'host_mc'),
    ('choir',                  'choir'),
    ('string_quartet',         'choir'),
    ('hair_stylist',           'hmua'),
    ('makeup_artist',          'hmua'),
    ('planner_coordinator',    'coordinator'),
    ('gown_designer',          'brides_attire'),
    ('suit_designer',          'grooms_attire'),
    ('rings',                  'jewelleries_accessories'),
    ('invitations_stationery', 'printing'),
    ('lights_and_sound',       'lights_sound'),
    ('led_screens',            'led_wall'),
    ('photobooth',             'photo_booth'),
    ('mobile_bar',             'mobile_bar'),
    ('reception_decor',        'stylist_decorator'),
    ('gifts_and_giveaways',    'souvenir_giveaways'),
    ('accommodation',          'reception'),
    -- B · coarse alias → primary tile (also-spans noted)
    ('band_dj',                'live_band'),       -- also spans: dj
    ('transportation',         'bridal_car'),      -- also spans: guest_shuttle
    -- attire alters: present in the PG enum but ABSENT from the TS bridge (drift);
    -- mapped here so backfill is exhaustive over the live enum.
    ('bridal_gown',            'brides_attire'),
    ('groom_suit',             'grooms_attire'),
    ('bridal_shoes',           'brides_attire'),
    ('groom_shoes',            'grooms_attire'),
    ('entourage_attire',       'womens_attire'),   -- coarse: spans womens + mens
    ('parents_attire',         'womens_attire')    -- coarse: spans womens + mens
    -- C · EXEMPT (officiant, church_fees, security, misc) intentionally omitted → NULL
) AS m(cat, tile_id)
WHERE ev.category::text = m.cat
  AND ev.category_key IS NULL
  AND EXISTS (
    SELECT 1 FROM public.service_categories sc
    WHERE sc.id = m.tile_id AND sc.tier = 2
  );

-- 3. FK → service_categories(id). ON DELETE RESTRICT also serves as the
--    "a running event can't lose a chosen category if an admin deletes its tile"
--    guard (the data-integrity ask, enforced at the DB). ON UPDATE CASCADE is
--    belt-and-suspenders (tile keys are immutable today). Nullable → exempt rows OK.
DO $$ BEGIN
  ALTER TABLE public.event_vendors
    ADD CONSTRAINT event_vendors_category_key_fkey
    FOREIGN KEY (category_key)
    REFERENCES public.service_categories(id)
    ON UPDATE CASCADE ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Index for the PR-3 read cut-over.
CREATE INDEX IF NOT EXISTS event_vendors_category_key_idx
  ON public.event_vendors (category_key);

-- 5. Document the column's intent + lifecycle.
COMMENT ON COLUMN public.event_vendors.category_key IS
  'Taxonomy-keyed tile id (service_categories.id, tier 2). EXPAND phase (PR-1) of '
  'the vendor_category enum -> TEXT migration. Nullable until PR-2 dual-write; legacy '
  '`category` enum stays source of truth until PR-4. NULL for couple-only exempt '
  'categories (officiant/church_fees/security/misc). Spec: '
  'Onboarding_Taxonomy_Driven_Spec_2026-06-04.md.';
