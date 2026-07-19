-- vendor_coverages_addons_base_pax
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)
--
-- Vendor Services rework — coverage becomes a FIRST-CLASS entity, plus priced
-- add-ons and base-pax pricing. Owner-approved 2026-07-02 (grain = canonical
-- leaf ~201; coverage is authoritative and drives Explore).
--
--   1. vendor_coverages      — a taxonomy leaf (canonical_service, the ~201
--                              grain) a vendor serves + the event types they
--                              cater for it. First-class: can exist with zero
--                              service cards.
--   2. vendor_service_addons — priced optional extras on a service card
--                              ("+ Drone coverage · from ₱5,000").
--   3. vendor_services.base_pax   — guests the starting price covers (pairs
--                              with the existing added_pax_price_php surcharge).
--   4. vendor_services.coverage_id — links a card to its coverage.
--
-- Additive + non-destructive. No backfill: existing (coarse-category) listings
-- keep coverage_id NULL and still resolve via the category column; the reworked
-- flow populates coverage_id and the few founder-only rows are re-declared. The
-- Explore sync (vendor_profiles.services + event_types union) and the
-- save_vendor_service RPC wiring land in the following code PRs.
--
-- Patterns copied verbatim (do-not-invent):
--   • id block + generate_public_id + vendor/admin RLS  ← vendor_locked_qr_tokens (20270414692373)
--   • public-read gating (active anchor + published)    ← vendor_service_links   (20261014000000)
--   • event_types nonempty CHECK + GIN + validate trigger ← vendor_profiles (20260521090000 / 20261205000000)
-- Type letters 'V' (coVerage) / 'O' (add-On) are content-free labels reused
-- across tables (only 'Z' is unshipped); flagged for owner sign-off in the PR.

-- ============================================================================
-- 1 · vendor_coverages
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vendor_coverages (
  id                 BIGSERIAL PRIMARY KEY,
  public_id          TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('V'),
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- A canonical_service key (getTaxonomy().map, the ~201 leaf grain). Stored as
  -- TEXT + app-validated against the live taxonomy (mirrors vendor_services.category);
  -- no FK because the canonical layer's source of truth is getTaxonomy() (DB +
  -- lib/taxonomy.ts fallback), not one table.
  canonical_service  TEXT NOT NULL,
  -- Event types the vendor caters for THIS coverage. Never empty; each member
  -- is validated against event_type_vocab(status='active') by the trigger below.
  event_types        TEXT[] NOT NULL DEFAULT ARRAY['wedding']::TEXT[],
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vendor_coverages_event_types_nonempty CHECK (cardinality(event_types) > 0),
  CONSTRAINT vendor_coverages_unique_leaf UNIQUE (vendor_profile_id, canonical_service)
);

CREATE INDEX IF NOT EXISTS vendor_coverages_vendor_idx
  ON public.vendor_coverages (vendor_profile_id);
CREATE INDEX IF NOT EXISTS vendor_coverages_canonical_idx
  ON public.vendor_coverages (canonical_service);
CREATE INDEX IF NOT EXISTS vendor_coverages_event_types_gin
  ON public.vendor_coverages USING GIN (event_types);

-- Active-vocab validation for event_types: reuse the table-agnostic fn that
-- already guards vendor_profiles.event_types (it only reads NEW.event_types).
DROP TRIGGER IF EXISTS validate_event_types_vendor_coverages ON public.vendor_coverages;
CREATE TRIGGER validate_event_types_vendor_coverages
  BEFORE INSERT OR UPDATE OF event_types ON public.vendor_coverages
  FOR EACH ROW EXECUTE FUNCTION public.validate_vendor_event_types();

ALTER TABLE public.vendor_coverages ENABLE ROW LEVEL SECURITY;

