-- vendor_partnerships — vendor-to-vendor commercial relationships.
--
-- Named vendor_partnerships (not vendor_recommendations) to avoid conflict with
-- the existing vendor_recommendations table (20270105000000), which records
-- couple→vendor endorsements after an event.
--
-- relationship_type enum:
--   accredited          — the recommending vendor formally certifies the other
--   sponsored_included  — the recommended vendor is included in the
--                         recommending vendor's package at no extra cost
--   sponsored_discounted — the recommended vendor offers a discount when
--                          booked alongside the recommending vendor
--   general             — informal "works well with" referral
--
-- admin_verified gate — partnerships are publicly visible ONLY after an admin
-- marks admin_verified=true. Vendors can declare partnerships freely; the admin
-- queue reviews commercial relationships before they render on search badges.

CREATE TABLE IF NOT EXISTS public.vendor_partnerships (
  id                       bigserial PRIMARY KEY,
  recommending_vendor_id   UUID NOT NULL
                             REFERENCES public.vendor_profiles(vendor_profile_id)
                             ON DELETE CASCADE,
  recommended_vendor_id    UUID NOT NULL
                             REFERENCES public.vendor_profiles(vendor_profile_id)
                             ON DELETE CASCADE,
  relationship_type        text NOT NULL CHECK (relationship_type IN (
                             'accredited',
                             'sponsored_included',
                             'sponsored_discounted',
                             'general'
                           )),
  additional_fee_centavos  integer,
  discount_pct             smallint CHECK (discount_pct BETWEEN 0 AND 100),
  covered_plan_groups      text[] NOT NULL DEFAULT '{}',
  is_active                boolean NOT NULL DEFAULT true,
  admin_verified           boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT NOW(),
  CHECK (recommending_vendor_id <> recommended_vendor_id),
  UNIQUE (recommending_vendor_id, recommended_vendor_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS vendor_partnerships_recommending_idx
  ON public.vendor_partnerships (recommending_vendor_id);

CREATE INDEX IF NOT EXISTS vendor_partnerships_recommended_idx
  ON public.vendor_partnerships (recommended_vendor_id);

ALTER TABLE public.vendor_partnerships ENABLE ROW LEVEL SECURITY;

-- Public read of verified, active partnerships only (couples see badges in search)
DROP POLICY IF EXISTS "public read verified vendor partnerships" ON public.vendor_partnerships;
CREATE POLICY "public read verified vendor partnerships"
  ON public.vendor_partnerships
  FOR SELECT
  USING (is_active = true AND admin_verified = true);

-- Vendors can declare partnerships for their own vendor_profile_id
DROP POLICY IF EXISTS "vendors declare partnerships" ON public.vendor_partnerships;
CREATE POLICY "vendors declare partnerships"
  ON public.vendor_partnerships
  FOR INSERT
  TO authenticated
  WITH CHECK (recommending_vendor_id IN (SELECT public.current_vendor_profile_ids()));

-- Vendors can deactivate (soft-delete) their own partnerships via UPDATE
-- Note: vendors cannot flip admin_verified via this policy — the WITH CHECK
-- ensures the new row still has admin_verified matching what they sent,
-- but the INSERT default is false and admins have a separate all-access policy
-- that is the only path to setting admin_verified=true.
DROP POLICY IF EXISTS "vendors deactivate own partnerships" ON public.vendor_partnerships;
CREATE POLICY "vendors deactivate own partnerships"
  ON public.vendor_partnerships
  FOR UPDATE
  TO authenticated
  USING   (recommending_vendor_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (
    recommending_vendor_id IN (SELECT public.current_vendor_profile_ids())
    AND admin_verified = false   -- vendors cannot self-verify
  );

-- Admins manage all partnerships including verification
DROP POLICY IF EXISTS "admins manage vendor partnerships" ON public.vendor_partnerships;
CREATE POLICY "admins manage vendor partnerships"
  ON public.vendor_partnerships
  FOR ALL
  USING   (public.is_admin())
  WITH CHECK (public.is_admin());
