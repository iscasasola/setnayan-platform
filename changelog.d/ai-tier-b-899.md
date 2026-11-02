## 2026-07-26 · chore(pricing): Setnayan AI tier B ₱999 → ₱899

Owner 2026-07-26: *"Setnayan AI has a payment per event. from free, 99, 199, 499, 899, 1499"* → then **"follow the 5"** / five levels, dropping ₱199.

Locked ladder is now **₱1,499 · ₱899 · ₱499 · ₱99 · free**. Only tier B moves; the
event-type → tier assignment is UNCHANGED, so the SEC-5 DB↔TS parity test
(`setnayan_ai_price_tier` mirroring `AI_TIER_BY_EVENT_TYPE`) is unaffected — that
function maps type→tier, never tier→price.

- `platform_retail_catalog_v2.SETNAYAN_AI_B` → `899.00` (the authoritative price;
  applied directly, as the catalog is admin-managed by design at `/admin/pricing`)
- `AI_TIER_FALLBACK_PHP.B` → `899` (last-resort only, used when the catalog is
  unreadable — it must not disagree with the catalog)
- the ladder-pinning test updated to the new lock rather than relaxed
- stale ₱999 copy corrected in the type-pricing header, the `gala_night` note,
  `setnayan-ai-event-pricing.ts` and the studio page

**Not flipped here:** `platform_settings.setnayan_ai_per_event_pricing_enabled`
is still `false`, so every event type is still charged the flat ₱1,499
`SETNAYAN_AI`. Turning per-event pricing ON is a separate owner action.

It is now SAFE to flip — verified live in prod that all four SEC-5 protections
exist: `events.setnayan_ai_tier_at_purchase`, `trg_stamp_events_ai_tier_at_purchase`,
`trg_guard_events_ai_price_tier`, and `public.setnayan_ai_price_tier()`. Flipping
also RESOLVES the known display/charge mismatch (the studio page renders the
per-type price ungated while checkout's per-type branch is flag-gated, so a `date`
event is shown ₱99 and charged ₱1,499).

SPEC IMPACT: pricing ladder — logged in `DECISION_LOG.md`.
