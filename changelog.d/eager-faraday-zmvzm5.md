## 2026-11-05 · feat(admin-payments): a paid service they cannot use becomes Papic credits, or moves to their next event

Owner 2026-11-05, *"yes to refund"* (DECISION_LOG "THE 15 'ACT FIRST' ITEMS … RULED ONE BY ONE", item 1). Builds what the
public `/refunds` page already promises: an unusable service "becomes Papic credits for your event", and an unused one
"can wait for your next event". Earlier rows: 2026-10-08 "NO REFUNDS — … CONVERTED TO PAPIC", 2026-10-08 "MOVE AN UNUSED
SERVICE TO THE USER'S NEXT EVENT (job 22)", 2026-10-22 "NO REFUNDS STANDS".

- **Admin › Payments, on every paid order row, above the existing refund tool:** "Convert to Papic credits" and "Move to
  their next event". Both post to the existing `refundOrder` export with an `intent` (the server-action budget is at its
  ceiling, 1227/1227). Neither moves money.
- **Convert:** the admin types the credit count — **no rate is ruled** (2026-10-22: "worth what you paid", no rate stated),
  so none is computed. Beside the box: what they paid (sum of matched payments) and the live Papic packs read from
  `platform_retail_catalog_v2` × `papic_pass_tiers` (`fetchGiftLadder`). A typo bound refuses more credits than the payment
  buys at the cheapest per-credit pack. The credits land as one `papic_event_point_grants` row (shared pot, source
  `admin`, order_id = the order), so a later refund takes them back through the existing reversal.
- **Move:** only to the buyer's NEXT event created (job 22: the pre-picked, only choice), only an event they host;
  no next event → "waits for their next event", no button. Refused: a converted order, a supplier's own bill, Papic camera
  credits, a used event pot, Concierge (its set-up lives on the event row). A Papic pack's shared-pot credits move with
  it; the order is re-activated on the new event and Setnayan AI's stored flag is re-derived on the old one.
- **Ledgered and idempotent:** migration `20271309226989` adds `order_service_remedies` (one row per action: who, why,
  from, to, credits, paid snapshot; RLS on, service-role only) and two SQL functions that do each action in one
  transaction under a row lock — a double click applies once. Plus an `admin_audit_log` row.
- **The couple is told in the app** — two new notice types `service_became_credits` · `service_moved_to_event`
  (migration `20271309539718`), not on the email allowlist.
- Tests: `tests/db/a-service-they-cannot-use-becomes-credits-or-moves.db.test.ts` (11, incl. double submit for both and a
  move to an event the person does not own → refused) and `lib/admin/service-remedies.test.ts` (9).

SPEC IMPACT: None — builds rulings already in DECISION_LOG. Open for the owner (not guessed): the pesos → credits rule;
whether a converted service should also be switched off on the event.
