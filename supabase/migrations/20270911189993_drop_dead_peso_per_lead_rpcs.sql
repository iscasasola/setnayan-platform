-- Drop the now-dead Peso-Per-Lead reporting RPCs.
--
-- These two SECURITY-DEFINER reporting functions (added 20270322391018) computed
-- a vendor's / the platform's cost-per-lead from `tokens_burned_total` — the
-- token burn a vendor paid to ANSWER an inquiry. Migration 20270909586177
-- (2026-07-22) neutralised that burn (answering is now FREE), so both RPCs now
-- only ever return ₱0 token spend. Their sole app callers — the vendor
-- self-scorecard card and the admin Peso-Per-Lead card (lib/vendor-peso.ts) —
-- were removed in the same PR, leaving these functions unreferenced. Drop them.
--
-- No dependents: nothing else PERFORMs/SELECTs these; they were only reached via
-- supabase.rpc() from the deleted lib/vendor-peso.ts. Idempotent (IF EXISTS).

DROP FUNCTION IF EXISTS public.admin_peso_per_lead_overview(INT);
DROP FUNCTION IF EXISTS public.vendor_peso_per_lead(UUID, INT);
