## 2026-10-05 · test(last-seen): the never-money check ignores the save clock

`lib/last-seen/last-seen.test.ts` test 2 scanned the whole stored record — including `savedAt`, a millisecond clock — for money figures, so a clock like `1791149928869` (it contains "499") failed CI at random (seen on #6349's first run). The check now drops only `savedAt` and still scans every other stored field. Proven: with the clock forced to `1791149928869` the old check fails and the new one passes; sabotage (`guardSnapshotHtml` returning its input) still turns the test red.

SPEC IMPACT: None.
