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

## 2026-09-20 · fix(booking-fee): a waived booking names the fee it would have carried

**Owner refinement, same day:** *"still tell them that there should be a booking fee. but this
will be considered free. or something like this."*

The first cut presented a free-5 booking as **"Free — booking 3 of your first 5"**, with no
amount. That teaches a supplier there is no fee at all, and the sixth booking then arrives as
a surprise charge — the very defect this lane exists to remove, deferred by five bookings.

**The free and billable arms now share ONE line shape**, and only the verdict changes:

```
Booking fee ₱508.50 — waived.               (inside the free-5)
Booking fee ₱837.50 (5.0%) — payable…       (booking 6+)
```

- Both figures come from the same `bookingFeePhp` call, so the waived amount is exactly what
  `computed_fee_centavos` will hold on the charge (prod's waived row: **50850** against
  `amount_charged_centavos` **0**). It is a display of a real number, not a second calculation.
- `BookingFeeStanding.free` now carries the schedule — without it the amount is uncomputable
  and the copy can only say "Free", which is what the ruling forbids.
- **No amount ⇒ no number.** An unreadable total or an unreadable `computed_fee_centavos`
  prints the position and the schedule and no peso figure — never ₱0, which would say the fee
  was nothing rather than that it was waived.

**Waived charges had no supplier surface at all.** A waived charge mints no `orders` row and
every fee surface read orders, so a shop's free bookings appeared nowhere — "free" was
something they inferred from silence. `fetchWaivedFeeCharges` + `WaivedFeeRows` now show them
on **the fee hub** (a "Waived — your first 5" section), **the client page** for that couple,
and **earnings**. The hub's empty state changed from "No booking fees yet" to "Nothing to pay
yet", because a shop with five waived charges has had fees — it has owed nothing.

**The position is the real ordinal.** `booking_fee_ledger.booking_ordinal` is read first and
marked frozen; the count fallback is reached only when no ledger row exists yet (the booking
is not agreed, so there IS no real ordinal), and that case is worded as a projection — *"this
**would be** booking 3"* — rather than stated as fact. `fetchWaivedFeeCharges` takes the
ordinal by join, never by counting.

**Guards** (+5, each sabotage-proven RED): a waived forecast names the amount, the position
and the reason; a waived charge names its recorded amount and never degrades to ₱0; **nothing
anywhere renders a bare "Free"**; the ledger is consulted before the derived count; all three
waived surfaces mount it, and the client page shows only its own couple's.

SPEC IMPACT: None — the free-5 rule and the fee schedule are unchanged; only what the
supplier is told about them.

**Cross-lane tripwire.** A parallel lane (`claude/fee-unlocks-the-event`) is building fee
enforcement in NEW modules behind `NEXT_PUBLIC_FEE_UNLOCKS_EVENT` (default OFF), which the
"access never reads the fee" check cannot see. When that flag flips, this PR's overdue
sentence — *"your booking is not affected"* — becomes a lie, and nothing here would have gone
red: two lanes, two voices on one subject, each passing its own suite. The guard now fails as
soon as that flag name appears in any live source while `feeDueCopy` still ignores it, and
says what has to change. Armed now, while it costs nothing. (Trial-merged against that branch:
clean, no conflict.)
