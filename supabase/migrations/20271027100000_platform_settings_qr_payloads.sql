-- ============================================================================
-- 20271027100000_platform_settings_qr_payloads.sql
--
-- Store the DECODED QR Ph payload alongside each uploaded merchant QR image,
-- so checkout can mint a per-order code carrying that order's exact amount
-- instead of serving a static picture the couple must type a figure into.
--
-- Why a column and not a decode-on-render: decoding a PNG needs sharp + jsQR
-- (an image pipeline) which has no business running on every checkout paint.
-- The payload is a ~150-char string that only changes when an admin uploads a
-- new QR, so we decode ONCE at upload time (uploadMerchantQr in
-- app/admin/settings/actions.ts) and read the string thereafter.
--
-- NULL is a valid, safe state: it means "we could not decode this image as a
-- QR Ph code", and every reader falls back to rendering the original uploaded
-- image unchanged — exactly today's behaviour. Nothing breaks if these stay
-- empty.
--
-- Grants: platform_settings carries TABLE-level `GRANT SELECT ... TO
-- authenticated` and `REVOKE ALL ... FROM anon` (20271014400000), so new
-- columns inherit both. The REVOKE below is re-asserted defensively and is
-- idempotent — see memory `project-setnayan-default-acl-root-cause`.
--
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS gcash_qr_payload TEXT,
  ADD COLUMN IF NOT EXISTS bdo_qr_payload   TEXT;

COMMENT ON COLUMN public.platform_settings.gcash_qr_payload IS
  'Decoded QR Ph (EMVCo TLV) payload of the uploaded GCash receiving QR, set at upload time. Checkout re-mints this per order with the order amount (lib/emv-qr.ts). NULL = not decodable; readers fall back to the static gcash_qr_url image.';

COMMENT ON COLUMN public.platform_settings.bdo_qr_payload IS
  'Decoded QR Ph (EMVCo TLV) payload of the uploaded BDO receiving QR. Same contract as gcash_qr_payload.';

-- ----------------------------------------------------------------------------
-- Backfill the two rows already in production.
--
-- These payloads were decoded from the CURRENTLY-stored images on 2026-07-31
-- and verified against live wallets (owner scanned both). The URL equality
-- check is the safety interlock: if an admin has replaced either QR since,
-- the predicate simply does not match and the column stays NULL rather than
-- minting an amount onto a stale account. Money must never ride on a guess.
-- ----------------------------------------------------------------------------

UPDATE public.platform_settings
   SET gcash_qr_payload = '00020101021127830012com.p2pqrpay0111GXCHPHM2XXX02089996440303152170200000006560417DWQM4TK3JDNWIWRDY5204601653036085802PH5908Setnayan6011Holy Spirit6104123463045E2D'
 WHERE id = 1
   AND gcash_qr_payload IS NULL
   AND gcash_qr_url = 'https://njrupjnvkjkitfctetvi.supabase.co/storage/v1/object/public/platform-assets/merchant-qr/gcash/1778727799654-aqmayr.png';

UPDATE public.platform_settings
   SET bdo_qr_payload = '00020101021127590012com.p2pqrpay0111BNORPHMMXXX02089996440304120065400279655204601653036085802PH5903BDO6011Makati City6304EA14'
 WHERE id = 1
   AND bdo_qr_payload IS NULL
   AND bdo_qr_url = 'https://njrupjnvkjkitfctetvi.supabase.co/storage/v1/object/public/platform-assets/merchant-qr/bdo/1778727780562-2x9cpw.png';

-- Defensive re-assert (table-level; new columns inherit these).
REVOKE ALL ON TABLE public.platform_settings FROM anon;
GRANT SELECT ON TABLE public.platform_settings TO authenticated;

COMMIT;
