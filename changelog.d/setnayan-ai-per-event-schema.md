## 2026-07-02 · feat(setnayan-ai): per-event ₱499-intro / ₱799-renewal schema (migration · inert)

Migration `20270501000000_setnayan_ai_per_event_pricing.sql` — the schema foundation for the
owner-locked (2026-07-02) per-event pricing: every event's first 28-day cycle is the **₱499
intro** (a default), every 28-day cycle after is **₱799**. All additive, idempotent, and
dormant — live behaviour is unchanged.

Adds:
- `events.setnayan_ai_active_until` — the per-event 28-day subscription window (nullable; lazy
  expiry, cron-free; mirrors `user_ai_subscription.active_until`).
- `events.setnayan_ai_intro_used` — whether an event has consumed its ₱499 first cycle (drives
  intro-vs-renewal pricing). Back-filled TRUE for events that already own AI, so their next
  purchase is a ₱799 renewal, not a second ₱499 intro.
- `SETNAYAN_AI_RENEW` catalog row (₱799, `per_28d`, seeded `is_active=false` / dormant) — the
  admin-managed renewal price the pricing helper reads (never hardcoded).
- `platform_settings.setnayan_ai_per_event_pricing_enabled` — the tri-state enabling flag
  (default NULL=OFF), mirroring `setnayan_ai_per_user_enabled`.

Buy-flow wiring, the intro/renewal charge, the window-lapse re-offer, and the public "₱499
first 28 days, then ₱799" copy land in later PRs — where the ₱799 step-up is gated on the
Wave-1 market-intelligence guard being live. Pairs with the pure pricing helper in
`lib/setnayan-ai-pricing.ts` (PR #2629).

SPEC IMPACT: Recorded. Per-event Setnayan AI pricing (₱499 first 28-day cycle → ₱799/28-day
cycle after) — corpus + decision log already updated directly (DECISION_LOG 2026-07-02).
Needs `supabase db push` to apply to prod (additive + dormant → safe to apply anytime before
go-live).
