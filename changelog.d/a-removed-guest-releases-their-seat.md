# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-03 · fix(guests): removing or merging a claims-queue guest releases their seat

`event_seat_assignments` has an `ON DELETE CASCADE` FK to `guests`, so a HARD
delete cleans up after itself. **This app never hard-deletes a guest** — it sets
`deleted_at`, and a soft delete does not fire a cascade. Four delete paths know that
and remove the assignment explicitly. The two claims-queue paths did not.

### What it did

`removeGuestAction` and `linkGuestAction` left the assignment row behind. That
row is **invisible and still counts**:

- both seat editors join assignments to LIVING guests, so the chair renders
  **empty** and nothing on screen looks wrong;
- `computeAutoSeat` and `reconcileProvisionalSeats` read the table directly, so
  they still see the seat as **occupied** — it is never auto-filled again, for
  the life of the event;
- the unique constraint is only `(event_id, guest_id)`, so a manual drop onto
  that chair **double-books** it.

Not an edge case: `applyReconcileForEvent` gap-fills every unseated, non-declined
guest regardless of `entry_source`, and it runs from the public RSVP path — so a
claims-queue joiner usually HAS a seat by the time the couple removes or merges
them.

Both paths now delete the assignment first, matching `bulkSoftDeleteGuests`.
Order matters and is asserted: a live guest with no seat is fixable by hand; a
deleted guest holding a seat is the invisible state.

### The guard, and the three times it was wrong before it was right

`lib/a-soft-deleted-guest-releases-their-seat.test.ts` — a source scan, because
the defect is a MISSING statement with no return value to assert on.

Each wrong version is written down in the file rather than quietly replaced,
because every one of them failed against **correct code**, which is the failure
mode a source scan is most prone to:

1. matching `.from('guests')` … `deleted_at` within 200 chars also matched
   `.select('… deleted_at')` and `.is('deleted_at', null)` — reads. It counted
   4 deletes in a file with 2.
2. adding `(?!null)` after `deleted_at:\s*` did nothing, because `\s*` can match
   **zero** characters — the lookahead was tested against the space, so
   `restoreDeletedGuests` (which sets the column BACK to null and correctly
   re-upserts the seat) still counted as a delete.
3. it hand-rolled a two-replace comment stripper, and `lint-one-comment-stripper`
   refused it — correctly. That shape lets a line comment containing `video/*`
   open a block that blanks everything to the next `*/`, after which the scan
   asserts against a blank and **passes**. Now uses `lib/strip-comments`.

It now parses the update object and reads it, which is boring and right. A third
test walks the whole `app/` tree so a NEW soft-delete path cannot be added
without this file noticing.

| Sabotage | Caught |
|---|---|
| drop the release from `removeGuestAction` (the original bug) | ✅ 2 tests |
| release AFTER the soft-delete instead of before | ✅ |

Verified: typecheck ✅ · lint ✅ · 12,061 unit tests ✅ · all 29 CI guards ✅

SPEC IMPACT: None.
