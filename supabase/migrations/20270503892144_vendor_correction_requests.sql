-- vendor_correction_requests
-- Verified-lock enforcement + request-a-correction (Lane B, PR B2 of the
-- redesigned My Shop verification, owner-approved 2026-07-02).
--
-- Once a vendor is VERIFIED (vendor_profiles.public_visibility = 'verified'),
-- their 8 identity fields lock server-side (business_name, business_owner_name,
-- hq_address, contact_phone, contact_email, services, in_business_since_year,
-- logo_url — enforced in app/vendor-dashboard/actions.ts). Instead of editing,
-- the vendor files a CORRECTION REQUEST here; an admin applies or declines it
-- on /admin/corrections. Non-identity writes (is_published, tagline,
-- portfolio, opt-outs, compatibility arrays) stay vendor-editable.
--
-- public_id type letter: 'Z' — the ONLY free letter. A–Y are all taken by
-- existing tables (verified by grepping generate_public_id('<letter>') across
-- supabase/migrations; 'N' went to vendor_image_flags, 'W' to ugc_moderation +
-- vendor_spotlight_awards). Documented here per the house public_id pattern.
--
-- KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_correction_requests (
  id                 BIGSERIAL PRIMARY KEY,
  public_id          TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('Z'),
  vendor_profile_id  UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- One of the 8 locked identity field keys (validated app-side against
  -- LOCKED_IDENTITY_FIELD_KEYS in lib/vendor-corrections.ts; CHECK kept in
  -- sync so a raw insert can't invent a field).
  field_key          TEXT NOT NULL CHECK (field_key IN (
                       'business_name',
                       'business_owner_name',
                       'hq_address',
                       'contact_phone',
                       'contact_email',
                       'services',
                       'in_business_since_year',
                       'logo_url'
                     )),
  -- Snapshot of the profile value at request time (display-oriented text;
  -- services is serialized as a comma-joined list).
  current_value      TEXT,
  requested_value    TEXT,
  note               TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  status             TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'applied', 'declined')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at        TIMESTAMPTZ,
  resolved_by        UUID REFERENCES public.users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS vendor_correction_requests_vendor_idx
  ON public.vendor_correction_requests(vendor_profile_id);
CREATE INDEX IF NOT EXISTS vendor_correction_requests_status_idx
  ON public.vendor_correction_requests(status);

ALTER TABLE public.vendor_correction_requests ENABLE ROW LEVEL SECURITY;

-- Vendor reads their own requests; admins read everything. Same owning-vendor
-- scope as vendor_verification_applications RLS (vp.user_id = auth.uid()).
DROP POLICY IF EXISTS vendor_correction_requests_owner_read
  ON public.vendor_correction_requests;
CREATE POLICY vendor_correction_requests_owner_read
  ON public.vendor_correction_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_correction_requests.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
    OR public.is_admin()
  );

-- Vendor files a request against their OWN profile only, always status 'open'
-- and unresolved (resolution columns are admin-only).
DROP POLICY IF EXISTS vendor_correction_requests_owner_insert
  ON public.vendor_correction_requests;
CREATE POLICY vendor_correction_requests_owner_insert
  ON public.vendor_correction_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_correction_requests.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
    AND status = 'open'
    AND resolved_at IS NULL
    AND resolved_by IS NULL
  );

-- Resolution (apply / decline) is admin-only.
DROP POLICY IF EXISTS vendor_correction_requests_admin_update
  ON public.vendor_correction_requests;
CREATE POLICY vendor_correction_requests_admin_update
  ON public.vendor_correction_requests FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS vendor_correction_requests_admin_delete
  ON public.vendor_correction_requests;
CREATE POLICY vendor_correction_requests_admin_delete
  ON public.vendor_correction_requests FOR DELETE
  TO authenticated
  USING (public.is_admin());

COMMENT ON TABLE public.vendor_correction_requests IS
  'Request-a-correction queue for VERIFIED vendors whose 8 identity fields are '
  'locked server-side (redesigned My Shop verification, owner 2026-07-02). A '
  'row = "please change <field_key> from <current_value> to <requested_value>". '
  'Admin applies (writes vendor_profiles + status=applied) or declines on '
  '/admin/corrections. public_id type letter Z (only free letter; A-Y taken).';

COMMIT;
