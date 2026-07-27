## 2026-07-27 · fix(fees): two defects in the armed booking-fee amendment re-derive

Both are a `CREATE OR REPLACE` of the SAME function
(`public.booking_fee_rederive_lock_fee`), so they ship in ONE migration —
`20271013541380_booking_fee_schedule_version_default.sql`. Split across two
files, whichever landed second would silently revert the other.

**(A)** the schedule-version stamp named a superseded schedule · **(B)** a live
UNDER-BILLING bug: a second, higher amendment left the vendor's supplementary
charge frozen at the first amendment's amount.

---

### (A) the amendment re-derive stamped a SUPERSEDED schedule version

`public.booking_fee_rederive_lock_fee` still carried
`p_schedule_version TEXT DEFAULT '2026-07-24-flat5-nocap'` — the flat-5% schedule
the taper replaced on 2026-07-25. Verified in the **live** database, not
inferred:

| function | live DEFAULT | |
|---|---|---|
| `booking_fee_open_lock_charge` | `'2026-07-25-taper5-1-over-100k'` | ✅ |
| `booking_fee_rederive_lock_fee` | `'2026-07-24-flat5-nocap'` | ❌ |

**It was reachable automatically.** The amendment trigger
`booking_fee_on_event_vendor_price_change()` calls it with ONE argument
(`PERFORM public.booking_fee_rederive_lock_fee(NEW.vendor_id)`), so the stale
default applied on every amendment-driven re-derive. The charge **amount** was
always correct — it comes from `booking_fee_centavos`, i.e. the taper — but the
`schedule_version` written onto the resulting `amendment_delta` /
`amendment_credit` row claimed the money had been computed under flat-5%. That
stamp exists precisely so a future reprice cannot silently rewrite history; a
stamp naming a schedule the charge was **not** computed under defeats its own
purpose and would mislead any audit or recompute. The fee is ARMED in
production, so the first amended booking would have written wrong audit data.

### Derived, not re-typed

Swapping in the correct literal would have reproduced the bug at the next
reprice — the same class fixed in #3805/#3809. So migration
`20271013541380_booking_fee_schedule_version_default.sql` adds
**`public.booking_fee_schedule_version()`** (`RETURNS TEXT`, `IMMUTABLE`,
`LANGUAGE sql`, service_role-only) and re-defaults the parameter to
`DEFAULT public.booking_fee_schedule_version()`. Postgres stores a parameter
default as an expression tree and evaluates it **per call** — verified, not
assumed — so a reprice that `CREATE OR REPLACE`s the version function moves
every omitted-argument caller with it. No second edit site, no signature change.

---

### (B) a SECOND amendment silently under-billed — a clobbered `FOUND`

Found while driving the one-argument path for (A); verified independently by the
coordinator. In the `v_delta > 0` branch, `20270930120000` wrote:

```sql
SELECT charge_id, amount_charged_centavos INTO v_existing_delta ...   -- sets FOUND
UPDATE ... WHERE kind = 'amendment_credit' AND credit_centavos <> 0;  -- RESETS FOUND
IF FOUND AND v_existing_delta.charge_id IS NOT NULL THEN              -- reads the WRONG one
```

`FOUND` is reset by every statement, so that `IF` tests the credit-zeroing
UPDATE, not the `SELECT … INTO` it appears to guard. With no credit note on file
— the common case — the UPDATE matches 0 rows, `FOUND` is false, the
update-in-place branch is **skipped despite a pending delta existing**, and
control falls through to the `INSERT`. The INSERT violates
`booking_fee_charges_one_pending_delta_per_event_vendor`, and the **fail-soft
trigger swallows the 23505 into a `WARNING`** — so the amendment commits
cleanly, the stale delta survives at its old amount, and Setnayan under-bills
with nothing surfaced anywhere.

Reproduced against the replayed schema: primary ₱5,000 **paid** → amend to
₱200,000 opens a ₱1,000 delta → amend to ₱1,000,000 leaves it at **₱1,000 when
₱9,000 is due** (taper ₱14,000 − ₱5,000 paid). ₱8,000 lost per occurrence, on an
ARMED fee path.

