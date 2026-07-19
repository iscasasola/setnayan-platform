## 2026-06-29 · feat(setnayan-ai): eventless + per-cycle checkout for the subscription term pass

Extends the ONE shared checkout action so the per-user Setnayan AI subscription
(SETNAYAN_AI_SUB · ₱499 / 28-day cycle) can actually be ordered. Surgical +
guarded: byte-identical for every other SKU; the new branch only activates for
SETNAYAN_AI_SUB. Keeps a SINGLE payment path (no forked money flow).

- **`lib/setnayan-ai-subscription.ts`** — adds `parseCycles(raw)` (validates a
  client cycle count → integer in [1, `AI_SUB_MAX_CYCLES`=24], else null) so the
  server can reject malformed input.
- **`app/dashboard/[eventId]/checkout/actions.ts` (`submitOrderAction`)** — for
  `SETNAYAN_AI_SUB` only:
  - **Eventless** — `event_id` is optional (the subscription is bound to the
    BUYER, covering all their events), so the event-membership check is skipped
    and the order lands with `event_id = null`. Every other SKU still REQUIRES a
    valid, member-owned `event_id` exactly as before.
  - **Per-cycle charge** — the catalog ₱499 is the UNIT; the charge is unit ×
    the validated `cycles` (still server-authoritative from
    platform_retail_catalog_v2 — a tampered client can't change it).
  - Eventless ripples guarded: the confirmation-email deep link falls back to
    `/dashboard`, and revalidation hits `/dashboard` (layout) instead of a
    `/dashboard/null/...` event path.
- **Tests** — `parseCycles` cases added (9 total in the sub-helper suite).
  typecheck + lint + entitlement-gate lint clean.

Pairs with the activation hook (PR #2413), which already derives cycles from
amount ÷ unit — so a confirmed term-pass order now extends the buyer's
`user_ai_subscription` window end-to-end. Still INERT: the SKU is inactive, the
per-user flag is off, and the buy-page UI (cycle picker) is the next PR.

SPEC IMPACT: None to live behavior — guarded branch behind a dormant SKU + off
flag; no schema change. Price ₱499/28d recorded in DECISION_LOG + the decisions
doc; public /pricing reconciliation still pending at the holistic pass.
