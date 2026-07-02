-- vendor_contact_confirmation_validate
-- Backend substrate for the redesigned My Shop verification flow (owner-approved
-- 2026-07-02): alongside the required docs, the vendor sends a literal
-- "VALIDATE <shop name>" EMAIL and TEXT to Setnayan-owned inboxes. An admin
-- marks each one as received on /admin/verify; the stamps live on the
-- vendor_verification_applications row so the 15-min Google Meet + approval can
-- gate on them later.
--
-- Three pieces:
--   1. Four nullable stamp columns on vendor_verification_applications
--      (confirmed_at + confirmed_by per channel).
--   2. Two admin-managed platform_settings fields for WHERE vendors send the
--      VALIDATE messages (email default verify@setnayan.com; phone NULL =
--      "number coming soon" in the UI). Admin-managed, never hardcoded — same
--      pattern as repost_watch_hamming_threshold (20270330665855).
--   3. SECURITY DEFINER RPC mark_vendor_contact_confirmed(application, channel)
--      — admin-only (public.is_admin() guard, modeled on the songs_nonadmin_guard
--      / accept_change_order house pattern), idempotent (re-marking a confirmed
--      channel keeps the FIRST stamp), rejects unknown channels.
--
-- KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Contact-confirmation stamps on the application row.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_verification_applications
  ADD COLUMN IF NOT EXISTS contact_email_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contact_email_confirmed_by UUID,
  ADD COLUMN IF NOT EXISTS contact_phone_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contact_phone_confirmed_by UUID;

COMMENT ON COLUMN public.vendor_verification_applications.contact_email_confirmed_at IS
  'Stamped by an admin (mark_vendor_contact_confirmed RPC) when the vendor''s '
  '"VALIDATE <shop name>" EMAIL lands in the Setnayan validate inbox '
  '(platform_settings.vendor_validate_email).';
COMMENT ON COLUMN public.vendor_verification_applications.contact_email_confirmed_by IS
  'The admin user_id who marked the VALIDATE email as received.';
COMMENT ON COLUMN public.vendor_verification_applications.contact_phone_confirmed_at IS
  'Stamped by an admin (mark_vendor_contact_confirmed RPC) when the vendor''s '
  '"VALIDATE <shop name>" TEXT message lands on the Setnayan validate number '
  '(platform_settings.vendor_validate_phone).';
COMMENT ON COLUMN public.vendor_verification_applications.contact_phone_confirmed_by IS
  'The admin user_id who marked the VALIDATE text as received.';

-- ----------------------------------------------------------------------------
-- 2. Admin-managed VALIDATE destinations on the platform_settings singleton
--    (id = 1), edited via /admin/settings — never hardcoded in app code.
-- ----------------------------------------------------------------------------

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS vendor_validate_email TEXT NOT NULL DEFAULT 'verify@setnayan.com',
  ADD COLUMN IF NOT EXISTS vendor_validate_phone TEXT DEFAULT NULL;

COMMENT ON COLUMN public.platform_settings.vendor_validate_email IS
  'Setnayan-owned inbox vendors EMAIL their "VALIDATE <shop name>" message to '
  'during verification. Admin-managed on /admin/settings; default '
  'verify@setnayan.com.';
COMMENT ON COLUMN public.platform_settings.vendor_validate_phone IS
  'Setnayan-owned mobile number vendors TEXT their "VALIDATE <shop name>" '
  'message to during verification. NULL = no number yet ("number coming soon" '
  'in the vendor UI). Admin-managed on /admin/settings.';

-- ----------------------------------------------------------------------------
-- 3. mark_vendor_contact_confirmed — admin-only, idempotent channel stamp.
--
--    Called with the ADMIN''S OWN session (supabase.rpc from the user client),
--    never the service-role client: auth.uid() must resolve to the acting
--    admin for both the is_admin() guard and the _confirmed_by attribution.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_vendor_contact_confirmed(
  p_application_id UUID,
  p_channel TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_at TIMESTAMPTZ;
  v_phone_at TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only Setnayan admins can mark a VALIDATE contact as received';
  END IF;

  IF p_channel NOT IN ('email', 'phone') THEN
    RAISE EXCEPTION 'Unknown contact channel: % (expected email or phone)', p_channel;
  END IF;

  -- Idempotent: COALESCE keeps the FIRST admin''s stamp on a re-mark.
  IF p_channel = 'email' THEN
    UPDATE public.vendor_verification_applications
    SET contact_email_confirmed_at = COALESCE(contact_email_confirmed_at, NOW()),
        contact_email_confirmed_by = COALESCE(contact_email_confirmed_by, auth.uid()),
        updated_at = NOW()
    WHERE application_id = p_application_id
    RETURNING contact_email_confirmed_at, contact_phone_confirmed_at
      INTO v_email_at, v_phone_at;
  ELSE
    UPDATE public.vendor_verification_applications
    SET contact_phone_confirmed_at = COALESCE(contact_phone_confirmed_at, NOW()),
        contact_phone_confirmed_by = COALESCE(contact_phone_confirmed_by, auth.uid()),
        updated_at = NOW()
    WHERE application_id = p_application_id
    RETURNING contact_email_confirmed_at, contact_phone_confirmed_at
      INTO v_email_at, v_phone_at;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verification application % not found', p_application_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'channel', p_channel,
    'contact_email_confirmed_at', v_email_at,
    'contact_phone_confirmed_at', v_phone_at
  );
END;
$$;

COMMENT ON FUNCTION public.mark_vendor_contact_confirmed(UUID, TEXT) IS
  'Admin-only (is_admin() guard): stamps contact_{email|phone}_confirmed_at/_by '
  'on a vendor verification application when the vendor''s "VALIDATE <shop name>" '
  'email/text lands. Idempotent — the first stamp wins. Rejects unknown channels.';

REVOKE ALL ON FUNCTION public.mark_vendor_contact_confirmed(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_vendor_contact_confirmed(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_vendor_contact_confirmed(UUID, TEXT) TO authenticated;

COMMIT;
