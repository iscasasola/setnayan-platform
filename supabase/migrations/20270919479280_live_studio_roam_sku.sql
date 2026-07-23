-- live_studio_roam_sku — the Live Studio ROAM catalog SKU.
--
-- Owner 2026-07-23: Live Studio Roam ₱3,500/day (Cast is ₱2,500/day = PANOOD_SYSTEM).
--
-- DARK ON ARRIVAL: is_active = FALSE. The catalog reader (lib/v2-catalog.ts)
-- filters `.eq('is_active', true)`, so this row does NOT surface on /pricing and
-- is not standalone-sellable yet — the legitimate "not-yet-launched SKU" state
-- (same posture as SETNAYAN_AI_RENEW). The price is RECORDED now; at launch the
-- owner flips is_active = TRUE together with NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED.
-- The Suite/Studio tile is separately gated by that flag (lib/add-ons-catalog.ts),
-- so nothing about Roam is visible or buyable until both flip.
--
-- MODEL: base Roam = the multi-camera "pick your view / wander" capability with
-- cameras BYO (phones joined via the QR claim) → ~₱0 overhead, like Cast. A
-- Setnayan-provided camera kit is a SEPARATE add-on (its per-day COGS exceeds the
-- ₱1,000 premium over Cast), not bundled into this ₱3,500/day base.
--
-- Idempotent: ON CONFLICT (service_code) DO NOTHING — never clobbers a later
-- admin flip of is_active/price.

INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able, is_active, billing_period, description)
VALUES
  ('LIVE_STUDIO_ROAM',
   'Live Studio Roam',
   3500.00,
   0.00,
   FALSE,
   FALSE,            -- dark until launch; flip TRUE alongside the flag
   'per_day',
   'Guests choose which camera to watch and wander your event — multiple angles and venues, live on your event page, with the directed feed as the default. Per event-day. Cameras join as phones via QR; a Setnayan camera kit is an optional add-on.')
ON CONFLICT (service_code) DO NOTHING;

-- Verify the row landed at the locked price (informational; never fails on re-run).
DO $$
DECLARE v_price numeric; v_active boolean;
BEGIN
  SELECT retail_price_php, is_active INTO v_price, v_active
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'LIVE_STUDIO_ROAM';
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'LIVE_STUDIO_ROAM missing from platform_retail_catalog_v2 after insert';
  END IF;
  IF v_price <> 3500.00 THEN
    RAISE NOTICE 'NOTE: LIVE_STUDIO_ROAM price is % (expected 3500 on a fresh insert; a prior admin change is preserved by DO NOTHING)', v_price;
  END IF;
  IF v_active THEN
    RAISE NOTICE 'NOTE: LIVE_STUDIO_ROAM is already is_active=TRUE (launched?). This migration seeds it dark; a later flip is preserved.';
  END IF;
END $$;
