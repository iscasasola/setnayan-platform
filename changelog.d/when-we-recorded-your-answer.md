## 2026-08-21 · fix(guests): the roster says how many answered, never when

`guests.rsvp_responded_at` is written by **four** paths and was read by **zero**.
It is absent from `GUEST_FIELDS`, so it was never selected, and absent from
`GuestRow`, so nothing could have rendered it. **28 of 36 production guests carry
a value nothing in the product could show.** The roster's only reply signal is a
derived count — *"N of M responded"* — which is a how-many, never a when.

- `rsvp_responded_at` is appended to `GUEST_FIELDS` **at the end** (inserting it
  after `rsvp_status` breaks `guest-note-separation.test.ts`, which pins that
  exact run of column names — sabotage N3 proves it).
- `GuestRow` carries it, documented with both things that are easy to get wrong:
  the writers CLEAR it on pending/maybe, and three of the four are HOST paths.
- The guest-detail page shows **"Answer recorded ⟨date⟩"** under the RSVP field,
  only when there is one.
- New `lib/recorded-at.ts` formats it against a NAMED timezone. An unparseable
  value returns null rather than rendering the string `Invalid Date`.
- New `tests/db/guest-fields-all-exist.db.test.ts` asserts every name in
  `GUEST_FIELDS` is a real column, against the replayed schema. This is the
  `rejected, not thrown` family — and here the penalty is worse than usual:
  `fetchGuestById` turns a missing-relation error into `null`, whose caller
  answers `notFound()`, so one typo silently 404s every guest detail page in the
  product with green CI.

9 sabotages, all verified landed by occurrence count, all RED.

SPEC IMPACT: None.
