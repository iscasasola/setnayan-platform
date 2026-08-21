## 2026-08-21 · fix(db): a review outlives the event it was written about

**Owner, 2026-08-21:** *"only data from the user gets lost. But statistics and
data for the vendor stays, including the reviews… that the vendor needs for
their website."* And: *"vendors get to keep it."*

Measured in production the same day: **153 foreign keys to `events` CASCADE,
only 11 survive**, and `vendor_reviews.event_id` was `NOT NULL` + `CASCADE`. So
a review could not outlive its event — the product did the **opposite** of the
ruling, on the record the owner named first.

This is slice 1 of the classification in
`VENDOR_DATA_SURVIVES_DELETION_2026-08-21.md`. That document is explicitly
*mapped, not built*, and says its own adversarial pass was cut off — so every
fact here was re-read from the live database rather than taken from it.

### It is not new machinery — the table already knew how

`vendor_reviews.couple_user_id` is **already** nullable + `ON DELETE SET NULL`, so
a review already survives the deletion of the *person* who wrote it. Only the
*event* was wired to take the review down. This gives the event the same
treatment the person already has.

**And the principle was already written down in our own compliance layer.**
`lib/erasure/coverage.ts` nulls `couple_user_id` rather than deleting the review,
because *"deleting it would silently move a vendor's public star rating, which is
a third party's commercial record erasure does not reach."* That is the owner's
ruling almost word for word, months earlier. Event deletion was simply never made
consistent with it.

### What changes

- `event_id` becomes nullable; the FK becomes `ON DELETE SET NULL`.
- **Once orphaned, the review freezes.** The couple's UPDATE policy keyed on
  `couple_user_id` only, so without this a couple could delete their celebration
  and then keep rewriting the supplier's record — delete-then-gut.
- `UNIQUE (vendor_profile_id, event_id)` is deliberately untouched: Postgres
  treats NULLs as distinct, so orphans coexist, which must be true or the second
  couple to delete would collide with the first.

**The other four policies were already correct for orphans, by construction:**
public read stays `true` (the supplier keeps it *on their page*); couple-delete
keys on `event_id`, and `NULL IN (…)` is NULL, so the couple cannot delete an
orphan; couple-insert keys on `event_id`, so an orphan can never be **forged**;
vendor-reply keys on the vendor, so the supplier can still answer.

### The application side was already null-safe

Widening the type produced **one** compiler error in the whole codebase. The
couple-name lookup already filtered nulls and already fell back to *"Verified
couple"* — so a surviving review keeps its words and its rating, and the couple's
name goes quiet. That is the owner's rule rendering itself.

### 🚨 The exposure guard caught a real defect in this migration

Recreating a policy **silently discards its role restriction**. My
`CREATE POLICY` had no `TO` clause, so it defaulted to `PUBLIC` — including
`anon`. `exposure-freeze.db.test.ts` reported *"policy roles gained PUBLIC"*.

Not exploitable (an anonymous caller has no `auth.uid()`, so the predicate
matches nothing) — but the GRANT and the POLICY are the only real controls, and
neither may lean on a predicate happening to be unsatisfiable. Fixed.

The baseline is regenerated, and its diff is **exactly one line**: the same
policy with an added `AND`, which is strictly narrowing. Nothing else absorbed.

### Mutations, all measured by occurrence count

| | | |
|---|---|---|
| **M53** | remove the migration (1 → 0) | **5 of 7 RED** — the 2 that stay green are the deliberate controls |
| **M54b** | remove only the freeze (2 → 0) | **RED**, exactly the freeze test |
| **M55** | remove only `TO authenticated` (1 → 0) | **exposure guard RED** |

Every test asserts the **outcome**, never a throw: under RLS a refused write is
filtered to zero rows and resolves happily, so `assert.rejects` reports a missing
rejection while the data is safe.

1334 db pass · 9156 unit pass · 0 fail · typecheck clean · migration guard clean.

SPEC IMPACT: None — implements the ruling already recorded in `DECISION_LOG.md`
2026-08-21 and classified in `VENDOR_DATA_SURVIVES_DELETION_2026-08-21.md`.
