-- gown_maker_plans
-- Created via `pnpm migration:new`. Idempotent (IF NOT EXISTS, ON CONFLICT DO NOTHING, guarded UPDATE).
--
-- 👗 THE ATTIRE MAKER IS SOLD AS A MONTHLY PLAN, NOT A ONE-TIME TOOL (owner 2026-11-28, DECISION_LOG "Attire Maker
-- plans"; coordinator Q1/Q2 the same day). The rules live once in apps/web/lib/gown-plan.ts (gownPlanState /
-- gownPlanAllows); this file only gives them a place to read from:
--
--   1. vendor_gown_plans — one row per shop: when it first opened the Attire Maker (the 30-day trial's start, once per
--      shop, ever) and its paid plan (tier + the moment it ends). Written ONLY by the server (service role): the trial
--      stamp by the gown_tool action on the shop's first open, the plan by the payment approval (sku-activation). The
--      shop's own members read it. A shop never writes it — a plan it could edit is a plan it does not pay for.
--   2. Two catalog rows, vendor_tool_attire_use ("Use and save") and vendor_tool_attire_full ("Full": templates, print
--      and quotation), monthly (offering_type vendor_addon_recurring; each paid month adds 30 days). Their prices are
--      the owner's, set on 2026-11-28; the admin edits them in the catalog from here on. No other file types them.
--   3. The one-time row vendor_tool_attire_tool is retired, replaced_by the Use and save row. Measured in prod before
--      writing this: it was never bought (0 orders), so nobody is left holding it.
--
-- Eligibility (a custom gown design service card) is read from the shop's own cards at the gate, never stored here.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- 1 ─ the shop's trial and plan ──────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_gown_plans (
  vendor_profile_id  UUID        PRIMARY KEY REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  trial_started_at   TIMESTAMPTZ NULL,
  plan_tier          TEXT        NULL CHECK (plan_tier IN ('use', 'full')),
  plan_until         TIMESTAMPTZ NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vendor_gown_plans_tier_has_an_end CHECK ((plan_tier IS NULL) = (plan_until IS NULL))
);
ALTER TABLE public.vendor_gown_plans ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.vendor_gown_plans IS
  'Attire Maker plans (owner 2026-11-28): one row per shop — trial_started_at (the 30-day free trial starts at the shop''s first open, once per shop, ever) and the paid plan (plan_tier use = "Use and save" | full = templates, print and quotation; plan_until = when it ends; each paid month adds 30 days from today or from plan_until). The rules: apps/web/lib/gown-plan.ts. Written ONLY by the server (the gown_tool action stamps the trial; the payment approval extends the plan). The shop''s own members read it.';

DROP POLICY IF EXISTS vendor_gown_plans_own_read ON public.vendor_gown_plans;
CREATE POLICY vendor_gown_plans_own_read
  ON public.vendor_gown_plans
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

REVOKE ALL ON TABLE public.vendor_gown_plans FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.vendor_gown_plans TO authenticated;

-- 2 ─ the two monthly plans ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO public.vendor_billing_catalog (sku_code, title, price_php, offering_type, is_active, display_order, description)
SELECT v.sku_code, v.title, v.price_php, 'vendor_addon_recurring', TRUE, COALESCE(c.display_order, 0) + v.step, v.description
  FROM (VALUES
          ('vendor_tool_attire_use',  'Attire Maker · Use and save', 1990::NUMERIC, 1,
           'Monthly. The Attire Maker with your clients, their measurements, their designs and every record kept. Each payment adds 30 days.'),
          ('vendor_tool_attire_full', 'Attire Maker · Full',         3490::NUMERIC, 2,
           'Monthly. Everything in Use and save, plus pattern templates, full-size printing and the gown quotation. Each payment adds 30 days.')
       ) AS v(sku_code, title, price_php, step, description)
  LEFT JOIN public.vendor_billing_catalog c ON c.sku_code = 'vendor_tool_attire_tool'
ON CONFLICT (sku_code) DO NOTHING;

-- 3 ─ the one-time row is retired, replaced by Use and save ──────────────────────────────────────────────────────────
UPDATE public.vendor_billing_catalog
   SET is_active = FALSE,
       retired_at = COALESCE(retired_at, NOW()),
       retirement_reason = 'Owner 2026-11-28: the Attire Maker is a monthly plan (Use and save, or Full), with a 30-day free trial. Never bought one-time.',
       replaced_by_sku_code = 'vendor_tool_attire_use'
 WHERE sku_code = 'vendor_tool_attire_tool'
   AND is_active IS DISTINCT FROM FALSE;

COMMIT;
