-- vendor_locked_qr_tokens — multi-service + contract + remembrance columns
-- ============================================================================
-- Owner 2026-07 Locked-QR follow-up. Three additive, nullable/defaulted columns
-- on the token (all backward-compatible — legacy tokens keep working):
--
--   • vendor_service_ids — the FULL set of leaf offerings this one deal covers
--     (owner: "can pick multiple services for that event"). The existing scalar
--     `vendor_service_id` stays as the PRIMARY (first) service that resolves the
--     event_vendors category; this array is the complete list for display.
--   • source_contract_id — the vendor's own saved contract chosen as the
--     template for this deal (owner: "pick a contract for this process"). At
--     claim the claim action copies it into a fresh, event-bound vendor_contracts
--     row for the couple. ON DELETE SET NULL so deleting the template doesn't
--     break issued tokens.
--   • remembrance_r2_key — an OPTIONAL keepsake photo the vendor attaches
--     alongside the required payment proof.
--
-- No RLS change — the existing vendor-org ALL + admin-read policies cover these.
-- Idempotent ADD COLUMN IF NOT EXISTS — re-runnable.
-- ============================================================================

ALTER TABLE public.vendor_locked_qr_tokens
  ADD COLUMN IF NOT EXISTS vendor_service_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_contract_id UUID
    REFERENCES public.vendor_contracts(contract_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS remembrance_r2_key TEXT;

COMMENT ON COLUMN public.vendor_locked_qr_tokens.vendor_service_ids IS
  'All vendor_services leaf ids this deal covers (multi-service). Scalar vendor_service_id remains the primary that sets event_vendors.category; this is the full list for display.';
COMMENT ON COLUMN public.vendor_locked_qr_tokens.source_contract_id IS
  'The vendor''s saved vendor_contracts row chosen as the contract template. Copied into a fresh event-bound contract for the couple at claim (claimLockedQr). ON DELETE SET NULL.';
COMMENT ON COLUMN public.vendor_locked_qr_tokens.remembrance_r2_key IS
  'Optional keepsake photo the vendor attaches alongside the required downpayment proof (proof_r2_key).';
