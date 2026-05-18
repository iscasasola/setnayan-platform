-- ============================================================================
-- 20260518200000_vendor_contracts_dual_esign_retire_0032.sql
--
-- Two-part migration (owner-locked 2026-05-18):
--
-- (1) Retire Contract Intelligence (iteration 0032) — the paid AI-analysis
--     SKU at ₱199. Two `service_catalog` rows flip to `is_active=FALSE`.
--     Spec corpus row gets a "retired 2026-05-18" marker in CLAUDE.md
--     decision log (added separately).
--
-- (2) Add vendor contract upload + dual-signature schema. Vendor uploads a
--     contract PDF, picks the event/couple it's for, both parties sign
--     with canvas-captured signatures. No third-party e-sig integration in
--     V1 — signatures are PNG image URLs in R2 with IP + UA + timestamp
--     for evidentiary trail.
--
-- Notary integration was explicitly excluded by owner — Philippine
-- Notarial Law (2004) restricts a notary's jurisdiction to their
-- commissioning RTC city/province, making in-house impractical and a
-- partner network out of scope for now.
--
-- Idempotent. No drops.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Retire Contract Intelligence SKUs (iteration 0032)
-- ----------------------------------------------------------------------------

UPDATE public.service_catalog
   SET is_active = FALSE,
       retired_at = COALESCE(retired_at, NOW()),
       description = description
         || ' | Retired 2026-05-18 (CLAUDE.md decision log) — '
         || 'replaced by free dual e-signature on every vendor contract '
         || '(no AI analysis in V1).',
       updated_at = NOW()
 WHERE sku_code IN (
   'contract_intelligence_upgrade',     -- couple-side ₱199
   'contract_intelligence_per_contract' -- vendor-side ₱199 (or free with Pro)
 );

-- vendor_pro_weekly description still references "free Contract Intelligence"
-- which is now a retired SKU. Update so the catalog doesn't promise a perk
-- that no longer exists.
UPDATE public.service_catalog
   SET description = 'Weekly Vendor Pro subscription (₱499/wk). Includes '
         || 'multi-service catalog, proposal builder, team / agent invites, '
         || 'per-service calendars + master calendar, and the new dual '
         || 'e-signature flow for vendor contracts (free, built-in).',
       updated_at = NOW()
 WHERE sku_code = 'vendor_pro_weekly';

-- ----------------------------------------------------------------------------
-- 2. vendor_contracts — one row per uploaded contract per (vendor, event)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_contracts (
  contract_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id             TEXT UNIQUE NOT NULL
                        DEFAULT public.generate_public_id('C'),

  vendor_profile_id     UUID NOT NULL
                        REFERENCES public.vendor_profiles(vendor_profile_id)
                        ON DELETE CASCADE,
  event_id              UUID NOT NULL
                        REFERENCES public.events(event_id)
                        ON DELETE CASCADE,

  -- Optional link to a specific order (NULL when the contract covers the
  -- vendor's overall engagement on the event rather than a single SKU).
  order_id              UUID REFERENCES public.orders(order_id)
                        ON DELETE SET NULL,

  -- Audit fields.
  uploaded_by_user_id   UUID NOT NULL REFERENCES public.users(user_id)
                        ON DELETE RESTRICT,

  -- Human metadata.
  title                 TEXT NOT NULL
                        CHECK (length(title) BETWEEN 1 AND 200),
  description           TEXT
                        CHECK (description IS NULL OR length(description) <= 2000),

  -- R2 object pointer. file_url stores the public/signed URL the app uses.
  file_url              TEXT NOT NULL,
  file_name             TEXT NOT NULL,
  file_size_bytes       BIGINT NOT NULL
                        CHECK (file_size_bytes > 0 AND file_size_bytes <= 26214400),  -- 25 MB hard cap
  mime_type             TEXT NOT NULL DEFAULT 'application/pdf'
                        CHECK (mime_type = 'application/pdf'),

  -- Lifecycle. Vendor can keep a contract as 'draft' indefinitely; 'sent_for_signature'
  -- exposes it to the customer side; 'fully_signed' is auto-set by the
  -- signing flow once both parties have signed; 'cancelled' is terminal.
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'sent_for_signature', 'fully_signed', 'cancelled')),
  sent_for_signature_at TIMESTAMPTZ,
  fully_signed_at       TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancelled_by_user_id  UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  cancelled_reason      TEXT CHECK (cancelled_reason IS NULL OR length(cancelled_reason) <= 500),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_contracts_vendor_idx
  ON public.vendor_contracts(vendor_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS vendor_contracts_event_idx
  ON public.vendor_contracts(event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS vendor_contracts_status_idx
  ON public.vendor_contracts(status)
  WHERE status IN ('draft', 'sent_for_signature');

ALTER TABLE public.vendor_contracts ENABLE ROW LEVEL SECURITY;

-- Vendor reads + writes their own contracts (matched by vendor_profile_id
-- whose owner = auth.uid()).
DROP POLICY IF EXISTS vendor_contracts_vendor_rw ON public.vendor_contracts;
CREATE POLICY vendor_contracts_vendor_rw
  ON public.vendor_contracts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
       WHERE vp.vendor_profile_id = vendor_contracts.vendor_profile_id
         AND vp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
       WHERE vp.vendor_profile_id = vendor_contracts.vendor_profile_id
         AND vp.user_id = auth.uid()
    )
  );

