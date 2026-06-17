-- Seed the Save-the-Date premium-openings SKU into the admin retail catalog
-- (iteration 0024 · PR4 P5 activation · owner-set price ₱799 2026-06-17).
--
-- The owner-settled model: the Save-the-Date content FILM is FREE; the cinematic
-- OPENINGS (veil / envelope / doors that lift to uncover the page) are the
-- PREMIUM "template unlock". P5 shipped the gate plumbing (lib/std-openings.ts ·
-- the reveal activates on admin-global OR ?reveal= OR THIS ownership); this seeds
-- the price so the unlock is purchasable.
--
-- Price is ADMIN-MANAGED — this is the INITIAL seed; the owner can change it
-- anytime at /admin/pricing?edit=STD_PREMIUM_OPENINGS (updateRetailSku). It is
-- read at runtime via formatV2Sku('STD_PREMIUM_OPENINGS') → never hardcoded in
-- app code. ₱799 was set by the owner (revised down from the provisional ₱1,499);
-- still PROVISIONAL pending the holistic pricing pass (reconcile vs the ₱3,999
-- PRO unlock — à-la-carte vs included).
--
-- saas_overhead_cost_php = 0 — the openings are pure-margin client-side WebGL/CSS
-- (no per-event render/storage cost). is_token_able = FALSE (couple-paid, not a
-- crew-delivery token SKU). Idempotent upsert (the canonical catalog-seed idiom),
-- so a re-apply re-asserts the seed without erroring.

INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able)
VALUES
  ('STD_PREMIUM_OPENINGS', 'Save-the-Date Cinematic Openings', 799.00, 0.00, FALSE)
ON CONFLICT (service_code) DO UPDATE SET
  title                  = EXCLUDED.title,
  retail_price_php       = EXCLUDED.retail_price_php,
  saas_overhead_cost_php = EXCLUDED.saas_overhead_cost_php,
  is_token_able          = EXCLUDED.is_token_able;
