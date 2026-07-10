## 2026-07-10 · fix(setnayan-ai): ₱499 is now a true one-time permanent unlock (per-event pricing OFF)

Fixes a bug the 2026-07-10 pricing finalization introduced. The prod flag `setnayan_ai_per_event_pricing_enabled` was still TRUE, so buying the AI stamped a **28-day lapsing window** (`events.setnayan_ai_active_until`) and expected a ₱799 renewal — but that PR set `billing_period=one_time` and deactivated the ₱799 `SETNAYAN_AI_RENEW` SKU. Result: a ₱499 purchase would lapse in 28 days with **no way to renew**.

- Migration `20270714262264` (applied to prod) sets `setnayan_ai_per_event_pricing_enabled = false` → no window is stamped → `eventOwnsSetnayanAi` returns a **permanent** unlock, matching the "₱499 one-time, access until the wedding" intent. Also NULLs any already-windowed active-AI events (0 today).
- `setnayan_ai_paywall_enabled` stays TRUE — the AI remains a paid-gated feature (and the watch-guard fires only for paying couples). No code change; the activation hook already handles both flag states.

Verified in prod: paywall=true, per_event_pricing=false.

SPEC IMPACT: Reinforces DECISION_LOG 2026-07-10 (AI = ₱499 one-time, per-event).
