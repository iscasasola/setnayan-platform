-- ═══════════════════════════════════════════════════════════════════════════
-- Papic Pool — the ladder goes to 30,000 (owner 2026-08-11)
-- ═══════════════════════════════════════════════════════════════════════════
-- Owner, verbatim: *"so for papic pool, it will be 3000, 6000, 10000, 13000,
-- 16000, 20000 23000, 26000, 30000"*, priced at ₱1,000 per step (owner-confirmed
-- the same session, from the three rungs already live).
--
-- The shape is the existing 3k / 6k / 10k block repeated three times: +3,000,
-- +3,000, +4,000 per cycle, ₱3,000 per 10,000 shots. So the per-shot rate at
-- 10k, 20k and 30k is identical to what we already charge — this LENGTHENS the
-- ladder, it does not reprice it. The three live rungs are untouched.
--
--   3,000 → ₱1,000  (live, unchanged)      16,000 → ₱5,000  NEW
--   6,000 → ₱2,000  (live, unchanged)      20,000 → ₱6,000  NEW
--  10,000 → ₱3,000  (live, unchanged)      23,000 → ₱7,000  NEW
--  13,000 → ₱4,000  NEW                    26,000 → ₱8,000  NEW
--                                          30,000 → ₱9,000  NEW
--
-- 🔑 THE PICKER NEEDS NO CODE CHANGE. `poolStepCount` is derived from the
-- rung list, so the onboarding stepper walks whatever the catalog resolves to.
-- Proved by a nine-rung case in papic-onboarding-selection.test.ts rather than
-- asserted. Adding a rung is a migration and nothing else.
--
-- 🚨 EXCEPT FOR ONE THING, AND IT IS THE WHOLE REASON THIS FILE HAS A SIBLING
-- COMMIT. `activateOrderSku` dispatches on an EXACT service_key map and ends
-- `if (!hook) return; // default no-op`. A new Pool rung that is sellable but
-- absent from that map would take the couple's ₱9,000, mark the order paid, and
-- grant ZERO shots — no error, no log, nothing to notice but an empty pool.
-- The six codes below are wired into EXACT_HOOKS in the same commit, and
-- `papic-rungs-are-fundable.db.test.ts` now fails if a sellable rung ever
-- ships without a hook again. Same family as every other silent decline on this
-- codebase's board: the dispatcher DECLINES and the only symptom is an absence.
--
-- Prices are admin-editable at /admin/pricing after this lands — these are the
-- opening values, not a lock. `saas_overhead_cost_php` is scaled linearly from
-- the 10,000 row (₱240 per 10,000 shots), the largest existing rung and so the
-- most representative of what bulk storage actually costs us.

-- ⚠ ORDER MATTERS: papic_pass_tiers.service_code carries a FOREIGN KEY to
-- platform_retail_catalog_v2.service_code, so the CATALOG row must exist first.
-- Inserting the tiers first fails the whole migration with a 23503 — caught by
-- the PGlite replay, which is the only place that ordering is ever exercised
-- before a deploy tries it against prod.
-- ── 1 · the prices (FIRST — the tier FK points here) ─────────────────────────────────────────────────────────────
-- ⚠ ON CONFLICT deliberately does NOT overwrite retail_price_php. The catalog
-- is admin-editable, so a re-run of this migration must never quietly undo a
-- price the owner has since changed at /admin/pricing — that is exactly the
-- "a price change is never a side effect" rule. Only the copy and the
-- structural flags are refreshed.
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, description,
   is_active, is_token_able, is_pax_priced, billing_period)
