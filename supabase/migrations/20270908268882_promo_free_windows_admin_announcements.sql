-- Promo Free Windows — admin-scheduled "these services are free this weekend"
-- announcements. Owner ask 2026-07-22: "on admin on the pricing … create
-- announcements when we want to provide free paid services at a certain date for
-- vendors and users for their events."
--
-- MODEL (entitlement-OR, NOT a ₱0 order): a live window makes its covered SKUs
-- resolve as OWNED for the whole audience during [starts_at, ends_at) — exactly
-- like comp_grants / founder_seats already do via lib/entitlements.ts. No order
-- row, no checkout, no BIR receipt (a free promo has no receipt). Ephemeral: the
-- unlock reverts when the window closes unless the couple separately purchased it.
--
-- Gated by env PROMO_FREE_WINDOWS_ENABLED (default OFF) so the whole feature is
-- inert until the owner flips it — belt-and-suspenders on top of is_active +
-- the date window (see the migrations-auto-apply rule: a go-live hold is a flag
-- shipped OFF, never "hold the push").
--
-- Two audiences ship:
--   'all_couples' → covered_service_keys resolve as owned via lib/entitlements.ts.
--   'all_vendors' → every vendor is promoted to promoted_vendor_tier for free,
--                   ORed into resolveVendorTier() (the vendor feature-tier choke
--                   point). Vendor billing can't be zeroed in-catalog (DB CHECK
--                   price_php > 0), so the free vendor path is a tier PROMOTION,
--                   never a ₱0 subscription row. Inert until paid vendor billing
--                   is on (VENDOR_TIER_FEATURE_GATE) — everyone's free before that.
-- 'segment' is schema-forward (targeted filters) and unused in V1.
--
-- IDs: UUID PK (matches orders / discount_codes; no generate_public_id letter
-- needed for an admin-only object).

BEGIN;

CREATE TABLE IF NOT EXISTS public.promo_free_windows (
  promo_window_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Admin label + couple-facing banner headline (e.g. "Free Papic weekend").
  title                 TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  -- Optional banner body copy shown under the headline.
  blurb                 TEXT,
  -- The couple SKUs (platform_retail_catalog_v2.service_code) this window frees.
  -- App-validated against the live catalog on write; stored as codes so a later
  -- catalog rename is a data edit, not a schema change.
  covered_service_keys  TEXT[] NOT NULL DEFAULT '{}',
  -- Who the free window reaches. V1 enforces 'all_couples' in code; the other
  -- values are schema-forward (vendor path + segment filters land later).
  audience_type         TEXT NOT NULL DEFAULT 'all_couples'
                          CHECK (audience_type IN ('all_couples','all_vendors','segment')),
  -- Future segment filters (event_type, region, planning stage). Unused in V1.
  audience_params       JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 'all_vendors' windows promote every vendor to this paid tier for free during
  -- the window (resolveVendorTier ORs it in, never a downgrade). NULL for couple
  -- windows (they use covered_service_keys instead).
  promoted_vendor_tier  TEXT CHECK (promoted_vendor_tier IN ('solo','pro','enterprise')),
  starts_at             TIMESTAMPTZ NOT NULL,
  ends_at               TIMESTAMPTZ NOT NULL,
  -- Master per-row switch (a deactivated window never frees anything, even
  -- inside its date range) + whether to surface the announcement banner.
  is_active             BOOLEAN NOT NULL DEFAULT true,
  show_banner           BOOLEAN NOT NULL DEFAULT true,
  created_by            UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT promo_free_windows_window_order CHECK (ends_at > starts_at),
  -- A vendor window MUST name a promoted tier; a non-vendor window MUST NOT.
  CONSTRAINT promo_free_windows_vendor_tier CHECK (
    (audience_type = 'all_vendors') = (promoted_vendor_tier IS NOT NULL)
  )
);

COMMENT ON TABLE public.promo_free_windows IS
  'Admin-scheduled free-service announcements. A live row (is_active AND now within [starts_at,ends_at)) makes covered_service_keys resolve as owned for the audience via lib/entitlements.ts. Gated by env PROMO_FREE_WINDOWS_ENABLED. Owner ask 2026-07-22.';

-- Live-window lookup (the hot read: "is any window live right now?"). Tiny table,
-- but the partial index keeps the entitlement/banner probe index-only.
CREATE INDEX IF NOT EXISTS idx_promo_free_windows_live
  ON public.promo_free_windows (starts_at, ends_at)
  WHERE is_active;

ALTER TABLE public.promo_free_windows ENABLE ROW LEVEL SECURITY;

-- Admin-only, both directions. The entitlement resolver + the couple banner read
-- this server-side through the service-role admin client (which bypasses RLS), so
-- couples/vendors never need a direct SELECT policy — least privilege.
DROP POLICY IF EXISTS promo_free_windows_admin_read ON public.promo_free_windows;
CREATE POLICY promo_free_windows_admin_read ON public.promo_free_windows
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS promo_free_windows_admin_write ON public.promo_free_windows;
CREATE POLICY promo_free_windows_admin_write ON public.promo_free_windows
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;