**Fix:** drop the `FOUND AND`. `v_existing_delta.charge_id IS NOT NULL` is
exactly what the `SELECT … INTO` was for and cannot be clobbered by a later
statement. The credit-zeroing UPDATE stays where it is — it is correct, it is
just not something to branch on. The line carries a comment naming the
intervening UPDATE, because this is the second implicit-state read to cost money
in a day (the other was `count ?? 0` reading an unreadable booking count as "no
bookings") and the next reader should not have to rediscover it.

---

The re-derive **body is otherwise reproduced verbatim** from `20270930120000` —
a full definition diff shows EXACTLY the two intended deltas and nothing else.
No fee math, no `booking_fee_centavos`, no taper, no
`BOOKING_FEE_SCHEDULE_VERSION` value changed.

### Tests — the behavioural ones are the point

- **PARITY** — SQL `booking_fee_schedule_version()` equals TS
  `BOOKING_FEE_SCHEDULE_VERSION` byte-for-byte (same idiom as the sourced-set
  parity test).
- **THE DEFECT** — an amendment driven through the real one-argument trigger
  path must stamp the CURRENT schedule on the delta it mints, and on the credit.
  This is the test that would have caught it.
- **SWEEP** — no `booking_fee_charges` row anywhere in the suite carries
  `'2026-07-24-flat5-nocap'`.
- **INTROSPECTION** — the stored default must be the function call, and must
  contain no string literal at all, so the next reprice cannot re-introduce one.
- **Explicit argument still wins** — the app's lock path passes the version
  explicitly; that behaviour is unchanged.
- **THE DEFECT (B)** — `a SECOND amendment must RAISE the pending delta, not
  silently keep the stale one`: the ₱5,000-paid → ₱200,000 → ₱1,000,000
  reproduction, asserting **₱9,000**, exactly one `amendment_delta` row (nothing
  swallowed), and that the **vendor's QR order** was re-upserted to ₱9,000 —
  the bill the vendor receives has to move, not just the charge row.
- **THE DEFECT (B), with a credit note on file** — proves the fix does not
  depend on the credit-zeroing UPDATE having matched: run with the credit row
  present-and-zeroed (UPDATE matches nothing) *and* present-and-non-zero (UPDATE
  matches), both reaching the correct delta.

Neutralisation, run separately per fix:

| restored | red | naming |
|---|---|---|
| `DEFAULT '2026-07-24-flat5-nocap'` | 4 | `'2026-07-24-flat5-nocap'` vs expected `'2026-07-25-taper5-1-over-100k'` |
| `IF FOUND AND …` | 2 | `expected: 900000, actual: 100000` — ₱9,000 owed, ₱1,000 billed |

Also note the earlier test-only **trigger mute is gone**. Isolating the
explicit-argument call no longer needs `DISABLE TRIGGER`: the trigger's `WHEN`
clause only fires for `status IN (contracted, deposit_paid, delivered,
complete)`, so moving the price while the booking is `shortlisted` reaches the
same state using real product states only.

### Noticed, NOT touched

- **`booking_fee_open_charge`'s `DEFAULT '2026-07-23-flat2'`** (even older) is
  left as-is: nothing `PERFORM`s it in SQL and its single app caller
  (`openBookingFeeCharge`, `lib/booking-fee-charge.ts:40`) always passes
  `p_schedule_version` explicitly. The default is unreachable, so changing it
  would be churn on a live money RPC for no behavioural gain.
- The `delta_updated` branch deliberately does **not** rewrite
  `schedule_version` — an existing charge keeps the schedule it was priced
  under. That is correct (it is what the column is for) and is why the
  explicit-argument test has to be the call that MINTS the row.

SPEC IMPACT: None (audit-stamp correctness + an under-billing fix; no pricing
change, no change to the fee math, the taper, or `BOOKING_FEE_SCHEDULE_VERSION`)
