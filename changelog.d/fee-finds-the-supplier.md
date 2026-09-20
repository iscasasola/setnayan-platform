## 2026-09-20 · fix(booking-fee): the supplier is told about the fee, and the bill finds them

**The two sentences this fixes**, both from the owner on 2026-09-20 after driving a real
booking end to end as the supplier Saysay and being billed ₱837.50:

- *"i never saw the payment screen to pay us."*
- *"as a vendor i do not know i have to pay."*

Everything on the money path already worked — charge `S89F-HMS91HGPAK`, order ₱837.50, a
`payments` row in the admin queue, an in-app notification and an email. What did not exist
was (a) any mention of the fee **before** the charge appeared, and (b) any link to
`/vendor-dashboard/booking-fees` from anywhere except one tile on
`/vendor-dashboard/subscription`. A correct bill nobody can find, for a fee nobody was told
about, is indistinguishable from a surprise charge.

**Disclosure — four places, one quoter.** New pure `lib/booking-fee-disclosure.ts` composes
every sentence and every peso figure from `bookingFeePhp` + `isFreeBooking`, the same two
primitives `decideLockFee` composes and the SQL mirror `booking_fee_centavos` is pinned
against. No surface types a rate.

- **Sign-up** (`/open-shop`, last step): what "free" means — free to join, first
  `FREE_BOOKING_LIMIT` Setnayan-sourced bookings free, then the live schedule.
- **Quote builder** and the template shortcut: "If they book: Setnayan booking fee ₱837.50
  (5.0%)", re-priced as they type, off the same `netPayable` the gift line uses.
- **Every Agree button** — chat card, Today feed card, client page — names the fee ABOVE
  the button. A fee named after the press is a receipt, not a disclosure.
- A free booking SAYS it is free and counts what is left; an imported client says it carries
  no fee; a refused read says we could not check and prints **no number at all**.

**The bill — three surfaces instead of one.** `BOOKING_FEE_BILL_SURFACES` is the decision
and the checklist: Today, the client page for that couple (scoped by `event_id`, so one
couple's fee can never show on another's), and the earnings surface — where "Your share
100% · no platform cut" now also names what is outstanding. Every row carries **Pay now**.
An unreadable read renders nothing, never "you owe nothing".

**Notification.** *Before:* a lazy sweep fired from the vendor-dashboard layout, so the
notice materialised on the supplier's NEXT VISIT; its title rounded ₱837.50 to **"₱838"**
(production notification `5b5882bc`) and it never named the due date. *Now:* the charge path
notifies at the moment the bill opens (same `order_quoted` type, already on
`EMAIL_ENABLED_TYPES`, so in-app + email), to the centavo, with the due date. The sweep
stays as the net underneath and is idempotent with it on `related_url`. The rounding
formatter is deleted, not merely unused.

**Overdue, measured rather than invented.** `booking_fee_charges.expires_at` is written and
read by NOTHING: `cron.job` is empty on production, no TypeScript reads the column, the only
writer of `status='expired'` is the amendment re-derive, and room access comes from
`lock_request_state = 'agreed'` (`lib/vendor-room-access-rule.ts`), which never consults the
fee. So the copy escalates (due → soon → due today → overdue) and explicitly says the
booking is not affected. A guard forbids the copy from threatening cancellation, suspension
or delisting, and fails the moment the access rule starts reading the fee.

**Two false public claims removed.** `/vendors` told suppliers "commission is 0% while we
launch" on two components while `NEXT_PUBLIC_BOOKING_FEE_ENABLED` was ON and a real charge
was pending. Both are now gated on the same flag that decides whether anybody is billed.

**Guards** (`lib/the-fee-finds-the-supplier.test.ts`, 14 tests, every one sabotage-proven
RED): the pure surface decision; a supplier with no pending fee sees none of it anywhere; one
counted mount per surface; all six disclosure mounts; the notice is above the Agree form, not
below; no printed rate that is not derived; the couple never sees the supplier's fee; no
rounding; the overdue copy promises nothing.

SPEC IMPACT: None — no locked decision changes. The fee schedule, the free-5 rule and the
manual GCash/BDO rail are all unchanged; this only makes them visible to the person paying.
