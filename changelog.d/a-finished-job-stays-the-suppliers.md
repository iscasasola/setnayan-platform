## 2026-08-21 · fix(db): a finished job stays the supplier's

Slice 2 of *"vendors get to keep it"* (owner 2026-08-21). Test: **did the
supplier take part in it?**

`event_vendors` is the root of a supplier's entire public track record —
completed-job counts, the quality score that **sorts the marketplace**, the
verified median price. `vendor_completed_events` is a VIEW over it and
`vendor_public_completed_events_stats` a materialised view over that: **there is
no independent record of a completed booking anywhere in the schema.** The row
CASCADED, so a couple pressing delete erased the supplier's history of a job they
actually did.

### ⚠ Unlike reviews, preserving too much is as wrong as preserving too little

The same table holds the couple's **private shortlist** and their real bookings.
Preserving it wholesale would tell a supplier they were considered and rejected.
Prod today: **32 `considering` rows, none linked to anybody.**

Three conditions, each load-bearing and each with its own test:

1. **Status** — `contracted`/`deposit_paid`/`delivered`/`complete`, the set
   `lib/event-deletion-gate.ts` already exports as `BOOKED_VENDOR_STATUSES`
   ("states that mean really booked, not merely being considered"). Not invented
   here; the same set already exists under five names in five files.
2. **`marketplace_vendor_id`, not `linked_vendor_profile_id`** — a row with
   neither is a name the couple typed, with no supplier to keep it for (44 of 45
   prod rows). And the choice between the two link columns is not cosmetic:
   `lib/reusable-bookings.server.ts` lets the **couple's own action** stamp
   `linked_vendor_profile_id`, so keying on it would let a couple plant a
   "booking" on any supplier and make it permanent by deleting the event. Same
   rule `vendor_agree_to_lock` already states — an ownership predicate may not
   key on a column the counterparty controls, and here the counterparty is the
   person deleting.
3. **Not self-dealt** — see below.

### 🚨 Two traps that would have made this fix silently useless or harmful

**Preserving the row is not enough.** `vendor_completed_events` reads
`event_type` and `event_date` **from the event** and INNER JOINs it, so an
orphaned booking drops out of the view entirely and the supplier's count still
falls to zero. The row now carries its own snapshot of both, stamped at deletion,
and the view LEFT JOINs and COALESCEs. This is the classification's *"stored does
not mean survives"* in a new costume.

**And the naive fix CREATES a fraud vector.** The view excludes a booking whose
supplier is also a couple member of that event. Those checks read
`event_members`, which **CASCADES** — so once the event is gone they cannot run
and every one passes permissively. Preserve blindly and a vendor books their own
celebration, marks it delivered, deletes the event, and the job counts **forever**.
The guard is now evaluated at deletion time, while the members still exist. It
moved earlier; it was not dropped.

### A guard caught a third thing

`anon-rpc-surface.db.test.ts` flagged the new trigger function: **a SECURITY
DEFINER function is executable by PUBLIC by default**, so it joined the
anon-callable surface just by existing. A trigger function needs no EXECUTE grant
— Postgres runs it as part of the DELETE regardless. Revoked in the same
migration. Every trigger function in the remaining slices needs the same line.

### The snapshot columns are writable, and that is handled by proof, not a grant

The baseline shows both new columns as `SIU` for session roles. A column-level
`REVOKE` would be **inert** — `authenticated` holds table-level UPDATE and a
column revoke cannot subtract from a table grant; this repo has already paid for
that once. The real controls are that the trigger **overwrites** anything
pre-written, and that an orphaned row is unreachable through all four RLS
policies (they key on `event_id`; NULL matches nothing). A test asserts the
overwrite, which is the half that could silently stop being true.

### Mutations — each fails exactly its own test

| | | |
|---|---|---|
| **M57** remove the self-dealing guard (1 → 0) | RED | *deleting the event does not LAUNDER a self-booked job* |
| **M58** key on the couple-controlled column (1 → 0) | RED | *a couple cannot manufacture a preserved booking* |
| **M59** view back to INNER JOIN (1 → 0) | RED | *the public completed-jobs count still includes it* |
| **M60** stop stamping the snapshot (1 → 0) | RED ×2 | both snapshot tests, proving the forgery test depends on the stamp |

**1342 db pass · 9173 unit pass · 0 fail** · typecheck clean · migration guard
clean. Rebased onto slice 1 and re-run, so both migrations are proven to replay
together.

SPEC IMPACT: None — implements the ruling in `DECISION_LOG.md` 2026-08-21.
