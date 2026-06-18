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
-- crew-delivery token SKU). **ON CONFLICT DO NOTHING** — NOT the other seeds'
-- DO UPDATE: the price is ADMIN-MANAGED, so once the row exists a re-apply must
-- PRESERVE the admin's value, never silently re-assert ₱799. (The row was seeded
-- out-of-band via `db query`, so it's currently absent from prod's ledger; DO
-- NOTHING makes the eventual `db push` a harmless no-op that records the ledger
-- without clobbering whatever price the admin has set by then. The ledger was
-- also reconciled now via `supabase migration repair --status applied`.)

INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able)
VALUES
  ('STD_PREMIUM_OPENINGS', 'Save-the-Date Cinematic Openings', 799.00, 0.00, FALSE)
ON CONFLICT (service_code) DO NOTHING;
