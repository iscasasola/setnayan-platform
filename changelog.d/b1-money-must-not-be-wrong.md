## 2026-09-22 · fix(money): CTRL-B1 — money that must not be wrong

### 1 — a refunded booking fee gives the money back

`activateOrderSku` settles the charge, rolls it into `booking_fee_ledger`, grants the supplier's 5%
Papic credits and lands the couple's Setnayan gift. `deactivateOrderSku` had **no booking-fee arm at
all** — refund the order and the charge stayed `paid`, the ledger kept counting money we gave back,
and the cap could stay reached.

New `booking_fee_reverse_charge(charge_id, reason)` RPC mirrors `booking_fee_settle_charge` in the
opposite direction — `paid → pending`, roll the amount back out, un-reach the cap if only that money
reached it — atomically, because a status change landing without its ledger decrement leaves the two
disagreeing about the same peso. The TS arm also claws back
`vendor_papic_portfolio_credit_grants` by `order_id`.

⚠ **Two deliberate refusals, both surfaced rather than built:**
- The brief asked for the **free-5 ordinal to be released**. `booking_ordinal`'s own COMMENT says
  *"Immutable once set so a re-lock never shifts it."* Releasing it on refund would let a supplier
  refund their way back down the free-5 ladder — a worse defect than the one being fixed.
- No `refunded` status was invented. The CHECK has none and the original migration says why:
  *"No 'void', no 'refunded' — refund-on-walk-away resolved to NO REFUND (positioning doc
  2026-07-22)."* That ruling is about a couple walking away, not an admin un-approving a supplier's
  payment, so this reverses to `pending` — already in the vocabulary, and literally true: the bill
  is open again.

✅ **The couple's Setnayan gift already reversed** and still does — it lands in
`papic_event_point_grants` keyed on `order_id` and `reversePapicPassPoints` deletes exactly that.
The guard asserts it is reversed ONCE; a second deletion here would be a bug, not belt-and-braces.

Guard `a-refunded-fee-gives-the-money-back.test.ts`, 6 sabotages confirmed red.

SPEC IMPACT: None — no ruling made or changed. The two refusals above are flagged for the owner.

### 2 — approving a payment now has an order-status precondition

The promote was `.update({status:'paid'}).eq('order_id', …)` with **no condition on the status it was
leaving**, and the order was read without `status` in the SELECT, so it could not have checked. The
customer-side submit selected `order_id, event_id` only. A payment could be logged and approved
against a `cancelled`, `refunded` or already-`paid` order — re-running `activateOrderSku`, which
re-activates the SKU, re-schedules payouts and re-grants Papic credits and the couple's gift.

**Both doors are guarded, because a precondition on one door is not a precondition.** The decision
lives in a new pure module `lib/order-promotion-rule.ts` — both call sites are `'use server'`, so a
test cannot import them and a guard over them could only ever grep. Now the rule is EXECUTED against
every value of the live enum.

- `PROMOTABLE_ORDER_STATUSES` = `draft · submitted · awaiting_payment`. An allowlist, so a future
  enum value is refused rather than promotable by default. `lapsed` is deliberately excluded and
  named — a late payment on a lapsed order is a decision about whether the offer still stands, and
  belongs to a person.
- `PAYABLE_ORDER_STATUSES` adds `paid`: settling a balance is ordinary and `resolveEventMoney`
  reconciles an overpayment. Only CLOSED orders refuse money — **a payment against a closed order
  does not bounce, it disappears**, because nothing reads that row again.
- The admin door carries the rule **twice**: once before the write so the refusal can name the
  status, and once in the WHERE clause so two admins approving the same payment cannot both promote.
  The update now `.select()`s its rows — a zero-row UPDATE is success-shaped.

Guard `a-promote-has-a-precondition.test.ts` — 5 executing tests, 2 wiring tests, 5 sabotages
confirmed red.

SPEC IMPACT: None.
