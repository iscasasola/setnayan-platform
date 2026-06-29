-- ============================================================================
-- 20270321516052_setnayan_ai_subscription_sku.sql
--
-- Setnayan AI per-USER subscription — the term-pass SKU (owner-set 2026-06-29:
-- ₱499 per 28-day cycle). A term pass = ₱499 × number of 28-day cycles; the
-- buyer's paid amount determines the cycles granted (see lib/sku-activation.ts
-- SETNAYAN_AI_SUB hook + lib/setnayan-ai-subscription.ts).
--
-- Seeded INACTIVE (is_active = false) so it stays dormant — it must NOT surface
-- on any pricing/buy surface until go-live, which is gated on the per-user flag
-- (setnayan_ai_per_user_enabled) + the holistic pricing reconciliation. The
-- owner flips is_active = true from /admin/pricing at go-live (admin-managed,
-- never hardcoded). Idempotent upsert; price is the single admin source.
-- ============================================================================

INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php,
   is_token_able, description, is_pax_priced, is_active)
VALUES
  ('SETNAYAN_AI_SUB', 'Setnayan AI (subscription)', 499, 0,
   false,
   'Setnayan AI as a subscription — ₱499 per 28-day cycle. Your always-on planning assistant: finds and ranks vendors, watches your budget, deadlines and contracts, and flags risks across all your events. A term pass covers as many 28-day cycles as you buy.',
   false, false)
ON CONFLICT (service_code) DO UPDATE
  SET retail_price_php = excluded.retail_price_php,
      title           = excluded.title,
      description      = excluded.description,
      updated_at       = now();
