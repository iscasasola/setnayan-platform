## 2026-08-28 · feat(vendor): the customer page answers — four states, and a shop can ask for a payment

**S4 of the shop redesign.** Two things a person gets.

**1 · Customers opens on who is waiting, in four states.** The roster is the page's first
block now, above the month calendar, and it carries the whole pipeline instead of two of its
rungs: **Waiting on you** (an unanswered enquiry, or an unanswered booking ask — one list,
every kind of question, oldest first) · **Talking** · **Booked** · **Finished**. Filter chips
narrow the same list; nothing moved into a second room. The calendar, the summary tiles and
the QR panel all still render, unchanged, immediately below.

- The lanes are derived once, purely, in `lib/vendor-customer-pipeline.ts`, on top of the
  shipped `lockRequestStateOf` — no second answer to "who is booked".
- A **waiting** row never carries the couple's name or venue: it renders the same masked
  placeholder the Answers Desk uses, built by the shipped `fetchInquiryMaskMeta`.
- The old `STATUS_PILL` map is deleted. Three of its five entries (`locked`, `whitelist`,
  `waitlist`) could never be produced by the assembly loop.

**2 · A shop can ask a booked customer for a payment**, on the Quote & Payments tab where it
already sees the balance. New `vendor_payment_asks` + `withdraw_vendor_payment_ask`; the
couple is told and reads it on their own supplier workspace. Off-platform money is unchanged —
Setnayan holds none of it and this moves none of it.

**Also repaired, found while building beside them:** `vendorPostHandover` and
`vendorRaiseChangeOrder` both resolved the booking on the vendor's own session, and
`event_vendors` has no vendor SELECT policy in production. Both bounced to their own error
flag on every attempt, for every shop, always — a supplier could never deliver a gallery link
or raise a change order.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-28 (S4) + `WHATS_NEXT_Shop_Redesign_SESSIONS_2026-08-28.md`
— S4 marked built; the 48h-vs-7-day lock window is surfaced as an owner question, not implemented.

**And the repair above turned out to be a CLASS, not two functions.** Grepping the RECEIVER of
every `.from('event_vendors')` under `app/vendor-dashboard/**` found **five** session-client reads,
each a silent zero. Three are fixed here; the worst was **`deleteVendorService`**, whose
"retire it, don't delete it" guard counts the bookings pointing at a service — always 0 on the
shop's session, so deleting a service hard-deleted it and `SET NULL`'d `event_vendors.service_id`
on any booking that named it, erasing which service a couple bought. Inert in production (0 of 45
bookings carry a `service_id`), which is why it was safe to fix rather than urgent.

Two are **named, not fixed**, each with its reason on the record in
`app/vendor-dashboard/a-shop-cannot-read-its-own-booking.test.ts` — the guard that now fails on any
NEW one and on a stale exemption: the host/MC cue composer (`script-actions.ts`, every save answers
"You are not booked on this event") and the manpower open-gig list (`manpower/surface.tsx`, paid
work reads as "hosts are not offering any"). Both need their downstream writes measured in their
own PR; repairing the gate alone would move the silence one statement later.
