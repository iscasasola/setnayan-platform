## 2026-11-05 · feat(admin-payments): a paid service they cannot use becomes Papic credits, or moves to their next event

Owner 2026-11-05, *"yes to refund"* (DECISION_LOG "THE 15 'ACT FIRST' ITEMS … RULED ONE BY ONE", item 1). Builds what the
public `/refunds` page already promises: an unusable service "becomes Papic credits for your event", and an unused one
"can wait for your next event". Earlier rows: 2026-10-08 "NO REFUNDS — … CONVERTED TO PAPIC", 2026-10-08 "MOVE AN UNUSED
SERVICE TO THE USER'S NEXT EVENT (job 22)", 2026-10-22 "NO REFUNDS STANDS".

- **Admin › Payments, on every paid order row, above the existing refund tool:** "Convert to Papic credits" and "Move to
  their next event". Both post to the existing `refundOrder` export with an `intent` (the server-action budget is at its
  ceiling, 1227/1227). Neither moves money.
- **Convert:** the number of credits is **computed, never typed** — owner 2026-11-05: what they paid (sum of matched
  payments) at the **best-value Papic pack on sale**, read live from `platform_retail_catalog_v2` × `papic_pass_tiers`
  by one SQL function (`orders_papic_credit_value`) that both the admin page and the conversion read. Today that is
  ₱999 = 3,000 credits. The page posts the figure it showed and the database refuses if prices moved in between.
  The credits land as one `papic_event_point_grants` row (shared pot, source `admin`, no order id). **The service is
  switched off** (owner: *"switch it off"*): the order becomes `lapsed` — the existing ended-not-refunded status every
  ownership check already honours — and Setnayan AI's stored flag is re-derived. Refused: a Papic pack (it is already
  credits), Concierge, a supplier's own bill, an unpaid or free order. One admin is enough (owner).
- **Admin › Money counts a `lapsed` order as revenue.** Only `paid` orders are ever lapsed (an ended subscription, or a
  converted service) and no money went back, so dropping them understated revenue.
- **Move:** only to the buyer's NEXT event created (job 22: the pre-picked, only choice), only an event they host;
  no next event → "waits for their next event", no button. Refused: a converted order, a supplier's own bill, Papic camera
  credits, a used event pot, Concierge (its set-up lives on the event row). A Papic pack's shared-pot credits move with
  it; the order is re-activated on the new event and Setnayan AI's stored flag is re-derived on the old one.
- **Ledgered and idempotent:** migration `20271309226989` adds `order_service_remedies` (one row per action: who, why,
  from, to, credits, paid snapshot; RLS on, service-role only) and two SQL functions that do each action in one
  transaction under a row lock — a double click applies once. Plus an `admin_audit_log` row.
- **The couple is told in the app** — two new notice types `service_became_credits` · `service_moved_to_event`
  (migration `20271309539718`), not on the email allowlist.
- Tests: `tests/db/a-service-they-cannot-use-becomes-credits-or-moves.db.test.ts` (12, incl. double submit for both and a
  move to an event the person does not own → refused) and `lib/admin/service-remedies.test.ts`.

SPEC IMPACT: Owner rulings 2026-11-05 recorded in Setnayan-specs `DECISION_LOG.md` ("A SERVICE THEY CANNOT USE — THREE
ANSWERS"): credits at the best-value pack on sale · the converted service is switched off · one admin is enough.
