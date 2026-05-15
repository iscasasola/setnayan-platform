-- ============================================================================
-- 20260516010000_v1_sku_lock_vendor_verifications.sql
-- V1 SKU framework lock (2026-05-16). Adds the vendor_verifications table.
--
-- Tracks each vendor's verification workflow (Persona ID + Google Meet +
-- reference calls + AMLC sanctions screen). Anchored to vendor_profiles
-- and pays the corresponding SKU from service_catalog:
--   • vendor_verification_initial          (FREE)
--   • vendor_verification_annual_renewal   (₱1,500/year)
--   • vendor_verification_redemption       (₱2,500 after demotion)
--
-- Documents are referenced by R2 object keys (we never inline blobs in DB).
--
-- Source of truth: spec corpus commit a0fa3c7 (2026-05-16).
-- Idempotent. No drops.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_verifications (
  verification_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id                    TEXT UNIQUE NOT NULL
                               DEFAULT public.generate_public_id('Q'),
    -- 'Q' prefix = qualification/verification. Distinct from V (event_vendors)
    -- so admins can tell at a glance whether they're looking at a vendor or
    -- a verification record.
  vendor_profile_id            UUID NOT NULL
                               REFERENCES public.vendor_profiles(vendor_profile_id)
                               ON DELETE CASCADE,
  status                       TEXT NOT NULL DEFAULT 'pending'
                               CHECK (status IN
                                 ('pending', 'submitted', 'approved',
                                  'rejected', 'expired', 'demoted')),

  -- ---- Document submissions (R2 object keys; nothing inlined) ----
  dti_certificate_r2_key       TEXT,
  bir_2303_r2_key              TEXT,
  mayors_permit_r2_key         TEXT,
  government_id_r2_key         TEXT,
  bank_account_proof_r2_key    TEXT,
  portfolio_sample_ids         TEXT[],
  references_json              JSONB,
    -- Array of {name, phone, relationship} objects (1-3 entries).
  social_media_url             TEXT,

  -- ---- Verification stages ----
  persona_inquiry_id           TEXT,
  persona_status               TEXT,
    -- Persona-returned status: 'created'|'approved'|'declined'|'expired'...
  google_meet_at               TIMESTAMPTZ,
  google_meet_passed           BOOLEAN,
  reference_calls_made         INTEGER NOT NULL DEFAULT 0,
  reference_calls_passed       INTEGER NOT NULL DEFAULT 0,
  sanctions_screened_at        TIMESTAMPTZ,
  sanctions_clear              BOOLEAN,
    -- AMLC sanctions screening outcome.

  -- ---- Outcome ----
  approved_at                  TIMESTAMPTZ,
  rejected_at                  TIMESTAMPTZ,
  rejection_reason             TEXT,
  expires_at                   TIMESTAMPTZ,
    -- 1 year from approved_at — vendor must re-verify before this.
  approved_by_admin_user_id    UUID REFERENCES public.users(user_id)
                               ON DELETE SET NULL,

  -- ---- SKU linkage ----
  sku_code                     TEXT,
    -- One of service_catalog.sku_code (vendor_verification_initial /
    -- _annual_renewal / _redemption). Soft reference; we don't FK here
    -- so the catalog can be edited without cascading admin reviews.

  -- ---- Timestamps ----
  submitted_at                 TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_verifications_vendor_idx
  ON public.vendor_verifications(vendor_profile_id);
CREATE INDEX IF NOT EXISTS vendor_verifications_status_idx
  ON public.vendor_verifications(status);
CREATE INDEX IF NOT EXISTS vendor_verifications_expires_idx
  ON public.vendor_verifications(expires_at);

-- ----------------------------------------------------------------------------
-- RLS — vendors see only their own verification rows; admin (service-role)
-- has full access.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_verifications_self_read
  ON public.vendor_verifications;
CREATE POLICY vendor_verifications_self_read
  ON public.vendor_verifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_verifications.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS vendor_verifications_self_insert
  ON public.vendor_verifications;
CREATE POLICY vendor_verifications_self_insert
  ON public.vendor_verifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_verifications.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
  );

-- UPDATE/DELETE intentionally not policied for users — admins flip
-- status via service-role only. Prevents a vendor self-approving.

COMMIT;
