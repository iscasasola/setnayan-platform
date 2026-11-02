## 2026-07-10 · fix(orders): query `awaiting_payment`, not the non-existent `pending_payment` enum value

Two server queries filtered the `orders` table on `.eq('status', 'pending_payment')`,
but `pending_payment` is not a member of the `order_status` enum (draft · submitted ·
awaiting_payment · paid · fulfilled · cancelled · refunded — see
`20260513150000_iteration_0034_payments.sql`; that value belongs to the vendor
token/subscription tables). Postgres threw `22P02 invalid input value for enum
order_status`, and both call sites are wrapped in graceful-degrade try/catch, so the
bug was silent — the queries always returned empty.

- `app/dashboard/[eventId]/_components/event-dashboard.tsx` — the couple event
  dashboard's "Settle a payment" decision group and the `pendingPaymentCount` fed into
  `buildProgressStages` were always 0, so a couple with unpaid orders never saw the
  prompt to pay.
- `lib/setnayan-ai-snapshot.ts` — the AI snapshot's "pending" budget bucket (money
  already at checkout) was silently always ₱0.

Both now filter `awaiting_payment` (the couple-facing "needs to be paid" state, per
`lib/orders.ts` `OrderStatus`). Swept all `orders`-table call sites: the other
`pending_payment` references in the codebase are on different tables
(`papic_limited_snapshots`, `custom_plan_requests`, `vendor_token_purchases`,
`vendor_subscriptions`) where the value is valid. Typecheck clean.

SPEC IMPACT: None (bug fix — restores behavior the spec already intends; no schema,
SKU, or locked decision changed).
