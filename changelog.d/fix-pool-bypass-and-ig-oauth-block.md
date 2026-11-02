## 2026-08-01 · fix(schedule,vendor-ig): a switched-off pool still took bookings, and three stale OAuth rows were refusing to let an account be deleted

Two defects found by the vendor-operations schema sweep and **each re-verified by hand** before anything was written — the sweep also produced claims that did not survive checking, so nothing here is taken on an agent's word.

### 1 · Deactivating a pool stopped the checks, not the bookings

`acquire_schedule_pools()` validates in a loop and inserts in one statement, and the two disagreed about which rows they covered:

```sql
-- the loop: closure · locked · whitelist · capacity
WHERE pool_id = ANY (p_pool_ids) AND is_active      -- inactive pools SKIPPED
-- the insert, a few lines below
WHERE sp.pool_id = ANY (p_pool_ids)                 -- …and INCLUDED
```

An inactive pool was never closure-checked, never lock-checked, never capacity-checked — **and still received a booking row**. Switching a pool off silently promoted it from "closed" to "unlimited and unvalidated", the exact inverse of what the switch is for.

**Latent, not live:** prod has zero inactive pools, which is precisely why nothing surfaced it. The defect arms itself the first time an operator deactivates a pool — the moment they believe they have closed it.

The fix is one predicate so both halves quantify over the same set. Deliberately not a wider refactor: the loop is the shipped, reviewed concurrency design (deterministic `FOR UPDATE` ordering against deadlock) and the bug is only that the write forgot the filter the read applied. ⚠ The migration reproduces the live body verbatim plus that predicate, so **this file is now the definition**.

### 2 · Three leftover rows were blocking account deletion

`vendor_ig_oauth_state.initiated_by → auth.users(id)` carried **no ON DELETE clause**, so it defaulted to NO ACTION — refuse. Any user holding a pending Instagram handshake could not be deleted at all.

Three such rows exist in prod, all for the owner's own account, from a connect attempt on 2026-07-05 that never produced a connection, on a table with **no expiry column and no sweeper**. A contributing cause of the already-known "admin Delete user is broken", which had been attributed to other NO ACTION keys.

Fixed to `ON DELETE CASCADE` — correct on the merits, not merely convenient: the row is ephemeral CSRF/PKCE handshake state, meaningless without the user who started it. **No rows are deleted here**; the three stale ones simply stop blocking. Giving the table the `expires_at` + sweep it never had is a separate change.

### Found while writing the test, and worth its own follow-up

Deleting a user who **owns** a vendor profile is refused by a different rule entirely — `VENDOR_LAST_ADMIN: a store must keep at least one admin`. That is a second, independent reason admin "Delete user" fails, and it is a product decision (what should happen to a store when its only admin leaves?) rather than a bug. The test isolates around it: the profile is owned by user A, the handshake started by user B, and B is the one deleted — leaving exactly one thing between B and deletion.

### The tests are proven, not assumed

`tests/db/pool-bypass-and-oauth-block.db.test.ts` — 3 tests, inside the required check. Both fix assertions were run **with the migration removed** and confirmed to FAIL, then restored and confirmed to pass. A characterization test reproduces the predicate mismatch directly, so the fix is demonstrated against a reproduction rather than against a hope.

Neither test inspects DDL to see whether the migration "looks right": a constraint that exists but is `NOT VALID`, or a function replaced by a later migration, both read as correct to a DDL check and fail in production. Each performs the real operation and asserts the outcome.

SPEC IMPACT: None — bug fixes, no product behaviour intentionally changed. (A switched-off pool now behaves the way the switch always claimed.)
