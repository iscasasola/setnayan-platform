## 2026-08-10 · feat(vendors): a closed shop keeps its address for a year, and erasure can finally finish

Two owner decisions taken together, because both land on the same moment — the point where a person leaves and their shop stops trading.

> *"their old shop's name will never be deleted (unless manual delete by admin). so the slug will be kept for the closed shop. slug will be available again after 1 year from date of deletion."*
>
> *"Yes, allow wipe."*

### 1 · Erasure was reporting success while leaving the account in place

Erasure enumerates a delete of the person's seat in their own shop — described in our own coverage list as *"a credential that must not outlive the account."* That delete cascades into `vendor_team_guard()`, which refuses to remove the **last admin**, and every shop in production has exactly one: whoever opened it.

The refusal arrives as a **returned error, not an exception**, so `step()` wrote an audit line and carried on. Erasure then completed and recorded `user_erased`.

🚨 **So we told the person, and our own audit trail, that they had been erased while their account was still an admin of a live shop.** Measured against production, not reasoned: the delete was refused, and only went through after suspending the trigger for one transaction.

The guard itself is **correct** — a shop with no admin is unreachable by its own team. It simply had no exemption for the one case where leaving nobody behind is the entire point. 🔑 **A rule with no exception is not safer than one with a named exception; it is the same rule with the exception hidden in whatever the caller does instead** — here, swallowing the failure and reporting success.

The exemption is set in exactly one place, `erase_vendor_seats()`, `service_role` only. It is a function rather than a session setting because PostgREST offers no way to issue `SET LOCAL` alongside a `.delete()` — and a flag the application could set for itself, on a **pooled** connection, is a hole rather than an exemption. It is transaction-local and cleared explicitly.

⚠ **The demotion arm is deliberately NOT exempted.** Erasure deletes a seat; it never demotes one. A demotion that empties a shop is still the mistake the guard was written to stop.

### 2 · A closed shop's address is held, not freed

RULE 0: `slug_change_log` already holds a word until `redirect_until` passes, and `findSlugConflict` already refuses anything it covers. So a held address is **one row with a later expiry** — no new table, no sweep, no scheduled job. The word **releases itself**: expiry is a timestamp comparison made when somebody asks for it, so there is nothing that can silently stop running.

🔑 **Its own `entity_type`, not a reused one.** A rename forwards visitors to where the shop went; a closure forwards nobody anywhere and is only holding the word. Encoding a closure as a rename-to-itself would have worked and would have lied — and this repo has already paid for a stored value whose *name* misled two independent readers.

🔑 **The hold is written BEFORE the scrub, and that ordering is the feature.** The scrub sets `business_slug` to NULL; read it afterwards and there is nothing left to hold. Reserving second is not a smaller bug, it is the same bug with extra steps.

The refusal has its own wording — *"That address belonged to a shop that has closed. It becomes free again a year after it closed."* Reusing the forwarding copy would have told the next person something plainly untrue and hidden the only fact that matters to them.

### The test double was hiding the difference

`fakeAdmin` ignored `.eq()`, so both probes over `slug_change_log` saw the same rows and whichever ran first won — a rename fixture came back as a closed shop. Not wrong in production, where Postgres filters, but **the tests could no longer tell the two apart, which is the whole thing they exist to check.** The double now honours the one filter under test.

### Verification

10 database tests that **run the SQL**, because every part of this defect lived there: a trigger raising, a client resolving that into `{ error }` instead of throwing, and a caller treating a returned error as a non-event.

Mutation-tested: removing the exemption (2 fail) · making the flag session-level instead of transaction-local, i.e. the connection-pool leak (1 fail) · widening the CHECK to anything instead of one new word (1 fail).

**7388/7388** unit · 20/20 `lint-*.mjs` · `tsc` clean · `rpc-argument-names.db.test.ts` green.

### 🔴 One thing the owner should rule on

The instruction says the shop's **name** is never deleted. Erasure still blanks `business_name`, and I have deliberately not changed that: a sole-proprietor shop is very often the person's own name, so keeping it would leave personal data behind after someone exercised their legal right to have it removed. **The address is held either way** — that part is done, and it is what stops anyone else taking the URL. If the name should survive erasure too, that is a privacy call, not an engineering one.

SPEC IMPACT: `DECISION_LOG.md` — two owner rulings recorded.
