-- Align the Setnayan AI runtime with the finalized ₱499 ONE-TIME model (owner
-- 2026-07-10 pricing finalization). The prod per-event-pricing flag was still ON,
-- which stamped a 28-day LAPSING window on purchase and expected a ₱799 renewal —
-- but the pricing PR set billing_period=one_time AND deactivated the ₱799 renewal
-- SKU. Net effect (bug): a ₱499 purchase would lapse in 28 days with no way to
-- renew. Turn per-event pricing OFF → no window is stamped → eventOwnsSetnayanAi
-- returns a PERMANENT unlock, matching the one-time / wedding-anchored intent.
-- (paywall_enabled stays TRUE — the AI is still a paid-gated feature.) Applied to prod via MCP.
UPDATE platform_settings SET setnayan_ai_per_event_pricing_enabled = false;

-- Defensive: free any already-windowed active-AI events to permanent (0 today,
-- idempotent + future-proof).
UPDATE events SET setnayan_ai_active_until = NULL
WHERE setnayan_ai_active = true AND setnayan_ai_active_until IS NOT NULL;
