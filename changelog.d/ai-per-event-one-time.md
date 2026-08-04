## 2026-07-26 · fix(pricing): Setnayan AI is ONE-TIME per event — remove the 28-day window

Owner 2026-07-26: *"this is per event. no time duration. just one time payment per event."*

`SETNAYAN_AI`'s activation hook used to do two things behind
`setnayan_ai_per_event_pricing_enabled`: set `setnayan_ai_intro_used = true` and stamp a
28-day `setnayan_ai_active_until` via `extendUserAiSubscription(…, 1, …)`, so "this event's
NEXT purchase is a ₱799 renewal".

That belonged to a **retired** intro/renewal model. `SETNAYAN_AI_RENEW` is `is_active=false`
and its resolver `resolveSetnayanAiEventChargeCentavos` has **no callers** — the live charge
path is the event-TYPE ladder (`resolveSetnayanAiTypeChargeCentavos`, reached from
`order-charge-authority.ts:140`). So the stamp bought nothing and cost everything:
`eventOwnsSetnayanAi` treats a non-NULL window as **authoritative**, so a couple would pay
once and lose AI 28 days later with no way to renew.

That is why PR #3035 (migration `20270714262264`) turned the flag **off** rather than fixing
it — and that switched off the per-event **price ladder** too, because one flag gated both.

**Removing the stamp decouples them.** The flag now means only *"price by event type"*.
A paid Setnayan AI is a permanent unlock: `setnayan_ai_active = true`, nothing else.

Also dropped: the `order_ledger` idempotency probe (it existed only to stop a second approval
adding another 28 days — the remaining write is a plain idempotent boolean set) and the
now-unused `resolveSetnayanAiPerEventPricingEnabled` import.

**Nothing to migrate** — verified in prod: 0 events carry a window, 0 have `intro_used`, and
`setnayan_ai_active` is false on both. Rows with a NULL window already read as permanent.

### ⏭ The flag is now safe to flip, and flipping is a separate owner action

`platform_settings.setnayan_ai_per_event_pricing_enabled` is still `false`, so **every event
type is charged the flat ₱1,499 today**. Turning it on activates the owner's ladder —
**₱1,499 wedding · ₱899 debut/corporate/gala · ₱499 standard · ₱99 light · free simple_event** —
and also resolves the known display/charge mismatch, where the studio page renders the
per-type price ungated while checkout's per-type branch is flag-gated (a `date` event is
currently **shown ₱99 and charged ₱1,499**).

Re-pricing by editing `event_type` is already closed by SEC-5 (`20271007917549`): verified live
that `events.setnayan_ai_tier_at_purchase`, both triggers and `public.setnayan_ai_price_tier()`
all exist.

⚠ Unrelated and untouched: the **Vendor AI Chatbot** (`vendor_billing_catalog.vendor_ai_addon`
₱1,500 / `vendor_ai_addon_advanced` ₱3,000) is a different product on a different table.

SPEC IMPACT: Setnayan AI entitlement model — logged in `DECISION_LOG.md`.
