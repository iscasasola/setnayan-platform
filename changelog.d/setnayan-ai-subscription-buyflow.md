## 2026-06-29 · feat(setnayan-ai): per-user subscription buy→entitlement engine (₱499/28d, dormant SKU)

The purchase→entitlement spine for the per-user Setnayan AI subscription (price
owner-set 2026-06-29: ₱499 per 28-day cycle). Turns a paid term-pass order into
an extended `user_ai_subscription` window. Builds on the inert foundation (PR
#2407). The cycle-picker buy UI is the next PR; this is the engine underneath it.

- **Migration `20270321516052`** — seeds the `SETNAYAN_AI_SUB` term-pass SKU
  (₱499) into `platform_retail_catalog_v2`, seeded **is_active = false** (dormant;
  must not surface on any pricing/buy surface until go-live — owner flips it from
  /admin/pricing). Idempotent upsert; price stays the single admin source.
- **`lib/setnayan-ai-subscription.ts`** (new, pure) — `cyclesFromAmount(amount,
  unit)` (paid amount ÷ admin unit price, min 1) + `extendUserAiSubscription(
  current, cycles, now)` (extends from the LATER of now / a still-active expiry,
  so early re-ups stack and lapsed ones start fresh). No I/O, `now` injected.
- **`lib/sku-activation.ts`** — new `SETNAYAN_AI_SUB` activation hook: on a
  confirmed term-pass order it reads the buyer + paid amount + admin unit price,
  computes cycles, and extends the buyer's `user_ai_subscription` window (fanning
  AI out to all their events). **Idempotent two ways** (a prior `service_activated`
  ledger row for the order, OR the window already carrying this order as
  `last_order_id`) so a re-approval never double-grants. Non-fatal per the
  dispatcher contract; appends a `service_activated` ledger row.
- **Tests** — `setnayan-ai-subscription.test.ts` (8 cases): cycle math + the
  extend/stack/lapse rules. typecheck + lint + entitlement-gate lint clean.

Still INERT end-to-end: the SKU is inactive, no buy UI references it yet, and the
per-user gate (`setnayan_ai_per_user_enabled`) is off, so a granted window does
nothing live. Go-live needs: the buy UI (next PR), flipping the SKU active, and
the per-user flag — all gated on the owner's pricing reconciliation.

SPEC IMPACT: None to the live product — dormant SKU + inert grant engine. Price
recorded in corpus DECISION_LOG + Setnayan_AI_Subscription_Decisions_2026-06-29.md
(owner: ₱499/28-day cycle). Public /pricing still shows the old one-time ₱3,999 AI
price — flagged there for reconciliation at the holistic pricing pass / go-live.
