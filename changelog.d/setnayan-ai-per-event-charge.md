## 2026-07-02 · feat(setnayan-ai): per-event ₱499-intro / ₱799-renewal charge wiring (inert)

Slice 3 of per-event Setnayan AI pricing (owner-locked 2026-07-02: ₱499 first 28-day cycle per
event → ₱799 every cycle after). Wires the **charge + intro-tracking** behind the default-OFF
`setnayan_ai_per_event_pricing_enabled` flag — live behaviour is unchanged until flipped.

- `lib/integration-config.ts` — `resolveSetnayanAiPerEventPricingEnabled()` (DB-first, no env
  fallback, uncached; mirrors `resolveSetnayanAiPerUserEnabled`).
- `lib/setnayan-ai-event-pricing.ts` — `resolveSetnayanAiEventChargeCentavos(admin, eventId)`:
  reads the event's stored `setnayan_ai_intro_used` + both catalog prices and returns the
  intro-vs-renewal charge in centavos (via the pure helper; prices catalog-authoritative). 4
  unit tests with a fake admin client.
- `checkout/actions.ts` (`submitOrderAction`) — when the flag is on, a `SETNAYAN_AI` order's
  authoritative charge is re-resolved server-side (intro on the first cycle, renewal after), so
  a tampered client can't force the intro price on a renewal. Inert while the flag is off — the
  flat ₱499 catalog resolve stands, byte-identical.
- `sku-activation.ts` (`SETNAYAN_AI` hook) — when the flag is on, also stamps
  `setnayan_ai_intro_used=true` on activation (idempotent, re-approval-safe) so the event's next
  purchase is a ₱799 renewal.

The per-event 28-day window (`setnayan_ai_active_until`) stamping + lapse enforcement (the gate
that makes AI expire so a renewal is needed) + the public "₱499 first 28 days, then ₱799" copy
land in the next slice — where the flag is flipped, gated on the Wave-1 guard being live.

SPEC IMPACT: None new — per-event pricing already recorded (DECISION_LOG 2026-07-02;
`Pricing.md` §00.A). This PR is inert wiring behind a default-OFF flag.
