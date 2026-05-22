-- ============================================================================
-- 20260604110000_vendor_packages.sql
--
-- Vendor packages + cascade-lock + consumable budget (owner directive
-- 2026-05-22). Lands the bundled multi-category offering pattern that
-- Filipino hotels sell as their "wedding package" SKU.
--
-- OWNER DIRECTIVE (verbatim, 2026-05-22)
-- ---------------------------------------
-- "if the vendor has a locked package, meaning their package includes this
--  and that, once it is finalized that the couple decides to include them
--  will be automatically locked. for example, some hotels offer a locked
--  price with cake, catering, lights and sounds, photobooth, bridal car,
--  etc. this will be planned with that vendor and will finalize the plan
--  there. They can either add it or remove it. Sometimes, hotel would
--  consider add consumables where they can use these budget for something
--  else."
--
-- THE PATTERN
-- ------------
-- Sofitel · Shangri-La · Marriott · Conrad sell bundled wedding packages
-- where ONE price covers reception venue + catering + cake + lights/sound
-- + photobooth + bridal car. Host locks the package → all included
-- categories auto-lock to that vendor → consumable budget lets host swap
-- one item for another within the package.
--
-- THREE TABLES
-- ------------
-- 1. vendor_packages — the SKU itself. Per-vendor, multi-item, has a total
--    price + an optional consumable budget pool.
-- 2. vendor_package_items — line items inside a package. Each maps to a
--    canonical_service (TEXT, NOT the legacy `vendor_category` enum; uses
--    the iteration-0044 canonical_service taxonomy from migration
--    20260521040000_iteration_0044_v11_full_taxonomy_seeds.sql).
-- 3. event_vendor_packages — the booking row when a host locks a package
--    on their event. Carries the customizations (removed items, consumable
--    allocations) + the cascaded total + status.
--
-- ONE ALTER on event_vendors: a nullable FK back to event_vendor_packages
-- so each cascade-created event_vendors row knows which package booking
-- it belongs to. Powers the "from package" badge on planning-cards.
--
-- IDEMPOTENT. CASCADE-LOCK behavior is implemented in app-layer server
-- actions (apps/web/app/dashboard/[eventId]/vendors/[vendorProfileId]/
-- package-actions.ts), NOT in DB triggers — the host-permission checks
-- need to share session context with the rest of the dashboard.
--
-- RLS pattern matches existing 0006 event_vendors convention:
--   • event_vendor_packages: hosts read+write via current_couple_event_ids()
--   • vendor_packages + vendor_package_items: public read when is_active,
--     owner+admin write (mirrors vendor_profiles + vendor_services).
--
-- SEED: sample packages for 6 hotels (Sofitel · Shangri-La · Marriott ·
-- Conrad · Discovery Primea · Manila Hotel). Idempotent ILIKE-anchored
-- vendor lookups — if no matching vendor_profiles row exists, the SELECT
-- returns 0 rows and the INSERT is a no-op. The brief explicitly accepts
-- this graceful no-op behavior: real hotel vendor onboarding ramps post-
-- pilot per the pilot-first timeline (CLAUDE.md 2026-05-18 row 8).
--
-- WHY (per feedback_setnayan_document_changes_with_why.md)
-- --------------------------------------------------------
-- Filipino hotel wedding packages are the canonical case where one vendor
-- delivers multiple categories under one price. Without this primitive,
-- couples have to manually create 6 separate event_vendors rows per
-- hotel booking, none of which share state with each other or know they
-- belong together. With this primitive, locking the Sofitel package
-- cascades 6 event_vendors rows (reception_venue, catering, cake,
-- lights_sound, photobooth, transportation_bridal_car), each carrying
-- the same event_vendor_package_id so the planning-card "from package"
-- badge can render uniformly across all 6 planning groups.
--
-- The consumable budget primitive lets the hotel offer flexibility:
-- "₱200K can flex between extra hours of sound or upgrading the buffet."
-- Stored as `consumable_budget_centavos` + per-item `replacement_value_centavos`.
-- When the host unchecks an item, the host's remaining_consumable_centavos
-- grows by that item's replacement value (the credit they get back).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_packages — the SKU
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_packages (
  package_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id             UUID NOT NULL
                                REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  package_name                  TEXT NOT NULL,
  description                   TEXT,
  total_price_centavos          BIGINT NOT NULL CHECK (total_price_centavos >= 0),
  consumable_budget_centavos    BIGINT NOT NULL DEFAULT 0 CHECK (consumable_budget_centavos >= 0),
  -- TRUE = host can flex consumable budget (uncheck items → budget grows by replacement value).
  -- FALSE = items are baked in; removing an item just reduces total, no flex pool.
  is_consumable_flexible        BOOLEAN NOT NULL DEFAULT FALSE,
  -- The "anchor" canonical_service this package centers on (usually
  -- reception_venue or catering). NOT a FK to canonical_service_schemas
  -- because the V1.1 taxonomy seeds use TEXT strings, not an enum table.
  primary_canonical_service     TEXT NOT NULL,
  is_active                     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_packages_vendor_idx
  ON public.vendor_packages(vendor_profile_id);

CREATE INDEX IF NOT EXISTS vendor_packages_active_idx
  ON public.vendor_packages(vendor_profile_id)
  WHERE is_active = TRUE;

ALTER TABLE public.vendor_packages ENABLE ROW LEVEL SECURITY;

-- Public read for active packages — couples browse them on /v/[slug].
DROP POLICY IF EXISTS vendor_packages_public_read ON public.vendor_packages;
CREATE POLICY vendor_packages_public_read
  ON public.vendor_packages
  FOR SELECT
  USING (is_active = TRUE);

-- Owner writes (vendor_profiles.user_id is the canonical owner column in
-- this repo, NOT owner_user_id which the brief mis-named).
DROP POLICY IF EXISTS vendor_packages_owner_write ON public.vendor_packages;
CREATE POLICY vendor_packages_owner_write
  ON public.vendor_packages
  FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid() AND account_type = 'admin'
    )
  )
  WITH CHECK (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid() AND account_type = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 2. vendor_package_items — the line items
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_package_items (
  item_id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id                    UUID NOT NULL
                                REFERENCES public.vendor_packages(package_id) ON DELETE CASCADE,
  -- canonical_service taxonomy string (iteration 0044, migration
  -- 20260521040000_iteration_0044_v11_full_taxonomy_seeds.sql). TEXT, no
  -- FK constraint — the v11 taxonomy is stable but the canonical-service
  -- table itself doesn't have a unique PK we can FK into.
  canonical_service             TEXT NOT NULL,
  service_description           TEXT NOT NULL,
  -- TRUE = item is on by default when the host locks the package.
  -- Host can uncheck items in the customization modal; replacement_value
  -- centavos refund into the consumable pool (when is_consumable_flexible
  -- is TRUE on the parent package).
  is_default_included           BOOLEAN NOT NULL DEFAULT TRUE,
  -- Value attributed to this line item. Used as the credit when the host
  -- removes the item (refunds into consumable pool). MUST sum to ≤
  -- total_price_centavos − consumable_budget_centavos for a balanced
  -- package; enforcement is at the app layer, not in DB.
  replacement_value_centavos    BIGINT NOT NULL DEFAULT 0
                                CHECK (replacement_value_centavos >= 0),
  display_order                 INTEGER NOT NULL DEFAULT 0,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_package_items_package_idx
  ON public.vendor_package_items(package_id, display_order);

ALTER TABLE public.vendor_package_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_package_items_public_read ON public.vendor_package_items;
CREATE POLICY vendor_package_items_public_read
  ON public.vendor_package_items
  FOR SELECT
  USING (
    package_id IN (
      SELECT package_id FROM public.vendor_packages
      WHERE is_active = TRUE
    )
  );

DROP POLICY IF EXISTS vendor_package_items_owner_write ON public.vendor_package_items;
CREATE POLICY vendor_package_items_owner_write
  ON public.vendor_package_items
  FOR ALL
  TO authenticated
  USING (
    package_id IN (
      SELECT vp.package_id
      FROM public.vendor_packages vp
      INNER JOIN public.vendor_profiles p
        ON vp.vendor_profile_id = p.vendor_profile_id
      WHERE p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid() AND account_type = 'admin'
    )
  )
  WITH CHECK (
    package_id IN (
      SELECT vp.package_id
      FROM public.vendor_packages vp
      INNER JOIN public.vendor_profiles p
        ON vp.vendor_profile_id = p.vendor_profile_id
      WHERE p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid() AND account_type = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 3. event_vendor_packages — the booking row
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_vendor_packages (
  booking_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                      UUID NOT NULL
                                REFERENCES public.events(event_id) ON DELETE CASCADE,
  package_id                    UUID NOT NULL
                                REFERENCES public.vendor_packages(package_id),
  -- The primary event_vendors row that anchors this booking (usually the
  -- reception_venue row). Optional + ON DELETE SET NULL because the host
  -- can release the package without nuking every cascade-created row;
  -- when individual event_vendors rows get manually deleted, the booking
  -- survives with a null anchor.
  primary_event_vendor_id       UUID REFERENCES public.event_vendors(vendor_id)
                                ON DELETE SET NULL,
  status                        TEXT NOT NULL DEFAULT 'considering'
                                CHECK (status IN ('considering', 'locked', 'released')),
  -- {removed_item_ids: [...], consumable_allocations: {category: centavos}}.
  -- Persisted exactly as submitted from the customization modal so we can
  -- re-render the host's choices on the manage page.
  customizations_json           JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Live remaining-consumable pool (refreshed on remove-item / re-add).
  -- = vendor_packages.consumable_budget_centavos + sum(removed item replacement values).
  remaining_consumable_centavos BIGINT NOT NULL DEFAULT 0
                                CHECK (remaining_consumable_centavos >= 0),
  -- Cascaded total at lock time. = total_price_centavos − sum(removed item
  -- replacement values when is_consumable_flexible is FALSE). When
  -- is_consumable_flexible is TRUE, total_locked_centavos = total_price_centavos
  -- regardless of removed items (the money stays in the package, just
  -- redirected via the consumable pool).
  total_locked_centavos         BIGINT NOT NULL DEFAULT 0
                                CHECK (total_locked_centavos >= 0),
  locked_at                     TIMESTAMPTZ,
  released_at                   TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_vendor_packages_event_idx
  ON public.event_vendor_packages(event_id);

CREATE INDEX IF NOT EXISTS event_vendor_packages_status_idx
  ON public.event_vendor_packages(event_id, status);

ALTER TABLE public.event_vendor_packages ENABLE ROW LEVEL SECURITY;

-- RLS mirrors event_vendors: hosts on the event can read+write their own
-- package bookings. Uses current_couple_event_ids() per the canonical
-- repo pattern (helper from migration 20260513040000_fix_rls_infinite_
-- recursion). Brief mentioned event_moderators directly; using the
-- helper keeps RLS aligned with how /dashboard/[eventId]/vendors
-- already filters event_vendors today.
DROP POLICY IF EXISTS event_vendor_packages_couple_read ON public.event_vendor_packages;
CREATE POLICY event_vendor_packages_couple_read
  ON public.event_vendor_packages FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_vendor_packages_couple_write ON public.event_vendor_packages;
CREATE POLICY event_vendor_packages_couple_write
  ON public.event_vendor_packages FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

-- ----------------------------------------------------------------------------
-- 4. event_vendors.event_vendor_package_id — the back-link
-- ----------------------------------------------------------------------------

-- Each event_vendors row created by a package-lock cascade carries this
-- FK so the planning-card "from package" badge can render. NULL on
-- normal (non-package) event_vendors rows.
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS event_vendor_package_id UUID
    REFERENCES public.event_vendor_packages(booking_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS event_vendors_package_idx
  ON public.event_vendors(event_vendor_package_id)
  WHERE event_vendor_package_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. updated_at triggers
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vendor_packages_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_packages_updated_at ON public.vendor_packages;
CREATE TRIGGER vendor_packages_updated_at
  BEFORE UPDATE ON public.vendor_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.vendor_packages_set_updated_at();

DROP TRIGGER IF EXISTS event_vendor_packages_updated_at ON public.event_vendor_packages;
CREATE TRIGGER event_vendor_packages_updated_at
  BEFORE UPDATE ON public.event_vendor_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.vendor_packages_set_updated_at();

COMMIT;

-- ============================================================================
-- 6. SEED — sample packages for 6 popular Filipino hotels
--
-- Idempotent via ILIKE-anchored vendor_profiles lookups + the "NOT EXISTS"
-- guard on the parent INSERT. If a hotel's vendor_profiles row doesn't
-- exist yet, the SELECT returns 0 rows and the INSERT is a no-op.
--
-- Hotels seeded (matches venue_directory 2026-06-04 reception seed):
--   • Sofitel Philippine Plaza   (Platinum Wedding Package — ₱1,400,000)
--   • Shangri-La at the Fort BGC (Grand Ballroom Package — ₱1,800,000)
--   • Manila Marriott            (Grand Ballroom Wedding — ₱1,200,000)
--   • Conrad Manila              (Forbes Ballroom Package — ₱1,500,000)
--   • Discovery Primea           (Bel-Air Wedding Suite — ₱950,000)
--   • Manila Hotel               (Fiesta Pavilion Heritage — ₱1,300,000)
--
-- Each package: 6 default-included items + a consumable budget pool
-- (typically ~10-15% of total, flexible).
--
-- IMPORTANT: hotels currently live in venue_directory (real curated
-- locations), NOT vendor_profiles. This seed will no-op against the
-- venue_directory table — packages only bind to vendor_profiles rows
-- (real marketplace vendors). Real hotel-vendor onboarding ramps post-
-- pilot per CLAUDE.md 2026-05-18 row 8 ("pilot-before-June-1"). When
-- hotels onboard as real vendor_profiles rows, re-running this migration
-- (idempotent) will seed their default packages automatically.
-- ============================================================================

BEGIN;

-- Sofitel Philippine Plaza · Platinum Wedding Package
WITH new_pkg AS (
  INSERT INTO public.vendor_packages (
    vendor_profile_id, package_name, description,
    total_price_centavos, consumable_budget_centavos, is_consumable_flexible,
    primary_canonical_service, is_active
  )
  SELECT
    vp.vendor_profile_id,
    'Platinum Wedding Package',
    'Sunset Pavilion reception + dinner buffet for 200 guests + 3-tier cake + lights and sound + photobooth + bridal car. The ₱200,000 consumable budget flexes — apply it to extra sound hours, upgraded buffet, or premium bar.',
    140000000, -- ₱1,400,000
    20000000,  -- ₱200,000 consumable
    TRUE,
    'reception_venue',
    TRUE
  FROM public.vendor_profiles vp
  WHERE vp.business_name ILIKE '%sofitel%'
    AND NOT EXISTS (
      SELECT 1 FROM public.vendor_packages existing
      WHERE existing.vendor_profile_id = vp.vendor_profile_id
        AND existing.package_name = 'Platinum Wedding Package'
    )
  LIMIT 1
  RETURNING package_id
)
INSERT INTO public.vendor_package_items (
  package_id, canonical_service, service_description,
  is_default_included, replacement_value_centavos, display_order
)
SELECT package_id, 'reception_venue',          'Sunset Pavilion — capacity 250',                                    TRUE, 0,        1 FROM new_pkg
UNION ALL
SELECT package_id, 'catering',                 'Buffet dinner — 200 guests, Filipino-Mediterranean menu',          TRUE, 50000000, 2 FROM new_pkg
UNION ALL
SELECT package_id, 'cake_desserts',            '3-tier wedding cake — choice of flavor + custom topper',           TRUE, 8000000,  3 FROM new_pkg
UNION ALL
SELECT package_id, 'lights_sound',             'PA system + LED stage lights + in-house sound engineer',           TRUE, 12000000, 4 FROM new_pkg
UNION ALL
SELECT package_id, 'photobooth',               'Classic photobooth — 4-hour run with unlimited prints',            TRUE, 6000000,  5 FROM new_pkg
UNION ALL
SELECT package_id, 'transportation_bridal_car','Bridal car — Mercedes-Benz E-Class, 4 hours including chauffeur', TRUE, 4000000,  6 FROM new_pkg;

-- Shangri-La at the Fort BGC · Grand Ballroom Package
WITH new_pkg AS (
  INSERT INTO public.vendor_packages (
    vendor_profile_id, package_name, description,
    total_price_centavos, consumable_budget_centavos, is_consumable_flexible,
    primary_canonical_service, is_active
  )
  SELECT
    vp.vendor_profile_id,
    'Grand Ballroom Wedding Package',
    'Grand Ballroom for 250 guests + premium buffet + 4-tier cake + full lights and sound + 360 photobooth + luxury bridal car. ₱250,000 consumable budget moves freely across food, beverage, or extra hours.',
    180000000, -- ₱1,800,000
    25000000,  -- ₱250,000 consumable
    TRUE,
    'reception_venue',
    TRUE
  FROM public.vendor_profiles vp
  WHERE vp.business_name ILIKE '%shangri%la%'
    AND NOT EXISTS (
      SELECT 1 FROM public.vendor_packages existing
      WHERE existing.vendor_profile_id = vp.vendor_profile_id
        AND existing.package_name = 'Grand Ballroom Wedding Package'
    )
  LIMIT 1
  RETURNING package_id
)
INSERT INTO public.vendor_package_items (
  package_id, canonical_service, service_description,
  is_default_included, replacement_value_centavos, display_order
)
SELECT package_id, 'reception_venue',          'Grand Ballroom — capacity 350 with grand foyer',                  TRUE, 0,        1 FROM new_pkg
UNION ALL
SELECT package_id, 'catering',                 'Premium buffet — 250 guests, Asian-Continental selection',        TRUE, 65000000, 2 FROM new_pkg
UNION ALL
SELECT package_id, 'cake_desserts',            '4-tier wedding cake + dessert table',                             TRUE, 12000000, 3 FROM new_pkg
UNION ALL
SELECT package_id, 'lights_sound',             'Full lights and sound — DMX rig with operator',                   TRUE, 18000000, 4 FROM new_pkg
UNION ALL
SELECT package_id, 'photobooth',               '360 video photobooth — slow-motion premium service',              TRUE, 10000000, 5 FROM new_pkg
UNION ALL
SELECT package_id, 'transportation_bridal_car','Luxury bridal car — BMW 7 Series, 5 hours',                       TRUE, 6000000,  6 FROM new_pkg;

-- Manila Marriott · Grand Ballroom Wedding
WITH new_pkg AS (
  INSERT INTO public.vendor_packages (
    vendor_profile_id, package_name, description,
    total_price_centavos, consumable_budget_centavos, is_consumable_flexible,
    primary_canonical_service, is_active
  )
  SELECT
    vp.vendor_profile_id,
    'Marriott Grand Ballroom Wedding',
    'Grand Ballroom for 200 guests + Marriott-signature buffet + 3-tier cake + lights and sound + classic photobooth + bridal car. ₱150,000 consumable budget for upgrades and add-ons.',
    120000000, -- ₱1,200,000
    15000000,  -- ₱150,000 consumable
    TRUE,
    'reception_venue',
    TRUE
  FROM public.vendor_profiles vp
  WHERE vp.business_name ILIKE '%marriott%'
    AND NOT EXISTS (
      SELECT 1 FROM public.vendor_packages existing
      WHERE existing.vendor_profile_id = vp.vendor_profile_id
        AND existing.package_name = 'Marriott Grand Ballroom Wedding'
    )
  LIMIT 1
  RETURNING package_id
)
INSERT INTO public.vendor_package_items (
  package_id, canonical_service, service_description,
  is_default_included, replacement_value_centavos, display_order
)
SELECT package_id, 'reception_venue',          'Grand Ballroom — capacity 250',                                    TRUE, 0,        1 FROM new_pkg
UNION ALL
SELECT package_id, 'catering',                 'Marriott-signature buffet — 200 guests',                          TRUE, 42000000, 2 FROM new_pkg
UNION ALL
SELECT package_id, 'cake_desserts',            '3-tier wedding cake — choice of flavor',                          TRUE, 7000000,  3 FROM new_pkg
UNION ALL
SELECT package_id, 'lights_sound',             'PA + LED lights + sound engineer',                                TRUE, 10000000, 4 FROM new_pkg
UNION ALL
SELECT package_id, 'photobooth',               'Classic photobooth — 4-hour run',                                 TRUE, 5500000,  5 FROM new_pkg
UNION ALL
SELECT package_id, 'transportation_bridal_car','Bridal car — Mercedes E-Class, 4 hours',                          TRUE, 3500000,  6 FROM new_pkg;

-- Conrad Manila · Forbes Ballroom Package
WITH new_pkg AS (
  INSERT INTO public.vendor_packages (
    vendor_profile_id, package_name, description,
    total_price_centavos, consumable_budget_centavos, is_consumable_flexible,
    primary_canonical_service, is_active
  )
  SELECT
    vp.vendor_profile_id,
    'Forbes Ballroom Wedding Package',
    'Forbes Ballroom for 200 guests with Manila Bay views + plated dinner + 3-tier cake + lights and sound + photobooth + luxury bridal car. ₱200,000 consumable budget — flexes freely.',
    150000000, -- ₱1,500,000
    20000000,  -- ₱200,000 consumable
    TRUE,
    'reception_venue',
    TRUE
  FROM public.vendor_profiles vp
  WHERE vp.business_name ILIKE '%conrad%'
    AND NOT EXISTS (
      SELECT 1 FROM public.vendor_packages existing
      WHERE existing.vendor_profile_id = vp.vendor_profile_id
        AND existing.package_name = 'Forbes Ballroom Wedding Package'
    )
  LIMIT 1
  RETURNING package_id
)
INSERT INTO public.vendor_package_items (
  package_id, canonical_service, service_description,
  is_default_included, replacement_value_centavos, display_order
)
SELECT package_id, 'reception_venue',          'Forbes Ballroom — capacity 250 with bayfront foyer',              TRUE, 0,        1 FROM new_pkg
UNION ALL
SELECT package_id, 'catering',                 'Plated dinner — 200 guests, 5-course Continental',                TRUE, 55000000, 2 FROM new_pkg
UNION ALL
SELECT package_id, 'cake_desserts',            '3-tier wedding cake + dessert station',                           TRUE, 9000000,  3 FROM new_pkg
UNION ALL
SELECT package_id, 'lights_sound',             'PA + LED stage lights + sound engineer',                          TRUE, 13000000, 4 FROM new_pkg
UNION ALL
SELECT package_id, 'photobooth',               'Mirror photobooth — premium service',                             TRUE, 7000000,  5 FROM new_pkg
UNION ALL
SELECT package_id, 'transportation_bridal_car','Luxury bridal car — Mercedes S-Class, 5 hours',                   TRUE, 5500000,  6 FROM new_pkg;

-- Discovery Primea · Bel-Air Wedding Suite
WITH new_pkg AS (
  INSERT INTO public.vendor_packages (
    vendor_profile_id, package_name, description,
    total_price_centavos, consumable_budget_centavos, is_consumable_flexible,
    primary_canonical_service, is_active
  )
  SELECT
    vp.vendor_profile_id,
    'Bel-Air Wedding Suite Package',
    'Bel-Air Ballroom for 150 guests + Filipino-modern buffet + 3-tier cake + lights and sound + photobooth + bridal car. ₱100,000 consumable budget for tasteful add-ons.',
    95000000, -- ₱950,000
    10000000, -- ₱100,000 consumable
    TRUE,
    'reception_venue',
    TRUE
  FROM public.vendor_profiles vp
  WHERE vp.business_name ILIKE '%discovery primea%'
    AND NOT EXISTS (
      SELECT 1 FROM public.vendor_packages existing
      WHERE existing.vendor_profile_id = vp.vendor_profile_id
        AND existing.package_name = 'Bel-Air Wedding Suite Package'
    )
  LIMIT 1
  RETURNING package_id
)
INSERT INTO public.vendor_package_items (
  package_id, canonical_service, service_description,
  is_default_included, replacement_value_centavos, display_order
)
SELECT package_id, 'reception_venue',          'Bel-Air Ballroom — capacity 180',                                 TRUE, 0,        1 FROM new_pkg
UNION ALL
SELECT package_id, 'catering',                 'Filipino-modern buffet — 150 guests',                             TRUE, 36000000, 2 FROM new_pkg
UNION ALL
SELECT package_id, 'cake_desserts',            '3-tier wedding cake — artisan flavors',                           TRUE, 6500000,  3 FROM new_pkg
UNION ALL
SELECT package_id, 'lights_sound',             'PA + LED stage lights',                                            TRUE, 8500000,  4 FROM new_pkg
UNION ALL
SELECT package_id, 'photobooth',               'Polaroid photobooth — 4-hour run',                                 TRUE, 4500000,  5 FROM new_pkg
UNION ALL
SELECT package_id, 'transportation_bridal_car','Bridal car — Audi A6, 4 hours',                                    TRUE, 3500000,  6 FROM new_pkg;

-- Manila Hotel · Fiesta Pavilion Heritage
WITH new_pkg AS (
  INSERT INTO public.vendor_packages (
    vendor_profile_id, package_name, description,
    total_price_centavos, consumable_budget_centavos, is_consumable_flexible,
    primary_canonical_service, is_active
  )
  SELECT
    vp.vendor_profile_id,
    'Fiesta Pavilion Heritage Package',
    'Historic Fiesta Pavilion for 250 guests + Filipino-Spanish buffet + 3-tier cake + lights and sound + classic photobooth + bridal car. ₱180,000 consumable budget — heritage venue, modern flexibility.',
    130000000, -- ₱1,300,000
    18000000,  -- ₱180,000 consumable
    TRUE,
    'reception_venue',
    TRUE
  FROM public.vendor_profiles vp
  WHERE vp.business_name ILIKE '%manila hotel%'
    AND NOT EXISTS (
      SELECT 1 FROM public.vendor_packages existing
      WHERE existing.vendor_profile_id = vp.vendor_profile_id
        AND existing.package_name = 'Fiesta Pavilion Heritage Package'
    )
  LIMIT 1
  RETURNING package_id
)
INSERT INTO public.vendor_package_items (
  package_id, canonical_service, service_description,
  is_default_included, replacement_value_centavos, display_order
)
SELECT package_id, 'reception_venue',          'Fiesta Pavilion — heritage ballroom, capacity 300',                TRUE, 0,        1 FROM new_pkg
UNION ALL
SELECT package_id, 'catering',                 'Filipino-Spanish buffet — 250 guests',                            TRUE, 48000000, 2 FROM new_pkg
UNION ALL
SELECT package_id, 'cake_desserts',            '3-tier wedding cake — classic Filipino flavors',                  TRUE, 7500000,  3 FROM new_pkg
UNION ALL
SELECT package_id, 'lights_sound',             'PA + LED stage lights + sound engineer',                          TRUE, 11000000, 4 FROM new_pkg
UNION ALL
SELECT package_id, 'photobooth',               'Classic photobooth — 4-hour run with print album',                TRUE, 6000000,  5 FROM new_pkg
UNION ALL
SELECT package_id, 'transportation_bridal_car','Bridal car — vintage Cadillac, heritage style, 5 hours',          TRUE, 5500000,  6 FROM new_pkg;

COMMIT;
