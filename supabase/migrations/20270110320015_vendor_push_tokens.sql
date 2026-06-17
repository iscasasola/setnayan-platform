-- vendor_push_tokens — FCM (Android), APNs (iOS) and Web Push tokens per device.
--
-- A vendor may have multiple active devices. Tokens are deduped by
-- (vendor_profile_id, token) so re-registering the same device is idempotent.
-- is_active=false is set when a delivery permanently fails (invalid-token error)
-- rather than hard-deleting so we retain delivery history for debugging.

CREATE TABLE IF NOT EXISTS public.vendor_push_tokens (
  id                   bigserial PRIMARY KEY,
  vendor_profile_id    UUID NOT NULL
                         REFERENCES public.vendor_profiles(vendor_profile_id)
                         ON DELETE CASCADE,
  token                text NOT NULL,
  platform             text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  last_registered_at   timestamptz NOT NULL DEFAULT NOW(),
  is_active            boolean NOT NULL DEFAULT true,
  UNIQUE (vendor_profile_id, token)
);

CREATE INDEX IF NOT EXISTS vendor_push_tokens_vendor_profile_id_idx
  ON public.vendor_push_tokens (vendor_profile_id);

CREATE INDEX IF NOT EXISTS vendor_push_tokens_active_idx
  ON public.vendor_push_tokens (vendor_profile_id, is_active)
  WHERE is_active = true;

ALTER TABLE public.vendor_push_tokens ENABLE ROW LEVEL SECURITY;

-- Vendors read and manage their own push tokens (all operations)
DROP POLICY IF EXISTS "vendors manage own push tokens" ON public.vendor_push_tokens;
CREATE POLICY "vendors manage own push tokens"
  ON public.vendor_push_tokens
  FOR ALL
  TO authenticated
  USING   (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- Admins can read all tokens for debugging push delivery issues
DROP POLICY IF EXISTS "admins read push tokens" ON public.vendor_push_tokens;
CREATE POLICY "admins read push tokens"
  ON public.vendor_push_tokens
  FOR SELECT
  USING (public.is_admin());
