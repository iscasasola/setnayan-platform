-- Papic One — the flat per-event pass becomes three PURCHASED POINT BUCKETS.
-- Corpus: 0012_papic/Papic_Pricing_Lock_2026-07-20.md § 2.3 + § 11 (owner session 2026-07-20).
--
-- ── WHAT THIS DOES ────────────────────────────────────────────────────────
-- 1. Retires the PAX CURVE on PAPIC_GUEST. The live row is pax-priced —
--    floor 100 pax @ ₱2,999, +₱350 per 50 pax — so it reaches ₱4,399 at 300 pax
--    and ₱5,799 at 500. Against PH rivals who charge one flat number (photoshare
--    ₱999, Kuha ₱499/₱999/₱1,999) we got MORE expensive exactly where they stayed
--    flat. That is a SLOPE defect, and it is the single competitive defect the
--    2026-07-20 councils agreed on.
-- 2. Makes PAPIC_GUEST the ₱500 / 3,000-point entry rung and adds three siblings:
--    6,000 (₱1,000) · 10,000 (₱1,500) · a repeatable +10,000 top-up (₱1,500).
-- 3. Adds papic_pass_tiers — the ONE place a pass SKU's point grant may live.
--
-- ── WHY PAPIC_GUEST IS REUSED, NOT REPLACED ──────────────────────────────
-- The service_code is load-bearing: lib/add-ons-catalog.ts:626 merchandises it,
-- lib/entitlements.ts keys ownership off it, and the never-rename lock holds.
-- Retitling + repricing an existing code is safe; minting a new one for the
-- entry rung would orphan the doorway. Siblings therefore share its prefix.
--
-- ── PURCHASED BUCKETS, NOT A DERIVED FENCE (lock § 11) ───────────────────
-- Migration 20270826385580 shipped an event-scoped fence whose pool is
-- clamp(guest_count × 150, 5000, 30000). That fence governs products that
-- PROMISE unlimited — its papic_event_pool_config.pass_service_codes is
-- ['PAPIC_UNLOCK','PAPIC_UNLOCK_LTD'], the ₱15,000/₱9,000 bundles.
--
--   ⚠ DO NOT add these tier SKUs to pass_service_codes. They are self-bounding
--     by construction — 3,000 points is 3,000 points. Adding them would layer
--     the guest-derived formula ON TOP of a purchased bucket and silently hand
--     a ₱500 buyer up to 30,000 points. papic_event_pool_config is a SINGLE
--     global 'default' row — there is no per-SKU formula to tune around it.
--
-- A paid tier instead lands as a row in papic_event_point_grants (source
-- 'topup_order', order_id set) — the ledger that migration anticipated:
-- "the top-up SKU itself is deliberately NOT created or priced here (owner
-- action)". This IS that owner action. Grant wiring: lib/sku-activation.ts.
--
-- ── PRICES ARE PLAIN PHP NUMERIC, NOT CENTAVOS ───────────────────────────
-- Verified against prod 2026-07-20 (PAPIC_GUEST = 2999.00). Same convention the
-- Live Studio reprice (20270827190298) verified independently.
--
-- ── STAYS is_active = FALSE ──────────────────────────────────────────────
-- All four rows ship INACTIVE. The doorway card in add-ons-catalog.ts is
-- status:'coming_soon' and papicGuestPassAccess() still has zero production
-- callers; flipping either is PR-2. Shipping these active would advertise a buy
-- path that does not resolve yet. Data first, doorway second.

-- ---- 1. PAPIC_GUEST → the ₱500 / 3,000-point entry rung -------------------

UPDATE public.platform_retail_catalog_v2
SET title                   = 'Papic One — 3,000 shots (per event)',
    retail_price_php        = 500,
    is_pax_priced           = FALSE,
    pax_floor               = NULL,
    pax_floor_price_php     = NULL,
    pax_increment_size      = NULL,
    pax_increment_price_php = NULL,
    updated_at              = NOW()
WHERE service_code = 'PAPIC_GUEST'
  AND (retail_price_php IS DISTINCT FROM 500 OR is_pax_priced IS DISTINCT FROM FALSE);

-- ---- 2. the three siblings ------------------------------------------------
-- saas_overhead_cost_php mirrors the modelled marginal cost at a 6-month window
-- (~₱0.023/point + ₱7.50 manual reconciliation), rounded up. It is an admin
-- reporting field, never charged.

INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_active, billing_period, is_pax_priced, description)
VALUES
  ('PAPIC_GUEST_6K',    'Papic One — 6,000 shots (per event)',  1000, 150, FALSE, 'one_time', FALSE,
   'Every guest on your list gets a camera. About 6,000 photos, or any mix of photos and videos.'),
  ('PAPIC_GUEST_10K',   'Papic One — 10,000 shots (per event)', 1500, 240, FALSE, 'one_time', FALSE,
   'Every guest on your list gets a camera. About 10,000 photos, or any mix of photos and videos.'),
  ('PAPIC_GUEST_TOPUP', 'Papic One — add 10,000 shots',         1500, 240, FALSE, 'one_time', FALSE,
   'Adds 10,000 shots to an event that already holds the 10,000-shot pass. Repeatable.')
ON CONFLICT (service_code) DO NOTHING;

-- ---- 3. the SKU → points map ---------------------------------------------
-- ONE place a pass SKU's point grant may live. Same posture as
-- papic_tier_config: admin-editable data, never a hardcoded number in app code.

CREATE TABLE IF NOT EXISTS public.papic_pass_tiers (
  service_code TEXT PRIMARY KEY
                 REFERENCES public.platform_retail_catalog_v2(service_code) ON DELETE CASCADE,
  points       INTEGER NOT NULL CHECK (points > 0),
  is_topup     BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.papic_pass_tiers IS
  'Papic One purchased point buckets: service_code -> points granted on payment. '
  'A paid order for one of these writes papic_event_point_grants(source=''topup_order''). '
  'DISTINCT from papic_event_pool_config, which derives a fence from guest count for '
  'the PAPIC_UNLOCK* bundles — these tiers are self-bounding and must NEVER be added '
  'to that config''s pass_service_codes. Corpus: Papic_Pricing_Lock_2026-07-20 § 11.';

COMMENT ON COLUMN public.papic_pass_tiers.is_topup IS
  'TRUE = repeatable add-on, requires the event to already hold >= 10,000 points '
  '(owner rule 2026-07-20: the top-up unlocks at POINTS HELD, not at a specific SKU, '
  'because tiers stack additively and a couple can reach 9,000 without the top rung).';

INSERT INTO public.papic_pass_tiers (service_code, points, is_topup, sort_order)
VALUES
  ('PAPIC_GUEST',        3000,  FALSE, 10),
  ('PAPIC_GUEST_6K',     6000,  FALSE, 20),
  ('PAPIC_GUEST_10K',   10000,  FALSE, 30),
  ('PAPIC_GUEST_TOPUP', 10000,  TRUE,  40)
ON CONFLICT (service_code) DO UPDATE
SET points     = EXCLUDED.points,
    is_topup   = EXCLUDED.is_topup,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

ALTER TABLE public.papic_pass_tiers ENABLE ROW LEVEL SECURITY;

-- Public READ: the pricing page and the Papic set-up surface both quote these.
-- Writes are service-role / admin only (no policy = denied).
DROP POLICY IF EXISTS papic_pass_tiers_read ON public.papic_pass_tiers;
CREATE POLICY papic_pass_tiers_read ON public.papic_pass_tiers
  FOR SELECT USING (TRUE);

-- ---- 4. post-conditions — fail loudly rather than half-apply -------------

DO $$
DECLARE
  v_price   NUMERIC;
  v_pax     BOOLEAN;
  v_tiers   INTEGER;
  v_fenced  BOOLEAN;
BEGIN
  SELECT retail_price_php, is_pax_priced INTO v_price, v_pax
  FROM public.platform_retail_catalog_v2 WHERE service_code = 'PAPIC_GUEST';

  IF v_price IS NULL THEN
    RAISE EXCEPTION 'PAPIC_GUEST missing from platform_retail_catalog_v2';
  END IF;
  IF v_price IS DISTINCT FROM 500 THEN
    RAISE EXCEPTION 'PAPIC_GUEST price failed to settle at 500 (got %)', v_price;
  END IF;
  IF v_pax IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'PAPIC_GUEST is still pax-priced — the curve did not retire';
  END IF;

  SELECT COUNT(*) INTO v_tiers FROM public.papic_pass_tiers WHERE is_active;
  IF v_tiers <> 4 THEN
    RAISE EXCEPTION 'expected 4 active papic_pass_tiers rows, found %', v_tiers;
  END IF;

  -- The § 11 guardrail, asserted rather than merely documented.
  SELECT EXISTS (
    SELECT 1 FROM public.papic_event_pool_config
    WHERE pass_service_codes && ARRAY(SELECT service_code FROM public.papic_pass_tiers)
  ) INTO v_fenced;
  IF v_fenced THEN
    RAISE EXCEPTION
      'a Papic One tier is listed in papic_event_pool_config.pass_service_codes — '
      'purchased buckets must never also be guest-derived (lock § 11)';
  END IF;
END $$;
