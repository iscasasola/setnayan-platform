-- Vendor "recommend to your couples" engine — Phase 2 data layer (two-way curation).
--
-- Builds on Phase 1 (vendor_service_recommendations). Adds the two tables the
-- TWO-WAY curation model needs (owner-decided 2026-06-30):
--   1. vendor_recommendation_feedback — vendors flag "this doesn't fit me" or
--      "I'd also recommend X" -> an admin review queue (mirrors the
--      taxonomy_category_requests governance pattern).
--   2. vendor_recommendation_optins — per-vendor enabled state for is_opt_in
--      (cannibalization-risk) SKUs. Such a SKU is hidden for a vendor until they
--      explicitly turn it on; this records that choice.
--
-- Both are vendor-owned (RLS: a vendor sees/writes only their own rows; admin
-- sees all). Lands INERT — the admin queue (Phase 2 UI) and the vendor panel
-- (Phase 3) read these later.

-- ---------------------------------------------------------------------------
-- 1. Vendor feedback on the map -> admin review queue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_recommendation_feedback (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_profile_id   uuid NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  tile_id             text NOT NULL REFERENCES public.service_categories(id) ON UPDATE CASCADE ON DELETE CASCADE,
  feedback_type       text NOT NULL CHECK (feedback_type IN ('not_a_fit','suggest_add')),
  -- For 'not_a_fit': the existing recommended SKU the vendor is rejecting.
  -- For 'suggest_add': the SKU the vendor proposes adding to their leaf.
  service_code        text REFERENCES public.platform_retail_catalog_v2(service_code) ON UPDATE CASCADE ON DELETE CASCADE,
  note                text,
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  resolved_by_admin_id uuid,
  resolved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  -- One open flag per (vendor, leaf, type, sku); resolving clears the way for a new one.
  UNIQUE (vendor_profile_id, tile_id, feedback_type, service_code)
);

COMMENT ON TABLE public.vendor_recommendation_feedback IS
  'Vendor flags on the recommendation map (not_a_fit / suggest_add) -> admin review queue. Two-way curation (owner 2026-06-30).';

CREATE INDEX IF NOT EXISTS vendor_recommendation_feedback_pending_idx
  ON public.vendor_recommendation_feedback (status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS vendor_recommendation_feedback_vendor_idx
  ON public.vendor_recommendation_feedback (vendor_profile_id);

ALTER TABLE public.vendor_recommendation_feedback ENABLE ROW LEVEL SECURITY;

-- Vendor sees + raises their own feedback; admin sees all (admin writes via service-role client too).
DROP POLICY IF EXISTS vendor_recommendation_feedback_owner_select ON public.vendor_recommendation_feedback;
CREATE POLICY vendor_recommendation_feedback_owner_select ON public.vendor_recommendation_feedback
  FOR SELECT TO authenticated USING (
    public.is_admin()
    OR vendor_profile_id IN (SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid())
  );

DROP POLICY IF EXISTS vendor_recommendation_feedback_owner_insert ON public.vendor_recommendation_feedback;
CREATE POLICY vendor_recommendation_feedback_owner_insert ON public.vendor_recommendation_feedback
  FOR INSERT TO authenticated WITH CHECK (
    vendor_profile_id IN (SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2. Per-vendor opt-in state for cannibalization-risk SKUs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_recommendation_optins (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_profile_id   uuid NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  tile_id             text NOT NULL REFERENCES public.service_categories(id) ON UPDATE CASCADE ON DELETE CASCADE,
  service_code        text NOT NULL REFERENCES public.platform_retail_catalog_v2(service_code) ON UPDATE CASCADE ON DELETE CASCADE,
  enabled             boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_profile_id, tile_id, service_code)
);

COMMENT ON TABLE public.vendor_recommendation_optins IS
  'Per-vendor enabled state for is_opt_in (cannibalization-risk) recommendations. Absent row = not opted in = hidden.';

CREATE INDEX IF NOT EXISTS vendor_recommendation_optins_vendor_idx
  ON public.vendor_recommendation_optins (vendor_profile_id);

ALTER TABLE public.vendor_recommendation_optins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_recommendation_optins_owner_all ON public.vendor_recommendation_optins;
CREATE POLICY vendor_recommendation_optins_owner_all ON public.vendor_recommendation_optins
  TO authenticated
  USING (
    public.is_admin()
    OR vendor_profile_id IN (SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid())
  )
  WITH CHECK (
    vendor_profile_id IN (SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid())
  );
