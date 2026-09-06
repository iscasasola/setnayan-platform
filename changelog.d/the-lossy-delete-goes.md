## 2026-09-06 · refactor(guests): the delete that lost the chair is gone, not merely unused

Yesterday's change moved the phone swipe onto `bulkSoftDeleteGuestsForUndo`,
which captures the `event_seat_assignments` rows it releases so an undo can
re-place them. That left `bulkSoftDeleteGuests` — the version that releases the
seat WITHOUT capturing it — with **zero callers anywhere in the tree**.

A dead lossy delete is a waiting re-wire, and "unused" is a state anybody undoes
in one line. Its gates were verified byte-equivalent to the survivor's first
(same select, same couple block, same RSVP block, same messages), so ~113 lines
went and nothing was lost but a second copy of one rule.

**Its docblock was NOT lost with it.** The owner directive of 2026-05-23, the
reasoning for why "RSVP set" means anything other than `pending`, and the
FK-cascade explanation for why the seat row must be deleted explicitly all moved
onto `bulkSoftDeleteGuestsForUndo`, along with a note on why there is now only
one of these.

**Seven stale references fixed** — more than the three this started as:
- 3 comments in `guest-list-multiselect.tsx` naming the removed action as the gate
- 1 in `lib/guest-optimistic.ts` crediting it with the seat release
- 2 INSIDE `groups-actions.ts` ("Same pre-flight as bulkSoftDeleteGuests",
  "bulkSoftDeleteGuests drops these with no capture") that the deletion itself
  turned into references to nothing
- 1 broken cross-reference in `claims/actions.ts` pointing at "the note above
  `bulkSoftDeleteGuests`" — a note that no longer existed under that name.
  Deleting code silently broke a pointer in a different file; a grep for the
  symbol found it and nothing else would have.

The four surviving mentions are deliberate: they are the narrative explaining
why only one delete remains.

The guard was strengthened rather than left as it was. It asserted this page did
not CALL the lossy action; it now asserts the export does not EXIST, and that
the survivor still does (so it cannot pass by pinning a ghost).

Suite 62/62 · route-scoped `tsc` exit 0 across the whole `[eventId]` tree ·
`lint-one-comment-stripper` and `lint-no-engineering-notes-in-ui` clean.
Mutations, each RED: the lossy action reintroduced → 1 · the survivor renamed → 1.

⚠ The first typecheck run reported 3 errors in files this change never touched
(`opentype.js` / `tz-lookup`, TS7016). They were an artifact of the scoped
tsconfig omitting `types/**/*.d.ts`, not a regression — a false FAILURE, the
mirror of the stale-run false pass recorded earlier. Re-run with the ambient
declarations included: exit 0.

SPEC IMPACT: None. Dead code removal plus comment accuracy; no behaviour change.
