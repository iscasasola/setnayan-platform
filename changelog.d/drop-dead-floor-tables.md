## 2026-08-01 · chore(db): drop two tables retired the day they shipped — and keep the third, which turned out to be load-bearing

Owner approved dropping three dead things under the standing rule that retired means deleted. **Two are dropped. The third is not, because the report that justified it was wrong.**

### Dropped

`event_floor_areas` and `event_floor_objects` — **0 rows, 0 references anywhere in the repo including tests, 0 functions or views naming them.** Both were retired by their own migration the same day they shipped and never carried a row. Keeping them implies a multi-area venue blueprint the product does not have.

### Not dropped — `households`, and why

It was reported dead on all four measures and approved on that basis. **The report was wrong, and the error was mine: the reference scan excluded `*.test.*` files.**

`households` is a canary in `tests/db/event-member-self-join.db.test.ts` — the suite proving a stranger who self-joins an event cannot read that event's data. It seeds a household row and asserts the attacker cannot read it back. Dropping the table broke **ten security assertions**. Verified both ways:

```
without the households drop:  10/10 pass
with it:                       0/10 pass
```

The table remains product-dead — no rows, no product reader, no writer. But **the fix is not to rewrite a security test so a deletion can proceed.** That is weakening a guard to go green, and this codebase has a standing rule against exactly that. The decision goes back to the owner with corrected facts: keep the canary, or move the test onto a different event-scoped table as a deliberate change of its own.

`guests.household_id` therefore also stays. It is populated on **0 of 39** rows, so that drop remains trivially safe whenever it is taken.

### How "dead" was measured, after nearly getting it wrong twice

The same sweep that found these nearly deleted a **live** table on a name grep: `seating_editor_locks` has zero product references by name and is fully live through four SECURITY DEFINER RPCs. So each candidate was checked four ways — row count, inbound FKs, code references, and whether any function or view names it — and this PR adds a fifth the hard way: **test references count.**

Two near-misses in two rounds, opposite directions. A name search is evidence, never a verdict.

The Ugat baseline line for `households` is restored with the corrected reason, and the Person node's annotation now records that it is product-dead *and* load-bearing at once.

Verified: migration guard green (1013) · **full DB suite 693/693** (it was 683/693 with the households drop included — that is how this was caught).

SPEC IMPACT: None — dead schema removal.
