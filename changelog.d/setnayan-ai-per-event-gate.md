## 2026-07-02 · feat(setnayan-ai): per-event 28-day window stamping + window-aware gate (inert)

Completes the per-event ₱499/₱799 engine (owner 2026-07-02) — behind the same default-OFF
`setnayan_ai_per_event_pricing_enabled` flag, so live behaviour is unchanged.

- `lib/setnayan-ai.ts` — new pure `eventOwnsSetnayanAi(event, { perEventPricingEnabled, now })`:
  under per-event pricing an event owns AI only while its 28-day window
  (`setnayan_ai_active_until`) is unexpired; a NULL window is a grandfathered permanent unlock
  (pre-per-event buyers). `isSetnayanAiActiveForUser` + `shouldOfferSetnayanAiPurchaseForUser`
  restructured to use it — **byte-identical when the flag is off** (proved: 5 new tests + the
  existing 12 gate tests still green), and when on the window lapses AI and re-offers the ₱799
  renewal CTA.
- `lib/sku-activation.ts` (`SETNAYAN_AI` hook) — when the flag is on, stamps
  `setnayan_ai_active_until` (28-day window, stacking from the later of now / current expiry),
  idempotently (a `service_activated` ledger guard mirrors the SUB hook, so a re-approval never
  re-extends).

Engine now complete + tested + inert: pricing helper (#2629) → schema (#2630) → charge +
intro-tracking → window stamping + window-aware gate. Remaining for go-live (owner-coordinated,
gated on the Wave-1 guard): thread `perEventPricingEnabled` + `setnayan_ai_active_until` through
the 6 gate-consuming surfaces, the public "₱499 first 28 days, then ₱799" copy, and the flag flip.

SPEC IMPACT: None new — per-event pricing already recorded (DECISION_LOG 2026-07-02). Inert
behind the default-OFF flag.
