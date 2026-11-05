-- ============================================================================
-- 20271292221070_a_service_keeps_its_place_among_its_category.sql
-- Created via `pnpm migration:new`. Idempotent (ADD COLUMN IF NOT EXISTS).
--
-- 🌳 ③b — THE CATEGORIES PAGE, FOUR LEVELS (owner 2026-10-26, DECISION_LOG "APPROVED — BUILD
-- THE TAXONOMY"; corpus prototypes/admin_taxonomy_four_levels_2026-10-26/interactive-v4.html +
-- PLAN.md § 7.3 "Order ▾ (Up · Down · First · Last)" on every level).
--
-- Groups and categories already keep a place (`service_categories.sort_order`); parts do too
-- (`inspiration_parts.sort_order`). A SERVICE had none — every reader lists services A–Z — so the
-- approved Order ▾ on a service had nothing to write. PLAN § 7.3 says, verbatim: "sort_order
-- columns exist on canonical_service_taxonomy? — grep -n sort_order before adding one". Measured:
-- it does not exist. This adds it.
--
-- 🔑 NOTHING MOVES ON SHIP DAY. Every row starts at 0, and /admin/categories orders by
-- (sort_order, name) — so with every row at 0 the order is exactly today's A–Z. Only the
-- Categories page reads it; the couple's and the supplier's lists still sort by name (said in the
-- page's ⓘ, so nobody expects otherwise). `reorderServicesCore` writes a dense 0..n-1 for one
-- category's services when an admin picks Order ▾.
--
-- Public SELECT on canonical_service_taxonomy already exists (the tree is public); a display
-- order is not sensitive, so the column rides the table's existing grant.
-- ============================================================================

ALTER TABLE public.canonical_service_taxonomy
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.canonical_service_taxonomy.sort_order IS
  'A service''s place among its category''s services on /admin/categories (Order ▾). 0 for every '
  'row until an admin reorders; the page orders by (sort_order, name), so all-zero = A–Z. '
  'Added 20271292221070 (③b).';
