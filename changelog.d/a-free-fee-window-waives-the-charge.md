## 2026-09-22 · feat(booking-fee): a free-fee window waives the charge

Owner, on the day the booking-fee lock went live: **"build the free-fee promo
window."** He had named three ways a supplier keeps access to what the fee locks.
Two already worked — `waived_free5` (a shop's first five) and `waived_import` (a
booking the shop brought in itself) are both in `FEE_SETTLED_STATUSES`. **The
third did not exist at all**, and three things in the tree look like it:
`promo_free_windows` promotes a subscription **tier**;
`NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL` ends the free day-of **tools**; and
`lib/vendor-launch-free-window.ts` has **zero callers outside its own file**.
Declaring a free period would still have minted `pending` charges at full price —
and, with the lock on, shut those suppliers out of weddings they were about to
work.

**The window** is two columns on `platform_settings`, beside the fee knobs that
already live there (`booking_fee_rate_pct`, `fee_unlocks_event_enforced`):
`booking_fee_free_from` and `booking_fee_free_until`. Either may be null for an
open-ended side; **both null means no window**, never "free forever". One rule,
`public.booking_fee_free_window_active()`, is asked by every caller.

**A new status, `waived_promo`** — not `paid` with a zero amount. The ledger must
not say a supplier paid when Setnayan gave it away, and a promotion must be
countable separately from a cap. It settles (so the Event Hub opens) and cannot
pay out: `grantVendorPapicCreditsForBookingFee` returns early on anything that is
not exactly `paid`.

**Three doors mint a charge, not one** — asked of `pg_proc`, not of memory:
`booking_fee_open_charge`, `booking_fee_open_lock_charge` (every real charge
today) and `booking_fee_rederive_lock_fee`. All three are replaced, each carrying
its **original body verbatim** with counted, asserted patches applied — the money
code is not retyped from memory. Every *"is there already a live charge?"*
selector also learns the new status, or a second call would mint a **duplicate
charge**; `booking_fee_open_lock_charge` carries that selector twice.

**Order matters and is pinned by a test:** the promo arm sits **below** the
free-5 arm, so a window never silently spends one of a shop's five courtesies
during a period when everything was free anyway.

**The supplier is told.** A new `promo_window` standing in
`booking-fee-disclosure` makes the Agree button read *"Booking fee ₱837.50 — free
right now… It does not use up one of your five free bookings."* Without it the
desk would have kept quoting a fee nobody was going to charge.

**Scope, said out loud.** The window decides charges **opened** while it is open.
It does not retroactively waive a `pending` charge that already existed — that is
forgiving a debt already incurred, a separate decision. A booking waived by a
window **stays** waived when its total is later amended, even after the window
closes.

**Guards.** `lib/a-free-fee-window-fails-closed.test.ts` runs the pure rule over
12 cases; `tests/db/a-free-fee-window-waives-the-charge.db.test.ts` replays the
migrations and runs the **SQL function and the TypeScript twin over the same
table**, so the two cannot drift. Measured, not asserted: four sabotages each
turned it red — removing the window call from the lock door (2 of 10), a selector
forgetting the status (1), the CHECK dropping `waived_free5` (1), and the window
ceasing to fail closed (2). The selector guard itself was corrected mid-build: its
first regex matched the `paid_at` stamp and called it a selector — the catch was
real (that stamp did need the new status) but the message was wrong.

SPEC IMPACT: `DECISION_LOG.md` — a row records the window, the new status, the
three doors, and the two scope limits above.
