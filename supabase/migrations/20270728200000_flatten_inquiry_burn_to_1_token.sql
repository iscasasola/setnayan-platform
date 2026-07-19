-- ============================================================================
-- 20270728200000_flatten_inquiry_burn_to_1_token.sql
-- Flatten the vendor inquiry-unlock burn to a CONSTANT 1 token for ALL regions
-- (owner PRICING LOCK 2026-07-12 ② "burn = flat 1 token for ALL inquiries/
-- locations", reaffirming the 2026-07-11 lead-gate lock). Paired with the
-- ₱200/token reprice (20270728100000), every inquiry now costs 1 × ₱200 = ₱200
-- uniformly, everywhere.
--
-- WHERE THE BURN ACTUALLY READS FROM (the effective fix)
-- -----------------------------------------------------
-- The DECISION_LOG note says "flatten token_burn_bands to 1", but the live burn
-- path stopped reading token_burn_bands at migration 20270331100000
-- (burn_band_single_source). BOTH the burn RPC `unlock_vendor_event`
-- (20270401611377) AND the hold RPC `unlock_vendor_event_hold` (20270726988829)
-- now resolve events.region → public.regions.burn_band (alias-match) and set
--   v_tokens := v_band;   (band NULL → floor 1)
-- So the AUTHORITATIVE lever is public.regions.burn_band. Setting every region's
-- burn_band = 1 makes the RPC charge exactly 1 token everywhere, AND makes the
-- HOLD (unlock_vendor_event_hold, PR #3133/#3134) reserve exactly 1 token — the
-- held-and-charged amount both become 1. The admin editor
-- (/admin/token-bands + /admin/pricing token-bands surface) already reads/writes
-- regions.burn_band, so it will reflect the flat 1 too.
--
-- token_burn_bands is DEPRECATED + read-free (retired 2026-07-01). We still sync
-- it to tokens=1/band=1 below so the dormant table can never resurface a stale
-- 1-3 map (e.g. on a future re-point or manual read). It does NOT drive any
-- charge today.
--
-- NOT TOUCHED: no feature flag is altered (VENDOR_TIER_SEARCH_GATE etc.), no
-- tier gate logic, no RPC body — only the band DATA is flattened. The
-- burn_band CHECK (BETWEEN 1 AND 3) and token_burn_bands CHECKs (band 1-3,
-- tokens > 0) all admit the value 1. Idempotent (re-run = same state).
-- ============================================================================

-- ── (1) AUTHORITATIVE: the live burn + hold RPCs read this. Flatten to 1. ─────
UPDATE public.regions
   SET burn_band = 1
 WHERE burn_band <> 1;

-- ── (2) HYGIENE: keep the deprecated/read-free token_burn_bands consistent so
--        it can never re-surface a stale 1-3 map. Guarded so a future DROP of
--        the table cannot fail this migration. Does NOT affect any charge.
DO $$
BEGIN
  IF to_regclass('public.token_burn_bands') IS NOT NULL THEN
    UPDATE public.token_burn_bands
       SET band = 1, tokens = 1
     WHERE band <> 1 OR tokens <> 1;
  END IF;
END $$;