-- The vendor org manages its own coverages; console admins read all. NOT
-- couple-readable directly — Explore reads the synced vendor_profiles.services
-- + event_types union, so there is no public-read policy here.
DROP POLICY IF EXISTS vendor_coverages_vendor_all ON public.vendor_coverages;
CREATE POLICY vendor_coverages_vendor_all ON public.vendor_coverages
  FOR ALL
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_coverages_admin_read ON public.vendor_coverages;
CREATE POLICY vendor_coverages_admin_read ON public.vendor_coverages
  FOR SELECT
  USING (public.is_console_admin());

COMMENT ON TABLE public.vendor_coverages IS
  'First-class vendor coverage: a taxonomy leaf (canonical_service, the ~201 grain from getTaxonomy().map) a vendor serves plus the event_types they cater for it. May exist with zero service cards. Source of truth that drives the vendor''s Explore discoverability (vendor_profiles.services + event_types union are kept in sync from here in the follow-up code PR). Vendor-org RLS + console-admin read. Vendor Services rework 2026-07-02.';

-- ============================================================================
-- 2 · vendor_service_addons
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vendor_service_addons (
  id                 BIGSERIAL PRIMARY KEY,
  public_id          TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('O'),
  vendor_service_id  UUID NOT NULL
                     REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE,
  -- Denormalized owner (mirrors vendor_service_links) so RLS + the public-read
  -- gate can scope without a join through vendor_services.
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  label              TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  -- "from ₱X" — whole pesos; NULL = inquire.
  from_price_php     INTEGER CHECK (from_price_php IS NULL OR from_price_php >= 0),
  sort_order         INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_service_addons_service_idx
  ON public.vendor_service_addons (vendor_service_id, sort_order);
CREATE INDEX IF NOT EXISTS vendor_service_addons_vendor_idx
  ON public.vendor_service_addons (vendor_profile_id);

ALTER TABLE public.vendor_service_addons ENABLE ROW LEVEL SECURITY;

-- Public read — couples browsing a vendor's card see its add-ons. Gated exactly
-- like vendor_service_links_public_read: the anchor service active AND its
-- vendor published.
DROP POLICY IF EXISTS vendor_service_addons_public_read ON public.vendor_service_addons;
CREATE POLICY vendor_service_addons_public_read
  ON public.vendor_service_addons FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles WHERE is_published = TRUE
    )
    AND vendor_service_id IN (
      SELECT vendor_service_id FROM public.vendor_services WHERE is_active = TRUE
    )
  );

DROP POLICY IF EXISTS vendor_service_addons_vendor_all ON public.vendor_service_addons;
CREATE POLICY vendor_service_addons_vendor_all ON public.vendor_service_addons
  FOR ALL
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_service_addons_admin_all ON public.vendor_service_addons;
CREATE POLICY vendor_service_addons_admin_all ON public.vendor_service_addons
  FOR ALL
  USING (public.is_console_admin())
  WITH CHECK (public.is_console_admin());

COMMENT ON TABLE public.vendor_service_addons IS
  'Priced optional extras on a vendor service card ("+ Drone coverage · from ₱5,000"). from_price_php is a "from" price (NULL = inquire). Public-read gated like vendor_service_links (anchor active + vendor published); vendor-org + console-admin write. Vendor Services rework 2026-07-02.';

-- ============================================================================
-- 3 · vendor_services.base_pax   +   4 · vendor_services.coverage_id
-- ============================================================================
ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS base_pax INTEGER CHECK (base_pax IS NULL OR base_pax > 0);
COMMENT ON COLUMN public.vendor_services.base_pax IS
  'Guests the starting_price_php covers. Pairs with added_pax_price_php (per-guest surcharge above this count). NULL = flat / not pax-priced. Vendor Services rework 2026-07-02.';

ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS coverage_id BIGINT
  REFERENCES public.vendor_coverages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS vendor_services_coverage_idx
  ON public.vendor_services (coverage_id);
COMMENT ON COLUMN public.vendor_services.coverage_id IS
  'The vendor_coverages row this card belongs to. NULL on legacy (pre-rework) rows, which still resolve via the coarse category column. ON DELETE SET NULL so removing a coverage never silently destroys a card (the app-layer delete action owns the cascade decision). Vendor Services rework 2026-07-02.';
