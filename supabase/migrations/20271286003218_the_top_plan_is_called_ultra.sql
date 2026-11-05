-- ============================================================================
-- the_top_plan_is_called_ultra
--
-- ⚖ OWNER 2026-10-23 (DECISION_LOG, corpus aedbf233): the supplier plans are
-- **Solo · Pro · Ultra**. "Enterprise" is renamed to "Ultra" everywhere a person
-- reads it. The internal key (`tier_state = 'enterprise'`) and every SKU id
-- (`enterprise_vendor_monthly`, `enterprise_vendor_annual`) stay UNCHANGED —
-- only the words move.
--
-- `vendor_billing_catalog.title` is display-only: it is the plan's name on the
-- order a shop just placed (vendor-dashboard/subscription/actions.ts) and in
-- /llms.txt. Nothing keys on it. So the title of each `enterprise_*` SKU has the
-- word replaced in place — `replace()`, not a typed title, so whatever wording an
-- admin has since given the row is kept and only the plan name changes.
-- Orders already placed keep the words they were placed under.
--
-- Idempotent: a second run finds no 'Enterprise' left and changes nothing.
-- ============================================================================

UPDATE public.vendor_billing_catalog
   SET title      = replace(title, 'Enterprise', 'Ultra'),
       updated_at = now()
 WHERE sku_code LIKE 'enterprise\_%'
   AND title LIKE '%Enterprise%';
