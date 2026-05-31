-- Migration: event_vendors_cost_lines
-- Iteration 0006 / 0007 / 0021 — 3-line vendor cost on the Plan + Budget tab.
-- CLAUDE.md 2026-05-31 row "Vendors tab — scroll motion + card→workspace detail
-- + 3-line cost" (Workstream C).
--
-- The couple-facing amount for a vendor is the total of:
--   Service Price (total_cost_php) + Transport Cost + Food Allowance.
-- total_cost_php already exists on event_vendors; these two columns add the
-- transport + food allowance lines so the accordion's rolled_cost_php (computed
-- in apps/web/lib/vendors-plan-budget.ts enrich() as pkg + transport + crew)
-- has a real data source. Couples enter them in the vendor workspace; both
-- default to NULL → treated as ₱0 (total = Service only) until filled, never
-- fabricated.
--
-- These typed columns are the headline 3-line summary the accordion reads.
-- Iteration 0007's event_vendor_line_items (freeform label + amount) remains
-- the granular milestone layer; the accordion total uses these columns only,
-- so the two coexist without double-counting.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS transport_php      NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS food_allowance_php NUMERIC(12,2);

COMMENT ON COLUMN public.event_vendors.transport_php IS
  'Transport cost line (pesos) for this vendor booking. NULL = ₱0. Summed with total_cost_php + food_allowance_php for the couple-facing total. Iteration 0006/0007.';

COMMENT ON COLUMN public.event_vendors.food_allowance_php IS
  'Food / crew-meal allowance line (pesos) for this vendor booking. NULL = ₱0. Summed with total_cost_php + transport_php for the couple-facing total. Iteration 0006/0007.';
