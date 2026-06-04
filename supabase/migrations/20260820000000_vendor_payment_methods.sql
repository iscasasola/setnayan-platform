-- ============================================================================
-- 20260816000000_vendor_payment_methods.sql
-- Vendor off-platform payment options — "How clients pay you".
--
-- Lets a vendor publish their OWN payment destinations so couples pay them
-- DIRECTLY, off-platform (0% fee; Setnayan never holds the money — the
-- RA 11967 non-party-publisher posture). Three method types:
--   • bank / e-wallet account details
--   • an uploaded QR image (decoded server-side so the destination is visible
--     — anti-swap)
--   • a payment link (the vendor's own Maya/PayPal/Stripe/GCash/bank checkout)
--
-- Adds:
--   1. vendor_payment_methods — one row per published destination, owned via
--      the vendor's vendor_profiles row (Pattern A owner RLS — mirrors
--      vendor_profiles_owner but joins through vendor_profiles since this
--      child table has no user_id). Couples read published + allowed rows
--      through a server action (service-role client, server-filtered to
--      vendors they have booked); admin moderates through the service role.
--      Payment LINKS are gated to Pro/Enterprise vendors at the app layer
--      (active vendor subscription order — there is no DB tier column).
--   2. event_vendor_payments.proof_r2_key — optional receipt screenshot the
--      couple attaches when recording a direct payment (0007 budget log).
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_payment_methods
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_payment_methods (
  payment_method_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id    UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  method_type          TEXT NOT NULL CHECK (method_type IN ('bank','qr','link')),

  label                TEXT NOT NULL DEFAULT '' CHECK (length(label) <= 80),

  -- bank / e-wallet
  provider             TEXT CHECK (provider IS NULL OR length(provider) <= 48),
  account_name         TEXT CHECK (account_name IS NULL OR length(account_name) <= 96),
  account_number       TEXT CHECK (account_number IS NULL OR length(account_number) <= 64),

  -- qr (image stored in R2; decoded payload shown to couples + admin)
  qr_r2_key            TEXT,
  decoded_destination  TEXT CHECK (decoded_destination IS NULL OR length(decoded_destination) <= 256),

  -- link (vendor's own checkout)
  link_url             TEXT CHECK (link_url IS NULL OR length(link_url) <= 512),
  link_domain          TEXT CHECK (link_domain IS NULL OR length(link_domain) <= 128),

  note                 TEXT CHECK (note IS NULL OR length(note) <= 200),
  is_primary           BOOLEAN NOT NULL DEFAULT FALSE,
  is_shown             BOOLEAN NOT NULL DEFAULT TRUE,

  -- 'approved' (bank/qr, allowlisted links) · 'pending_review' (off-allowlist
  -- link awaiting admin) · 'held' / 'removed' (admin moderation outcomes)
  moderation_status    TEXT NOT NULL DEFAULT 'approved'
                       CHECK (moderation_status IN ('approved','pending_review','held','removed')),
  moderation_note      TEXT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- each type must carry its own payload
  CONSTRAINT vendor_payment_methods_payload_chk CHECK (
    (method_type = 'bank' AND account_number IS NOT NULL)
    OR (method_type = 'qr'   AND qr_r2_key IS NOT NULL)
    OR (method_type = 'link' AND link_url IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS vendor_payment_methods_vendor_idx
  ON public.vendor_payment_methods(vendor_profile_id);

-- moderation-queue lookup (off-allowlist links / held items)
CREATE INDEX IF NOT EXISTS vendor_payment_methods_moderation_idx
  ON public.vendor_payment_methods(moderation_status)
  WHERE moderation_status IN ('pending_review','held');

-- at most one primary destination per vendor (race-safe, not just app-enforced)
CREATE UNIQUE INDEX IF NOT EXISTS vendor_payment_methods_one_primary
  ON public.vendor_payment_methods(vendor_profile_id)
  WHERE is_primary;

ALTER TABLE public.vendor_payment_methods ENABLE ROW LEVEL SECURITY;

-- Pattern A owner: the vendor CRUDs rows under their own vendor_profiles row.
DROP POLICY IF EXISTS vendor_payment_methods_owner ON public.vendor_payment_methods;
CREATE POLICY vendor_payment_methods_owner
  ON public.vendor_payment_methods FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vp.vendor_profile_id FROM public.vendor_profiles vp
      WHERE vp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_profile_id IN (
      SELECT vp.vendor_profile_id FROM public.vendor_profiles vp
      WHERE vp.user_id = auth.uid()
    )
  );

-- NOTE: couples never query this table directly. The settlement rail fetches a
-- vendor's published + allowed methods through a server action using the
-- service-role client (server-filtered to vendors the couple has actually
-- booked). Admin moderation likewise runs through the service role. RLS
-- therefore default-denies every other authenticated user.

-- ----------------------------------------------------------------------------
-- 2. event_vendor_payments.proof_r2_key
--    Optional receipt screenshot the couple attaches when recording a direct
--    (off-platform) payment to a vendor. Additive + nullable; existing rows
--    and the 0007 logPayment flow are unaffected.
-- ----------------------------------------------------------------------------

ALTER TABLE public.event_vendor_payments
  ADD COLUMN IF NOT EXISTS proof_r2_key TEXT;

COMMIT;
