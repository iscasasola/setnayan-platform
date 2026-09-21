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
