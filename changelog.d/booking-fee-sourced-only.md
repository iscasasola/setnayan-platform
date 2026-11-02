## 2026-07-26 · fix(fees): charge ONLY clients Setnayan sourced — the lock path was billing everyone

Owner, 2026-07-26: *"bringing in clients will give them free access to that
guest."* The lock path did not honour that at all.

### The bug

`booking_fee_open_lock_charge` hardcoded `attribution := 'sourced'` on the
ledger insert (`20270927120000:165`, comment: *"kept 'sourced' to satisfy the
column default"*). So the LOCK path **never consulted arrival source**. On
flag-flip, a vendor who brought their own client would have been billed a
percentage of a deal Setnayan had no part in — the exact inverse of
`Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 3 (*"Applies ONLY to clients
Setnayan sourced… BYO / vendor-invited / returning = free"*), and the one
outcome the whole "monetize ACCESS, not the vendor's deals" posture exists to
prevent. The SEND path already carried attribution; only LOCK was blind.

### The fix

Two new SQL helpers plus a rebuilt lock RPC:

- `booking_fee_is_sourced_surface(text)` — the marketplace-discovery set.
- `booking_fee_attribution_for(vendor, event)` — reads the thread stamped at
  first contact. **Fails safe to `import`**: no thread, NULL source, or an
  unrecognised source is free.
- The RPC now stamps the derived attribution and, for an import, writes a
  `waived_import` charge and **never mints an order**.

**The fail-safe direction is deliberate:** a misclassification must cost
Setnayan a fee it might have been owed, never bill a vendor for a client they
brought. A missed fee is a missed fee; a wrong bill is unrecoverable trust.

### `'website'` moved to the free side

Closes sign-off #3d-iv. The 2026-07-21 build plan listed a vendor's own link as
billable with the decision flagged open; the owner closed it — that couple is
the vendor's own audience. Charging it would bill vendors for their own
following and push them off-platform.

### Also repaired here

The ledger's `ON CONFLICT DO UPDATE` never set `source`, so a row first created
by the SEND path stayed `source='send'` while the free-5 ordinal counts
`source='lock'` — the count could come back **0**, violate the
`booking_ordinal >= 1` CHECK, raise, and leave the fee **silently uncollected**.
Now sets `source='lock'` on reuse, with a `GREATEST(v_ordinal, 1)` backstop.

### 🔁 The guard caught me making the same mistake I diagnosed this morning

The exposure freeze failed this branch: both new functions were callable by
`anon`/`authenticated`, because Supabase's default privileges grant `EXECUTE`
on every new function and revoking from `PUBLIC` doesn't touch a role grant —
**precisely the trap that shipped `events_host` as a writable view earlier
today**. Fixed with explicit `REVOKE … FROM anon, authenticated`. Worth noting
that the freeze earned its keep on the very next migration after it landed.

**Tests:** a vendor-brought client is waived (no thread), a vendor's own link is
waived, and SQL↔TS list parity across 12 sources. Every existing fee fixture now
stamps a sourced thread explicitly — *"no thread"* correctly means free, so a
billable fixture has to say so. Falsifiable: re-adding `'website'` turns 1 red.
**4025 unit + 311 DB green**, `tsc` exit=0, `next lint` exit=0.

SPEC IMPACT: implements the sourced-only half of
`Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 3 "Supersedes / reconcile"
item (a) and closes #3d-iv. ⚠ **Free-5 is PER EVENT** (owner 2026-07-26: *"yes.
this is per event"*) — that **reverses** the 2026-07-26 DECISION_LOG row saying
it counts bookings, so the §6.3 schema change is **cancelled**; the shipped
per-(vendor,event) ledger is already correct. Corrected in the handoff.