-- Event members can READ contracts targeted at their event ONLY when the
-- vendor has actually sent the contract for signature (status <> 'draft').
-- Draft contracts stay private to the vendor.
DROP POLICY IF EXISTS vendor_contracts_event_member_read ON public.vendor_contracts;
CREATE POLICY vendor_contracts_event_member_read
  ON public.vendor_contracts FOR SELECT
  TO authenticated
  USING (
    status <> 'draft'
    AND EXISTS (
      SELECT 1 FROM public.event_members em
       WHERE em.event_id = vendor_contracts.event_id
         AND em.user_id = auth.uid()
         AND em.member_type IN ('couple', 'coordinator')
    )
  );

-- Admins can read everything for moderation.
DROP POLICY IF EXISTS vendor_contracts_admin_read ON public.vendor_contracts;
CREATE POLICY vendor_contracts_admin_read
  ON public.vendor_contracts FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. vendor_contract_signatures — one row per (contract, signer)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_contract_signatures (
  signature_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id           UUID NOT NULL
                        REFERENCES public.vendor_contracts(contract_id)
                        ON DELETE CASCADE,
  signer_user_id        UUID NOT NULL REFERENCES public.users(user_id)
                        ON DELETE RESTRICT,
  signer_role           TEXT NOT NULL
                        CHECK (signer_role IN ('vendor', 'customer')),
  signer_full_name      TEXT NOT NULL
                        CHECK (length(signer_full_name) BETWEEN 1 AND 200),
  signature_image_url   TEXT NOT NULL,   -- R2 PNG of the canvas signature
  signed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address            INET,
  user_agent            TEXT CHECK (user_agent IS NULL OR length(user_agent) <= 500),

  -- One signature per role per contract — vendor signs once, customer signs once.
  UNIQUE (contract_id, signer_role)
);

CREATE INDEX IF NOT EXISTS vendor_contract_signatures_contract_idx
  ON public.vendor_contract_signatures(contract_id, signed_at);

ALTER TABLE public.vendor_contract_signatures ENABLE ROW LEVEL SECURITY;

-- Signer reads their own signature row.
DROP POLICY IF EXISTS vendor_contract_signatures_self_read
  ON public.vendor_contract_signatures;
CREATE POLICY vendor_contract_signatures_self_read
  ON public.vendor_contract_signatures FOR SELECT
  TO authenticated
  USING (signer_user_id = auth.uid());

-- Anyone with read access to the parent contract can read its signatures.
-- (vendor for their contracts, event members for sent contracts, admins).
DROP POLICY IF EXISTS vendor_contract_signatures_via_contract
  ON public.vendor_contract_signatures;
CREATE POLICY vendor_contract_signatures_via_contract
  ON public.vendor_contract_signatures FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendor_contracts vc
       WHERE vc.contract_id = vendor_contract_signatures.contract_id
         AND (
           -- vendor owns the contract
           EXISTS (
             SELECT 1 FROM public.vendor_profiles vp
              WHERE vp.vendor_profile_id = vc.vendor_profile_id
                AND vp.user_id = auth.uid()
           )
           -- couple/planner on the event with a sent contract
           OR (
             vc.status <> 'draft'
             AND EXISTS (
               SELECT 1 FROM public.event_members em
                WHERE em.event_id = vc.event_id
                  AND em.user_id = auth.uid()
                  AND em.member_type IN ('couple', 'coordinator')
             )
           )
           -- admin override
           OR public.is_admin()
         )
    )
  );

-- INSERT: a user can only insert their own signature; the parent contract
-- must be sent_for_signature (vendor can't pre-sign drafts that haven't
-- been sent; customer can't sign anything not yet sent).
DROP POLICY IF EXISTS vendor_contract_signatures_self_insert
  ON public.vendor_contract_signatures;
CREATE POLICY vendor_contract_signatures_self_insert
  ON public.vendor_contract_signatures FOR INSERT
  TO authenticated
  WITH CHECK (
    signer_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.vendor_contracts vc
       WHERE vc.contract_id = vendor_contract_signatures.contract_id
         AND vc.status = 'sent_for_signature'
         AND (
           -- vendor signing their own sent contract
           (
             signer_role = 'vendor'
             AND EXISTS (
               SELECT 1 FROM public.vendor_profiles vp
                WHERE vp.vendor_profile_id = vc.vendor_profile_id
                  AND vp.user_id = auth.uid()
             )
           )
           -- customer signing a sent contract on their event
           OR (
             signer_role = 'customer'
             AND EXISTS (
               SELECT 1 FROM public.event_members em
                WHERE em.event_id = vc.event_id
                  AND em.user_id = auth.uid()
                  AND em.member_type IN ('couple', 'coordinator')
             )
           )
         )
    )
  );

-- ----------------------------------------------------------------------------
-- 4. Trigger — auto-set contract.status='fully_signed' when both signatures land.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vendor_contract_check_fully_signed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM public.vendor_contract_signatures
     WHERE contract_id = NEW.contract_id
  ) >= 2 THEN
    UPDATE public.vendor_contracts
       SET status = 'fully_signed',
           fully_signed_at = COALESCE(fully_signed_at, NOW()),
           updated_at = NOW()
     WHERE contract_id = NEW.contract_id
       AND status = 'sent_for_signature';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_contract_signatures_seal
  ON public.vendor_contract_signatures;
CREATE TRIGGER vendor_contract_signatures_seal
  AFTER INSERT ON public.vendor_contract_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.vendor_contract_check_fully_signed();

COMMIT;
