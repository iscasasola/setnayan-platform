## 2026-08-21 · fix(db): the contract stays with who signed it

Slice 3 of *"vendors get to keep it"*. The owner named this one explicitly —
every row where both parties have a claim, *"signed contracts, records of a
deposit paid, completed bookings"*, resolves to the **vendor**.

`vendor_contracts.event_id` was `NOT NULL` + `CASCADE`, so a couple deleting
their celebration destroyed the supplier's copy of a contract they had signed.

### Simpler than slice 2, and the reason is worth stating

`event_vendors` needed three conditions because it holds the couple's private
shortlist in the same rows. **A contract has no such ambiguity** —
`vendor_profile_id` is `NOT NULL`, the supplier authored the document, and there
is no such thing as a contract the supplier did not take part in. Every row
survives, with no status test. A draft they never sent is still theirs. Copying
slice 2's conditions here would have been cargo, and a test says so.

Measured before writing: of six FKs on this table, **five already survive** —
only `event_id` took the contract down.

### 🚨 Slice 2's lesson in its other costume

There, a preserved row **vanished** from a view that inner-joined the event.
Here the row survives and goes **anonymous**: the supplier's contract list looks
the event up separately and falls back to the literal string `'Unknown event'`.
A signed contract that cannot name its counterparty is its own kind of useless,
so the client's name is stamped while the event still exists.

**Both failure modes come from the same question** — *what else reads the event?*
— and they look nothing alike from the table.

### The access rules landed on exactly the right side

The supplier's policies key on **their own profile**; the couple's is a
`SELECT`-only policy keyed on the event through `event_members`. So an orphaned
contract stays fully in the supplier's hands and leaves the couple's view.
Asserted in both directions, before and after.

### The new column is writable — so who can write it is the control

The baseline lists `client_name_at_delete` as `SIU` for session roles. Unlike
slice 2 this trigger uses `COALESCE`, so a pre-written value would **survive**
rather than be overwritten. Measured: the couple has **no write policy at all**
on this table. A test asserts they cannot write it — and asserts `auth.uid()` is
really set first, or it would pass for the wrong reason.

### Mutations — each fails exactly its own tests

| | | |
|---|---|---|
| **M61** FK back to `CASCADE` (2 → 1) | **all 5 RED** | everything depends on survival |
| **M62** stop stamping the name (1 → 0) | RED | *still names who the supplier signed with* |
| **M63** blind assignment instead of `COALESCE` (1 → 0) | RED | *an already-stamped name is not overwritten* |

Also carried forward from slice 2 without waiting to be told: the trigger
function's `REVOKE` is in the same migration, because **a SECURITY DEFINER
function is executable by PUBLIC by default**.

**1340 db pass · 9173 unit pass · 0 fail** · typecheck clean · migration guard
clean (1157). Exposure baseline diff is exactly the one new column.

⚠ Two fixture bugs of mine on the way, both caught by reading the live schema
rather than guessing: a missing `NOT NULL` column, and a `status` value the
CHECK constraint does not allow.

SPEC IMPACT: None — implements the ruling in `DECISION_LOG.md` 2026-08-21.
