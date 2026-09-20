## 2026-09-20 · fix(ugat): both-ends baseline pays down 81 rows, and its floor stops punishing that

`ugat-both-ends.baseline.txt` carried 125 inherited orphan rows from the #5625/#5637/#5638
freeze, but retirement PRs and S41c's `result-dropped-silently` batches had already fixed most of
them — a paid-down row only ever printed a console note ("N baseline entries are now paid down —
delete them"), and nothing forced anyone to act on it. Re-ran the checker itself
(`tests/db/ugat-both-ends.db.test.ts`) rather than eyeballing: 81 of the 125 rows are now fully
fixed and deleted; one more (`lib/venue-recommendations.ts · from:venue_directory.select`,
UNCLASSIFIED tier) is only *partly* fixed — 2 of its 3 silent call sites now `console.error` the
result, but a pre-migration retry fallback still returns `[]` on an unread `nerr` — so its count
moved from 3 to 1 instead of being deleted. Cross-checked with a second, independent mechanism:
`findSilentDrops` from `lib/ugat/both-ends.ts` is pure source-text scanning with no DB dependency,
so it was run directly (no replay) against every current source file and it agrees exactly: 11
live `result-dropped-silently` orphans, same keys, same counts. **125 → 44 real rows.**

Per-tier: MONEY 10→10, BOOKING 6→6, COUPLE 72→13, SUPPLIER 4→4, ADMIN 6→6, UNCLASSIFIED 27→5.
Nothing was paid down yet in MONEY, BOOKING, SUPPLIER or ADMIN — the debt that remains is
concentrated there and in the 5 UNCLASSIFIED rows; COUPLE absorbed nearly all of the cleanup
(59 of 81 rows).

**The floor that guarded the file's size punished this cleanup.** `assert.ok(baseline.size > 100)`
existed only to catch a truncated or emptied file, but a floor phrased as "at least N" cannot
distinguish an honest shrink from a truncation — regenerating on the merged tree here would have
tripped it (44 ≤ 100) while being exactly correct. Replaced it with an EXACT match against a new
`EXPECTED_BASELINE_ROWS` constant declared beside `BASELINE`, which must be bumped by hand in the
same commit as any edit to the baseline file (the same shape as `MODEL_CHOICE_CAP` for admin pages
— a number nothing derives, that a person must move on purpose). This still catches everything the
old floor caught (a truncated or emptied file changes `baseline.size` without the constant moving)
plus what it never did (a hand-added line — forbidden by the file's own header — also changes the
size without the constant moving). Added a new DB-free test,
`'the row-count floor rejects a truncated, emptied, or hand-shrunk baseline — no DB needed'`, that
sabotages the real file three ways (truncate to half, empty to header-only, drop exactly one live
data line) and asserts each parses to a size that does NOT equal `EXPECTED_BASELINE_ROWS` — all
three fire red as designed.

Re-ran the full `test:db:ci` suite plus the Ugat trio (`ugat-both-ends`, `ugat-schema-claims`,
`ugat-concept-coverage`) and `exposure-freeze` — all green.

SPEC IMPACT: None — this is repo-internal debt bookkeeping, not a product surface.
