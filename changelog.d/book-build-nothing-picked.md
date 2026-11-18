## 2026-11-16 · fix(build): "Book this build" with nothing picked says so, with no ✓

Walk EB-173 (owner, "Fix them too"): with nothing in the build, Book this build showed a ✓ toast, "Nothing to book
— every pick is booked or already asked". That was untrue and read as success.

Now `nothingToBookNote` (lib/book-this-build.ts) decides what the button says when there is nothing to send:

- An empty build: "Nothing picked yet — add a supplier to your build first", as a note with no ✓.
- Picks that are all booked or already asked: the ✓ line, now only when it is true.

Both callers (the event's Suppliers page and the suppliers lab) pass `inBuild`, the number of lines holding a pick
or a booking.

Guard: `lib/an-empty-build-is-not-told-it-is-booked.test.ts`. It was broken twice to confirm it fails: the empty
case dropped from the rule, and the toast tone forced back to ✓. There is no new server action and no migration.

SPEC IMPACT: None.
