# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-07 · fix(bench): every tile the bench renders explains itself — and the guard now faces the right universe

Owner, reading the live bench: *"Wedding Singer has no ⓘ."* One glance found what a guard shipped
hours earlier could not.

### The guard was aimed at the wrong set

Yesterday's ⓘ work measured coverage over `VENDOR_CATEGORIES → tileForCategory` — **45 tiles** — and
reported **"45 of 45"**. The bench renders `WEDDING_TILE_ORDER` — **78 tiles**. So the guard passed
while **30 categories were silent**, among them *Wedding Singer*, *Officiants*, *Accommodation*,
*Livestream*, *Filipiniana & Barongs*, *Dessert*, *Food Cart* and *Trophies & Awards*.

🔑 **A guard aimed at the wrong universe is worse than no guard: it reports coverage it never
checked.** Demonstrated by mutation — with the guard restored to its original 45-tile set, deleting
`wedding_singer`'s hint produces **no failure whatsoever**. The measurement and the defect never
overlapped.

### Fixed

- **30 new tile hints**, taking the bench from 48/78 to **78/78**.
- The guard now measures `WEDDING_TILE_ORDER` and asserts `>= 70` tiles, so a collapse of the set
  itself is caught rather than silently shrinking what "all" means.
- **NEW second guard:** every tile a considered vendor can LAND on (the pick enum's bridge) must be
  inside the bench's set — otherwise a saved pick sits in a category the bench cannot draw.

⚠ **Copy authorship:** the owner's standing preference is that product copy is drafted by Fable.
Fable was rate-limited at the time (*"You've reached your Fable limit"*) and the owner said not to
wait, so these 30 lines are Claude's, written to the established register and **flagged for the
owner's review**. They are not Fable's work and should not be assumed vetted.

Voice held to the existing pattern — the picture first, then a practical cue — and the guards that
ban exclamation marks, clichés, scarcity wording and dropped booking timings all still pass.

### Tests

12 in `category-hints.test.ts` (10 existing, 2 reworked/new). Mutation-checked: dropping any single
tile hint turns the suite RED; **and reverting the guard to its old universe makes that same
deletion invisible**, which is the point.

SPEC IMPACT: None — copy plus a corrected guard. No schema, SKU or price change.
