## 2026-09-20 · feat(self-added-suppliers): the service card — every category, and payment notes that stay notes

Follows `manual-venue-needs-an-address` (#5777). Same subject: a supplier the
couple added themselves.

**Payment method + payment terms, as NOTES.** Owner: *"payment method and
payment option can be entered manually. but this is just manual, so nothing is
searched added. meaning no connection to the user's event. it needs to be
imported to a vendor first"*, then *"payment options doesn't need to be a qr.
just a note so the user can rely on the payment method."* Two nullable TEXT
columns on `event_manual_vendors` (not-blank CHECK), free text, no QR upload,
no structure.

The two obvious homes were both wrong, and the second quote is what ruled them
out. `vendor_payment_methods` is keyed on `vendor_profile_id`, which a
self-added supplier hasn't got. `event_vendor_payment_plan` was the tempting
one — host-writable, per-booking — and it **is** the event's money: it drives
the Payments schedule and what the couple is shown as owed. Writing a memo
there would turn a note into an obligation. `the-payment-note-is-inert.test.ts`
fails CI if any file that queries the real money tables ever learns to read a
note, because the card's copy — *"Setnayan does not send or track this money"* —
is a promise about the whole codebase, not one component.

**"What services does this cover" — every category, including their own.**
Owner: *"so they can pick all categories"* · *"combine categories they picked."*
`coverOptions` used to `filter((g) => g.id !== ownGroupId)`. Logically
defensible — the own group is covered by construction — but what the couple SAW
was a list of everything except the one thing they knew this supplier does,
which reads as an omission. The own category now renders present, on, and
un-togglable. It is deliberately **not persisted**: `bucketForVendor` reads
`covers_plan_groups[0]` as the money bucket, so writing it in would move which
bucket existing bookings land in for no gain. The chip states the fact; the
column keeps meaning "ALSO covers".

**The card now reaches every self-added supplier, and can create its own row.**
`saveSelfAddedServiceCard` replaces the address-only action from #5777, which
refused with *"remove and re-add them"* when a booking had no
`event_manual_vendors` row. That is a real state — two production rows with
`source = 'host_manual'` are in it — and telling a couple to delete a booking
to record its address is not a fix. It upserts instead, creating and linking
the row, with the row count checked on both writes (a zero-row UPDATE returns
no error, so an RLS refusal would otherwise read as a save).

**A correction to a number this codebase repeats.** `supplier-invite-eligibility.ts`
cites *"43 of 45 off-platform rows carry BOTH ids NULL"*, which reads as "a
contact card is unreachable for almost every self-added supplier". Re-measured
2026-09-20 grouped by creation instant: **41 of the 43 are seed fixtures**
(three identical timestamps, `source` NULL). Among rows a couple actually
created it is 2 with and 2 without, and both added through today's modal have
one. The 2026-09-03 ruling it was cited for is still right — an invite must not
depend on a contact card — but the figure is not evidence about real couples.
The measurement and its re-run query are recorded in the migration header.

**Guard note:** the inertness guard convicted its own author on first run — the
save action's docblock *mentions* `event_vendor_payment_plan` to explain why it
does not write there. Rewritten to ask whether a file `.from()`s the table,
which no comment can trip.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — extends
the 2026-09-20 self-added-supplier row with (d) payment method and terms are
couple-authored free-text notes with no connection to the event's payment
machinery, superseded on screen once the supplier claims an account; (e) the
covers picker lists every category including the booking's own, shown locked;
(f) the 43/45 correction.
