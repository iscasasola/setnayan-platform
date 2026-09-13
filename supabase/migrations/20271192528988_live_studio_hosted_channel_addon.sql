-- live_studio_hosted_channel_addon — the optional "Setnayan supplies the
-- channel" upsell (owner ruling 2026-09-02).
--
-- Live Studio has always assumed the couple pastes their own YouTube watch
-- link (or, pre-pool-only, connects their own channel via OAuth) — that stays
-- the DEFAULT and is unchanged by this row. This SKU is the OPTIONAL extra for
-- a couple who has no live-stream access, or isn't versed enough to activate
-- it themselves: Setnayan supplies and operates the channel instead.
--
-- ⚠ STACKS ON LIVE_STUDIO — DOES NOT REPLACE IT, AND GRANTS NO ENTITLEMENT OF
-- ITS OWN. This row must never be added to lib/add-on-stats.ts's ADD_ON_SKU_MAP
-- (that map ALSO drives lib/add-on-state.ts's 'launch' resolution — adding this
-- code there would let buying the channel alone unlock the multicam
-- controller, which nobody paid LIVE_STUDIO's price for). Multicam entitlement,
-- the watermark decision and the publish gate all stay keyed on LIVE_STUDIO
-- alone; this SKU only ever decides WHICH CHANNEL a broadcast goes out on. See
-- lib/live-studio-pool-only.ts's poolOnlyConnectNotice().
--
-- Priced ₱1,500/day, matching LIVE_STUDIO's own ₱1,500/day, so the two summed
-- read as the owner's number: "₱3,000 TOTAL for the hosted option" — not
-- ₱3,000 on top of ₱1,500. Same billing_period so both rows format identically
-- (formatV2Sku / the "/ day" suffix). Mirrors LIVE_STUDIO's shape exactly
-- (is_token_able / is_pax_priced / billing_period) — see the row it mirrors:
--   select * from platform_retail_catalog_v2 where service_code = 'LIVE_STUDIO';
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able, is_active, billing_period, description)
VALUES
  ('LIVE_STUDIO_HOSTED_CHANNEL',
   'Live Studio — hosted channel',
   1500.00,
   0.00,
   FALSE,
   TRUE,
   'per_day',
   'Optional add-on for Live Studio: Setnayan supplies and operates the YouTube channel your broadcast streams to, for couples who don''t have live-stream access or aren''t versed enough to activate it themselves. Buy alongside Live Studio — by default your broadcast goes out on your own YouTube (paste your watch link, or start your own broadcast); this add-on is only for the channel, not the multi-camera controller itself.')
ON CONFLICT (service_code) DO NOTHING;

-- Informational verification (never fails the migration on re-run).
DO $$
DECLARE v_price numeric; v_active boolean;
BEGIN
  SELECT retail_price_php, is_active INTO v_price, v_active
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'LIVE_STUDIO_HOSTED_CHANNEL';
  IF v_price IS NULL THEN
    RAISE NOTICE 'NOTE: LIVE_STUDIO_HOSTED_CHANNEL missing after insert (a prior row may exist; DO NOTHING preserves it).';
  ELSE
    RAISE NOTICE 'LIVE_STUDIO_HOSTED_CHANNEL seeded at PHP % per day, is_active=%.', v_price, v_active;
  END IF;
END $$;
