## 2026-08-21 · fix(db): the money outlives the event

Slice 4 of *"vendors get to keep it"* — plus a **bug fix for a defect slice 2
introduced**, which is the urgent half.

### 🚨 A · Slice 2 could make an event undeletable

Slice 2's trigger `UPDATE`s `event_vendors.event_id` to NULL.
`event_vendor_payments` carries a **composite** foreign key —
`(event_id, vendor_id) REFERENCES event_vendors(event_id, vendor_id)` — with **no
`ON UPDATE` clause**, so it defaults to `NO ACTION`. The moment a supplier
recorded a payment against a booked marketplace job, that UPDATE was refused,
and because it runs inside a `BEFORE DELETE` trigger it took the whole deletion
with it:

```
update or delete on table "event_vendors" violates foreign key constraint
"event_vendor_payments_event_vendor_fk" on table "event_vendor_payments"
```

**Not a silent wrong answer — the couple could never delete their celebration
again.** Proved in the replay before writing the fix, and now pinned by a
regression test.

🔑 **The lesson, written into the classification doc:** a composite FK turns
"preserve the parent" into an **UPDATE of a referenced column**, and an FK's
`ON DELETE` rule says nothing about UPDATEs. Every later slice that nulls a
referenced column must check for children whose key spans it.

Latent today by arithmetic: prod holds 3 payments and **0** sit on a
marketplace-linked booking.

### B · The supplier keeps the receipt, not the bank details

`amount_php`, `paid_at`, `schedule_instance_seq` and `vendor_confirmed_at` are
the supplier's record of money received and survive. `method`, `reference`,
`notes` and `proof_r2_key` are scrubbed — the couple's own rail, their transfer
reference, their private note and **a photograph of their bank screen**. Keeping
those would hand a supplier the couple's banking trail under cover of the
ruling, which is the harm it excludes.

A payment the supplier **never confirmed** leaves with the celebration: that is
the couple's claim to have paid, not the supplier's record of being paid.

### C · Money Setnayan is owed no longer leaves with the couple

`booking_fee_ledger` and `booking_fee_charges` are what a **supplier owes
Setnayan**. The couple is not a party to that debt, yet both cascaded — so a
couple pressing delete quietly erased revenue. `/admin/booking-fees` is the only
screen that lists it. Prod holds 0 today.

⚠ **Half a win, named rather than hidden:** `booking_fee_charges_anchor_ck`
requires `proposal_id` or `event_vendor_id`, and both still cascade. A charge
anchored on `event_vendor_id` now survives (slice 2 preserves booked rows); one
anchored on `proposal_id` (`source='send'`) still dies with `vendor_proposals`.
That is its own slice.

### Implementation note

Extends slice 2's trigger rather than adding a third to `events`. **Ordering is
the reason, not tidiness:** `BEFORE DELETE` triggers fire in name order, and the
new `ON UPDATE CASCADE` nulls the payment's `event_id` the instant slice 2's
UPDATE runs — a separate trigger sorting after it would be hunting rows by an
`event_id` that is already NULL. One statement removes the question.

### Mutations — each fails exactly its own tests

| | | |
|---|---|---|
| **M64** drop `ON UPDATE CASCADE` (2 → 1) | RED ×3 | reproduces the bug, incl. the regression test |
| **M65** stop scrubbing (1 → 0) | RED | *not the couple's bank rail* |
| **M66** keep unconfirmed payments (1 → 0) | RED | *an unconfirmed claim leaves* |
| **M67** fees back to `CASCADE` (2 → 0) | RED | *money the supplier owes Setnayan* |

**1348 db pass · 9174 unit pass · 0 fail** · typecheck clean · migration guard
clean (1158). Exposure baseline unchanged — no new columns, and nullability is
not part of that surface.

SPEC IMPACT: None — implements the ruling in `DECISION_LOG.md` 2026-08-21.
