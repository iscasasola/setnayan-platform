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

### 3 — the duplicate-transfer check no longer reads an unbounded subset

`classifyDuplicate`'s priors came from a query with **no `.limit()` and no `.range()`**. PostgREST
caps rows server-side, so past that cap it returned an arbitrary SUBSET — silently, no error, no
flag. A money guard that reads a subset passes on the duplicate it never loaded, in the reassuring
shape of "no duplicates found". Same family as the enum bug the surrounding comment records: the
read was wrong and the failure looked like a clean answer.

⚠ **The cap is Supabase platform configuration — not in this repo, not in the database, and NOT
measured.** Nothing in the fix depends on its value; that is the design constraint.

Two reads now, because the two verdicts have different reach:
- **Same order** — the only source of the blocking `refuse` verdict. Bounded by the payments on one
  bill.
- **Cross order** — the `warn` verdict, which must survive the BDO rail where the bank wraps our code
  in theirs. `compareReferences` catches that by NORMALISING both sides and SQL cannot, because the
  normalisation strips the characters an `ilike` would match on. So it is **paged exhaustively**,
  ordered by `payment_id`.

New `lib/payment-priors-scan.ts` holds the paging, because `approvePayment` is `'use server'` and
the paging is the part that can be got wrong. A failed page is a FAILURE, never a short answer; a
page ceiling exists as a hang-stop and **hitting it fails closed** rather than returning a partial
read wearing the shape of a complete one.

Guard `payment-priors-scan.test.ts` — 6 executing tests, 6 sabotages confirmed red (including the
off-by-one that stops on a full last page, and the ceiling returning partial rows).

SPEC IMPACT: None.

### 6 — DROPPED, because the brief's premise does not survive measurement

The brief asked to split `if (!args.flagEnabled || !args.verified)` in `lib/booking-fee-lock.ts` so
that "unverified-and-import is charged". **Not built. Two measurements, either one fatal:**

1. **`decideLockFee` has no caller in production.** Every reference outside its own definition is a
   test file. Its docblock calls it "the single source of truth mirrored by the SQL RPC", but the
   mirror is what runs — the decision is made in `booking_fee_open_lock_charge`. Editing that arm
   would change no behaviour and would read, to the next person, as though it had.
   Re-measure: `git grep -n "decideLockFee" -- apps/web | grep -v "\.test\."`
2. **"Verified" in the SQL that actually decides does not mean the badge.** The gate is
   `IF v_ev.vpid IS NULL THEN skipped:'not_verified_vendor'`, and `vpid` is
   `event_vendors.marketplace_vendor_id`. Its own comment: *"Off-platform / manual vendors
   (marketplace_vendor_id IS NULL) are NEVER billed."* So the population that goes unbilled is
   **manual, host-added suppliers with no shop and no account to bill** — not badge-less shops. A
   shop with a profile but no badge already IS billable.

🔑 **And the prescription contradicts a shipped promise.** `booking_fee_ledger.attribution`'s own
comment reads *"import → fee always 0 (free forever)"*, the status vocabulary carries
`waived_import` for exactly that, and `/vendors` tells suppliers in public: *"Your imported and
repeat clients stay free, forever."* Charging import bookings is a pricing change, not a bug fix.

Unbilled manual suppliers are the same population as the three `deposit_paid` rows in CTRL-B2's
build 7, and the "billed into a void" half is already handled by `unbilled-fee-repair` (`no_payer`).

**For the owner:** if badge-less shops should be billable, they already are; if manual suppliers
should be, that needs an account to bill and is a product decision, not this build.

### 8 — NOT ATTEMPTED (dropped from the end, for budget, not for doubt)

The send-sourced `proposal_id → ON DELETE CASCADE` is still live and still real. It was not started.
⚠ **It is bigger than the brief suggests:** `booking_fee_charges_anchor_ck` requires
`proposal_id IS NOT NULL OR event_vendor_id IS NOT NULL`, and a send-sourced charge has no
`event_vendor_id` — so flipping the FK to `SET NULL` makes the preserve write **violate the anchor
CHECK**. The migration has to give that charge another anchor, or widen the constraint, before the
FK can change. Whoever takes it should read `20271153200818_the_money_outlives_the_event.sql` first.
