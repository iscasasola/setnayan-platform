## 2026-07-30 · fix(ugat): the claims layer had a blind spot, and a joint authored the same day walked straight through it

The schema-claims layer shipped hours earlier to stop the Ugat joint registry naming things that do not exist. It immediately failed to catch one — in a joint authored on the same day, by the same pass.

**J15's `guardedBy` read:** *"CHECK events_community_class_consistency — a DB-level backstop pairing community_id with **the event class**."*

There is no `event_class` column. Not in production, not in any of the 1,002 migrations. The real constraint is:

```
CHECK ((community_id IS NULL) OR (event_type = ANY (ARRAY[
  'simple_event','corporate','travel','celebration',
  'tournament','reunion','anniversary'])))
```

It tests **`event_type`** against an allowlist. Verified against live production, not just the migration replay.

**Why the guard missed it.** The claim kinds covered tables, columns, FKs and uniques — but **not CHECK constraints**, which is exactly what that sentence was describing. The registry could still assert anything it liked about a CHECK and never be contradicted. A guard is only as good as the shapes it knows how to doubt, and "the shape I forgot" is where the next lie lives.

**New claim kind: `check`.** Asserts a named CHECK constraint exists on a table, with an optional `mentions` naming a column its definition must actually contain. Existence alone would have been too weak here — a constraint can be rewritten in place while keeping its name, and the name alone would still match. `mentions: 'event_type'` is what makes the claim bite.

The introspection now reads `pg_constraint` for `contype='c'` alongside the FK and unique passes, and carries definitions rather than just names.

**Unit tests include the exact miss:** a `check` claim with `mentions: 'event_class'` must FAIL against a constraint that tests `event_type`. That is the assertion which, had it existed this morning, would have caught the error before it merged.

**The prose is corrected too, and now says something truer than the original.** `implementedBy` previously described a NULL `community_id` as merely "a personal event." It now states the product rule: **a wedding is owned by its couple, never by a samahan**, and the CHECK enforces that rather than leaving it to convention. That is not a limitation to design around — it is the ownership model, in the database.

Owner-confirmed while reviewing the Samahan node: *"weddings is owned by a couple husband and wife."* The constraint had it right; the documentation of it did not.

**Practical consequence worth recording:** every event in production today is a wedding, so the Samahan→Event line legitimately reads **0**, and will until a non-wedding event exists. Correct behaviour, and now documented where someone would otherwise chase it as a bug.

SPEC IMPACT: `DECISION_LOG.md` row — `events_community_class_consistency` gates on `event_type` (there is no `event_class` column); weddings are couple-owned by design and cannot be samahan-owned. No schema change, no RLS edit, no flag — registry annotation and test coverage only, so no exposure-baseline regeneration.
