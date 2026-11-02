## 2026-08-29 · fix(vendor): a shop keeps the record of money it asked for when a celebration is removed

**Found by deleting, not by reading the constraint catalogue.** `vendor_payment_asks` shipped
yesterday with `event_id … ON DELETE CASCADE`. Seeding a throwaway celebration in production and
deleting it inside a rolled-back transaction:

```
before   asks 1   bookings 1
after    asks 0   bookings 1     ← the booking survives, the ask does not
```

⚖ **That breaks the owner's own 2026-08-21 rule** — *on a shared record the vendor keeps it*, and
*the test is whether the supplier took part in it*. A shop **wrote** this ask. Losing it means a
shop keeps a booking and loses the record of what it asked to be paid for it.

**Both halves ship together**, because preserving the row alone would have been worse:

- `event_id` becomes nullable with `ON DELETE SET NULL` — the same shape the booking beside it
  already uses: the event link is released, the record is kept.
- The vendor read policy gains an **orphan arm**. 🔑 *Stored does not mean survives* — the read was
  gated on `event_id IN current_vendor_booked_event_ids()`, which a NULL event can never satisfy.
  Flipping the FK alone would have kept the row and **hidden it from the only party entitled to
  it** — worse than deleting, because it looks handled.

⛔ **The couple gets no orphan arm** — they removed the celebration, and this is the supplier's
business record, not a way to hand somebody back a fragment of what they deleted. ⛔ **And no new
write path**: the insert policy still requires a booked event, so an orphan can only ever be
*reached by a deletion*, never authored.

## ⚠ A leak I reported to myself that did not exist

The first rival-read check against production returned **1** and looked like a leak. The "rival" I
picked **is a Setnayan admin**, and `vendor_payment_asks_admin_read` admitted them —
**policies are OR-ed**, so the orphan arm was never what let them in. Re-run with a genuine
third-party shop that is not an admin: **0**. That test now asserts `is_admin() === false` first, so
it cannot pass for that reason again.

## 🪤 And one mutation came back green

Replacing the booked-event clause with `OR TRUE` left the suite passing — every existing test
measured that gate through a **rival**, who is already stopped by the ownership half. The only thing
the event clause adds is on the **owner**. A test for that case is added, and the mutation is red.

🔢 **Safe by arithmetic:** `vendor_payment_asks` holds zero rows — the table is one day old and
nothing has ever been asked. No existing row's fate changes.

🛡 **5 mutations, all measured, all RED** · the feature's own 9 db tests pass · proved against
production three ways in rolled-back transactions: the ask survives with its amount, the owning shop
can still read it, and a genuine rival cannot.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-29.
