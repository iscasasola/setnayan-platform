-- vendor_web_dossiers
-- Deep-search analytics for vendor verification (owner 2026-07-03: "Once they
-- give us their soc med and website, can we have the deep search analytics
-- that would show us what their business is, what they serve, the prices they
-- have on the web … search their ads and posts across the internet?").
--
-- An admin on /admin/verify triggers "Run deep search" on an application; a
-- server action calls Claude with the web_search server tool over the vendor's
-- website + social link + shop name + location and stores the structured
-- result here (business summary · detected services · price signals with
-- source URLs · web presence · consistency flags vs the claimed category).
-- Admin-only due-diligence data — vendors never see it.
--
-- NO public_id: every generate_public_id() type letter A–Z is taken (Z went to
-- vendor_correction_requests, 2026-07-02). This is an internal admin table
-- keyed by bigserial; rows are addressed by (vendor_profile_id, created_at).
--
-- KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_web_dossiers (
  id                 BIGSERIAL PRIMARY KEY,
  vendor_profile_id  UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- The application the admin was reviewing when they ran the search (kept on
  -- SET NULL so dossiers survive application cleanup).
  application_id     UUID
                       REFERENCES public.vendor_verification_applications(application_id) ON DELETE SET NULL,
  status             TEXT NOT NULL DEFAULT 'running'
                       CHECK (status IN ('running', 'complete', 'failed')),
  requested_by       UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  -- Snapshot of what was searched (business_name, website, social_url,
  -- location_city, claimed services) — so a dossier stays interpretable after
  -- the profile changes.
  inputs             JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Structured result (business_summary, detected_services, price_signals,
  -- web_presence, ads_findings, consistency_flags, category_match,
  -- confidence). Shape owned by apps/web/lib/vendor-deep-search.ts.
  dossier            JSONB,
  error              TEXT,
  model              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS vendor_web_dossiers_vendor_idx
  ON public.vendor_web_dossiers(vendor_profile_id, created_at DESC);

ALTER TABLE public.vendor_web_dossiers ENABLE ROW LEVEL SECURITY;

-- Admin-only in every direction — this is internal due-diligence material.
DROP POLICY IF EXISTS vendor_web_dossiers_admin_select ON public.vendor_web_dossiers;
CREATE POLICY vendor_web_dossiers_admin_select
  ON public.vendor_web_dossiers FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS vendor_web_dossiers_admin_insert ON public.vendor_web_dossiers;
CREATE POLICY vendor_web_dossiers_admin_insert
  ON public.vendor_web_dossiers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS vendor_web_dossiers_admin_update ON public.vendor_web_dossiers;
CREATE POLICY vendor_web_dossiers_admin_update
  ON public.vendor_web_dossiers FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS vendor_web_dossiers_admin_delete ON public.vendor_web_dossiers;
CREATE POLICY vendor_web_dossiers_admin_delete
  ON public.vendor_web_dossiers FOR DELETE
  TO authenticated
  USING (public.is_admin());

COMMIT;
