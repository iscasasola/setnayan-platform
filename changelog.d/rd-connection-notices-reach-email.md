## 2026-10-11 · fix(notifications): the couple ↔ supplier notices are declared, the missing ones are told in the app, and no email is added

Owner, 2026-10-10: "what we are building is the connection of the supplier and
user on their events." Owner, 2026-10-11: "i thought we can manage without
emails?" — emails cost money and the direction is fewer, not more.

This branch first put twelve notice types on the email allowlist and added a
reminder email; all of that was taken back out on the same branch. **The net
effect on email is zero: the allowlist is type for type what `main` sent (52
emailed, 4 pushed, 1 marketing-gated), and `lib/the-email-allowlist-is-frozen.test.ts`
now fails if it grows or shrinks.**

**What a person now sees in the app that they did not:**

- **A quote accepted or declined → the supplier.** `respond_vendor_proposal`
  recorded the answer and told nobody. The yes uses the customer card's own
  sentence and never says the supplier is booked.
- **A change order → its own notice**, with the figure read back off
  `vendor_change_orders.delta_amount_php` through `formatPhp`. The four sites
  left `schedule_suggestion`; its other six sites are untouched.
- **"Confirm you received everything" → every couple member.** It was sent to
  nobody on an event with two hosts (`.maybeSingle()` errors on two rows).
- New enum values for the four types:
  `supabase/migrations/20271267016300_notification_types_quote_answer_and_change_order.sql`.

**Three notices that ALREADY existed (and already emailed on main) now also go
out from a door that used to stay silent** — say so plainly, because each is one
more email at that moment:

- **A booking request that lapses at the supplier's late press tells the
  couple** (`lock_request_expired`). `vendor_agree_to_lock` /
  `vendor_decline_lock` close a request past its 48 hours themselves; only the
  sweep told anyone. One shared function, once: each door reports a row only
  when it is the transaction that moved it.
- **✕ Remove on a card with a pending booking request tells the supplier**
  (`lock_request_withdrawn`), exactly as Withdraw does.
- **The payment plan is frozen at the supplier's yes** and the host who asked is
  told (`payment_info_sent`). Under the lock handshake the couple's press only
  asks, and the plan snapshot lived below that return — a booking made the
  normal way had no row in `event_vendor_payment_plan`.
  `lib/booking-payment-plan.server.ts` is `finalizeVendor`'s block moved whole;
  the direct lock and `vendorAgreeToLock` (on `ok`) both call it. A package
  booking is left alone; an ask with no recorded asker gets its plan and no
  notice. Proven on the replayed schema
  (`tests/db/the-plan-is-frozen-at-the-suppliers-yes.db.test.ts`).

**Honesty about emails that already ship:**

- An email that was not sent is recorded. `emitNotification` used to skip the
  whole block when Resend was not configured; now `sendEmail` records
  `not_configured`, and the other exits without a send record `send_failed`
  with the reason (`email_deliveries`, read on `/admin`).
- Couple ↔ supplier emails that already shipped carry "Event · Date" rows.
- A released supplier reads the owner's approved 2026-09-22 sentence, from its
  one home; "We'll let you know if it reopens" is removed because nothing does.

**One declaration, two guards.** `lib/couple-supplier-notices.ts` lists every
notice type between a couple and a supplier: emailed (because it already was) or
app-only, with the reason. `couple-supplier-notices-reach-email.test.ts` fails if
an app-only notice is emailed, if an emailed one loses a part, or if a notice is
emitted from a couple ↔ supplier file without being declared.

False comments corrected: three that claimed an email that was never sent
(`chat-actions`, `vendors/actions` ×2), `vendor-invite-actions` ("in-app/push"),
and the one that said the payment plan "runs from vendorAgreeToLock".

**Not built, recorded at the site:** a supplier removed while only a
conversation is open is told nothing (owner's ruling pending); the release of
rival suppliers runs at the couple's press and never under the handshake, while
the rulings name Payment-Verified (owner's to settle); the reservation-terms
evidence is not written at the yes (its input is not stored at the ask).

SPEC IMPACT: Iteration 0028 (notifications) — four new in-app notification
types; NO type gained or lost the email channel. The payment plan of a
handshake booking is now written at the supplier's yes. Not applied to the
corpus from this branch (local-only); the controller is making the corpus edit.