VALUES
  ('PAPIC_GUEST_13K', 'Papic Pool — add 13,000 shots', 4000, 312,
   'Every guest on your list gets a camera. About 13,000 photos, or any mix of photos and videos.',
   TRUE, FALSE, FALSE, 'one_time'),
  ('PAPIC_GUEST_16K', 'Papic Pool — add 16,000 shots', 5000, 384,
   'Every guest on your list gets a camera. About 16,000 photos, or any mix of photos and videos.',
   TRUE, FALSE, FALSE, 'one_time'),
  ('PAPIC_GUEST_20K', 'Papic Pool — add 20,000 shots', 6000, 480,
   'Every guest on your list gets a camera. About 20,000 photos, or any mix of photos and videos.',
   TRUE, FALSE, FALSE, 'one_time'),
  ('PAPIC_GUEST_23K', 'Papic Pool — add 23,000 shots', 7000, 552,
   'Every guest on your list gets a camera. About 23,000 photos, or any mix of photos and videos.',
   TRUE, FALSE, FALSE, 'one_time'),
  ('PAPIC_GUEST_26K', 'Papic Pool — add 26,000 shots', 8000, 624,
   'Every guest on your list gets a camera. About 26,000 photos, or any mix of photos and videos.',
   TRUE, FALSE, FALSE, 'one_time'),
  ('PAPIC_GUEST_30K', 'Papic Pool — add 30,000 shots', 9000, 720,
   'Every guest on your list gets a camera. About 30,000 photos, or any mix of photos and videos.',
   TRUE, FALSE, FALSE, 'one_time')
ON CONFLICT (service_code) DO UPDATE
  SET title                  = EXCLUDED.title,
      saas_overhead_cost_php = EXCLUDED.saas_overhead_cost_php,
      description            = EXCLUDED.description,
      is_active              = EXCLUDED.is_active,
      is_token_able          = EXCLUDED.is_token_able,
      is_pax_priced          = EXCLUDED.is_pax_priced,
      billing_period         = EXCLUDED.billing_period,
      updated_at             = now();

-- ── 2 · the rungs ──────────────────────────────────────────────────────────────
-- is_topup stays FALSE: every rung has been additive and repeatable since
-- 20271019231590, and the onboarding picker filters is_topup out to match the
-- card's ladder exactly. A rung marked topup here would vanish from the picker.
INSERT INTO public.papic_pass_tiers (service_code, points, is_topup, sort_order, is_active)
VALUES
  ('PAPIC_GUEST_13K', 13000, FALSE,  50, TRUE),
  ('PAPIC_GUEST_16K', 16000, FALSE,  60, TRUE),
  ('PAPIC_GUEST_20K', 20000, FALSE,  70, TRUE),
  ('PAPIC_GUEST_23K', 23000, FALSE,  80, TRUE),
  ('PAPIC_GUEST_26K', 26000, FALSE,  90, TRUE),
  ('PAPIC_GUEST_30K', 30000, FALSE, 100, TRUE)
ON CONFLICT (service_code) DO UPDATE
  SET points     = EXCLUDED.points,
      is_topup   = EXCLUDED.is_topup,
      sort_order = EXCLUDED.sort_order,
      is_active  = EXCLUDED.is_active,
      updated_at = now();

-- ── the fence must not learn about them ────────────────────────────────────
-- The three shipped rungs are SELF-BOUNDING buckets and are deliberately absent
-- from papic_event_pool_config.pass_service_codes (the guest-derived fence used
-- by the PAPIC_UNLOCK* bundles); migration 20270828140000 asserts they stay out.
-- The six new rungs are the same product, so they stay out too — this comment
-- exists because adding them there would look like tidying up and would in fact
-- switch every buyer onto a guest-count-derived ceiling instead of the bucket
-- they paid for.
DO $$
DECLARE
  v_leaked TEXT[];
BEGIN
  SELECT array_agg(c)
    INTO v_leaked
    FROM public.papic_event_pool_config,
         LATERAL unnest(COALESCE(pass_service_codes, ARRAY[]::TEXT[])) AS c
   WHERE c LIKE 'PAPIC_GUEST%';
  IF v_leaked IS NOT NULL THEN
    RAISE EXCEPTION 'a Papic Pool rung leaked into pass_service_codes: %', v_leaked;
  END IF;
END $$;
