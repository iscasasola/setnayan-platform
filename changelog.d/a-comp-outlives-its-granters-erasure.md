## 2026-09-07 · fix(erasure): an erased admin's identity leaves the comps they issued

`comp_grants.granted_by` was made `ON DELETE SET NULL` on 2026-09-06 (migration
`20271208517365`) so a departing admin stops erasing the money record they
issued. **That fixed the DELETE path and left the ERASURE path untouched**, and
the two are different mechanisms:

> `ON DELETE SET NULL` fires on DELETE. RA 10173 erasure **anonymizes in place**
> and issues no delete (`purge.ts` goes through `auth.admin.updateUserById`), so
> the foreign key never fires on that path at all.

So after an admin requested erasure, their uuid simply stayed in every comp they
had ever issued. 🔑 **FIXING ONE HALF AND CALLING IT DONE IS HOW THIS RESIDUAL
SURVIVED THE MORNING THE FK WAS CORRECTED** — by the session that corrected it.

**Both admin stamps now clear on erasure**, via `AUTHOR_UUID_NULLS`:
`granted_by` and `approved_by`. Clearing one and keeping the other would have
read as a decision rather than the oversight it was.

**`comp_grants` moves from `DELIBERATE_EXCLUSIONS` to `PARTIALLY_PURGED`.** The
old entry said erasure touches nothing on this table — true until this change
made it false, and a privacy register that describes work it does not do is
worse than one with a gap in it. The new note says exactly which part goes and
which stays: *PURGED: granted_by, approved_by — the two admin stamps. DEFERRED:
user_id, the customer the comp was FOR, and the money itself.* Near-exact
precedent one entry below it: `discount_code_eligible_users` purges the staff
stamp and keeps the commercial concession.

⚠ **Verified before writing it, because a dead entry is worse than a gap:**
`purge.ts` never consults `DELIBERATE_EXCLUSIONS` — it loops `AUTHOR_UUID_NULLS`
directly — so the new entries genuinely fire. Had the exclusion list gated the
sweep, this would have been a fix that only looked like one.

**And the rule now has proof it fires.** `erasure-completeness.db.test.ts` did
not mention `comp_grants` at all, so the entries would have been a rule nothing
exercised — the same shape as the function this corpus records as having *"ten
passing assertions and zero application callers"*. Two rows are now seeded, one
per role the subject can play on this table, because the answers are opposite:

- a comp they **ISSUED** as an admin — the stamp clears, the ₱4,999 and the
  rationale stay, and the third party who received it keeps their comp;
- a comp issued **TO** them — retained wholesale on the lawful-retention basis,
  with a test that fails if anyone quietly turns that retention decision into a
  deletion.

Mutation-proven: removing the `granted_by` entry turns both new refusal tests
red (37 → 40 assertions; sabotage leaves 38/2).

SPEC IMPACT: None — an erasure disposition made to match a decision already
taken on 2026-09-06; no price, SKU or entitlement rule changes.
