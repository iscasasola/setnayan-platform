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

### P0b · the notices that were never emitted (same branch)

- **A booking request that lapses at the supplier's late press tells the couple.**
  `vendor_agree_to_lock` and `vendor_decline_lock` close a request past its 48
  hours themselves and answer `expired`; only `ok` was notified, and the sweep
  selects `pending` only. The "did not answer" notice now lives once in
  `lib/lock-request-notices.server.ts` and all three doors send it. It cannot
  send twice — each door reports a row only when it is the transaction that
  moved it — and `tests/db/lock-handshake-wiring.db.test.ts` runs all three.
- **✕ Remove on a card with a pending booking request tells the supplier**, with
  the same notice Withdraw sends.
- **Corrected, not fixed:** the comment in `finalizeVendor` that said the payment
  plan and its notice "run from vendorAgreeToLock". They do not; with the
  handshake on, a booking the supplier agrees to has no frozen plan. The plan
  write is a money path left for the owner. The couple is told the yes today.
- **Stopped — each needs a `notification_type` enum value, no migration written.**
  The SQL sits in a comment at each site: a quote accepted or declined
  (`respondToProposal`); a supplier removed while only a conversation is open
  (`deleteVendor`); the four change-order notices that ride `schedule_suggestion`
  (`lib/couple-supplier-notices.ts`).

### P0c · the four types, the plan at the yes, the 48-hour reminder (same branch)

- **Migration** `supabase/migrations/20271267016300_notification_types_quote_answer_and_change_order.sql`
  adds `quote_accepted`, `quote_declined`, `change_order_proposed`,
  `change_order_answered` to `public.notification_type` — bare `ADD VALUE IF NOT
  EXISTS`, alone in its file. It reaches production through the pipeline only.
- **A supplier is told when a couple accepts or declines their quote** — in the
  app and by email, from `respondToProposal`, once (the function refuses a
  second press). The yes uses the customer card's own sentence and never says
  the supplier is booked.
- **A change order has its own notices, emailed**, with the figure read back off
  `vendor_change_orders.delta_amount_php` and passed through `formatPhp`. The
  four change-order sites left `schedule_suggestion`; its other six sites are
  untouched.
- **The payment plan is frozen at the supplier's yes.** Under the lock handshake
  the couple's press only asks, and the plan snapshot and "your payment info is
  ready" lived below that return — so a booking made the normal way had no plan
  row. `lib/booking-payment-plan.server.ts` is `finalizeVendor`'s block moved
  whole; the direct lock and `vendorAgreeToLock` (on `ok`) both call it. Same
  reads, same computation; the plan is dated from the yes; the host who pressed
  the ask is told. A package booking is left alone (its own direct path writes
  no plan), and an ask with no recorded asker gets its plan and no notice.
  Proven on the replayed schema by
  `tests/db/the-plan-is-frozen-at-the-suppliers-yes.db.test.ts`.
- **One reminder email to a supplier whose inquiry has waited 48 hours**, from a
  traffic-driven daily sweep (`inquiry-reminder`), once per inquiry.
  `GHOST_THRESHOLD_HOURS` is now defined once and shared with the in-app nudge.

SPEC IMPACT: Iteration 0028 (notifications) — thirteen notification types gain
the email channel (four of them new enum values), couple ↔ supplier emails gain
"Event · Date" rows, and one periodic job (`inquiry-reminder`) is added. The
payment plan of a handshake booking is now written at the supplier's yes. NOT
applied to the corpus from this branch (local-only, no push); the controller is
making the corpus edit.
