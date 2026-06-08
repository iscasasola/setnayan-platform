-- Setnayan AI — per-event paid entitlement.
--
-- The new SETNAYAN_AI SKU (₱3,999, platform_retail_catalog_v2, migration
-- 20260915000000) is a FLAT per-event purchase — no trial, no wedding-anchored
-- expiry (unlike the retired Concierge/Today's-Focus machinery on the
-- events.concierge_* columns). So the entitlement is a single boolean stamped
-- once when a paid SETNAYAN_AI order is confirmed (admin/payments/actions.ts).
--
-- Additive + safe: nullable-default-false column, no data change, no behavior
-- change. The gate (lib/setnayan-ai.ts) only consults it when the
-- SETNAYAN_AI_PAYWALL_ENABLED env flag is on — which is OFF by default, so this
-- migration is inert in production until the paywall is deliberately flipped.
--
-- Owner-locked 2026-06-08: "govern now (free), monetize next" — build behind a
-- flag.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS setnayan_ai_active boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.setnayan_ai_active IS
  'Per-event Setnayan AI entitlement (flat purchase, no expiry). Set true when a paid SETNAYAN_AI order is confirmed. Consulted by isSetnayanAiActive() only when SETNAYAN_AI_PAYWALL_ENABLED is on.';
