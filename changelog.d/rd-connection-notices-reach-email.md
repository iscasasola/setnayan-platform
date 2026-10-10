## 2026-10-10 · fix(notifications): the notices that carry a couple ↔ supplier booking reach the other party by email

Owner, 2026-10-10: "what we are building is the connection of the supplier and
user on their events". A read-only map of every round trip between a couple and
a supplier found that the notices which open or move a booking were a tray badge
only — a supplier who was not looking at the app heard nothing.

**Now emailed (eight types added to `EMAIL_ENABLED_TYPES`, each with its own reason line):**

- `vendor_inquiry_received` → the supplier. The first ask. It was push only; a
  comment in `lib/chat-actions.ts` said it emailed and it did not.
- `inquiry_declined` → the couple, who is waiting on that supplier.
- `booking_cancelled` → the supplier. This one WAS a direct email and lost it
  when it was moved onto `emitNotification` with no allowlist line.
- `payment_logged` → the supplier: money was sent and waits for them to confirm.
- `vendor_payment_asked` → the couple: the one notice that says an amount is owed.
- `pax_surcharge_changed` → the couple: the total they owe changed.
- `vendor_joined` → the couple: the supplier they added by hand is on Setnayan.
- `review_request` → the couple: the service was marked delivered.

**Every couple ↔ supplier email now says which event and when.** Under its one
sentence the email carries "Event · <name>" and "Date · <date>" (a month-only
date stays a month; no date reads "Not set yet"). The first inquiry carries the
date and never the name — it is pre-accept, and its title already drops the name
on purpose. Supplier-side notices now hand the event to the emitter
(`eventId`), because a `/vendor-dashboard/…` link carries none. The words are
the in-app notice's own; the button is the in-app notice's own link.

**An email that was not sent no longer looks like one that was.**
`emitNotification` used to skip the whole email block when Resend was not
configured, writing nothing anywhere. The gate is now the type alone, so
`sendEmail` records `not_configured` in `email_deliveries` (the log `/admin`
reads). The three other exits without a send — recipient unreadable, recipient
has no address, the build threw — each write a `send_failed` row saying why. The
action the notice follows is never blocked.

**One declaration, one guard.** `lib/couple-supplier-notices.ts` lists every
notice type that carries a couple ↔ supplier connection, who it is written to,
whether it must reach them by email or is deliberately a tray badge, and one
line of reason each. `lib/couple-supplier-notices-reach-email.test.ts` fails if
an emailed type drops off the allowlist, lands in the marketing-gated set or
loses its reason line; if an app-only type is emailed anyway; if a notice type
is emitted from a couple ↔ supplier file without being declared; if a notice's
button points at a page that does not exist or at the wrong side of the app; or
if a supplier-side email cannot name its event.

Three amounts that now appear in email (`payment_logged` from Budget,
`vendor_payment_asked`, `pax_surcharge_changed`) go through `formatPhp` instead
of an inline `toLocaleString`, so a centavo-bearing figure reads `₱837.50`, not
`₱837.5`.

**A request that reached nobody on two-host events.** `vendorMarkServiceComplete`
read the couple with `.maybeSingle()`, which errors on two rows — so an event
with both partners on it got no "confirm you received everything" notice at all.
It now tells every couple member.

False comments corrected: `lib/chat-actions.ts` (the inquiry "email"),
`app/dashboard/[eventId]/vendors/actions.ts` (the review request's "Resend
email"; the cancelled booking's "dual-channel"), `lib/vendor-invite-actions.ts`
("in-app/push" — it was never a push), `lib/notification-emit.ts`
(`payment_logged` "in-app/push register").

Not built, listed for the owner: notices the app does not emit at all (a quote
accepted or declined; a booking request that lapses at the supplier's late
press; a supplier who claims a link without adding a service; a supplier who
declines the claim link; a single supplier removed from a shortlist).
`schedule_suggestion` stays a tray badge — one type carries six things,
including change orders that move money, and splitting it is an owner decision.

No migration: every type already exists in the `notification_type` enum.

SPEC IMPACT: Iteration 0028 (notifications) — eight notification types gain the
email channel, and couple ↔ supplier emails gain "Event · Date" rows. NOT applied
to the corpus from this branch: the job was local-only (no push), and a corpus
edit must be pushed. For the controller to apply.
