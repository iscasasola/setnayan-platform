# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-04 · fix(guest-site): the browse menu lost two tabs it should have offered

**Caught by the owner opening the sample wedding on his phone** — a rich page with only *"Home"* and *"Me"* in the bar. Nothing failed anywhere.

**What happened, and it is worth reading.** Two changes from 2026-08-03 disagreed with each other:

- **#4068** added `browsableBodyRenders()` and had it return `false` for the `save_the_date` phase. **That was correct when written** — `phasedBody` rendered the film *instead of* the body, so Details and Story had no anchors and offering them was a dead tap.
- **#4069**, hours later, made the film hand off: under open browse the browsable body now renders **beneath** the film.

So the anchors started existing, and the guard — still saying `false` — began hiding tabs that were now perfectly good. **The tests kept passing because they asserted the old truth.** A guard that was exactly right was made wrong by a change somewhere else, and nothing anywhere went red.

**The fix.** `save_the_date` now follows the same rule as `editorial`: the takeover holds, and under open browse the site persists below it, so both return `plan.openBrowse`. A new test pins the two phases as **equal**, since the drift happened precisely because they were written as separate cases.

The docblock and the corrected assertion both carry the history, in the file where the next person will hit it: **this predicate must mirror `phasedBody`; if you change one, change both.**

Verified: 6,325/6,325 unit tests, `tsc --noEmit` clean. No migration, no flag.

SPEC IMPACT: None — restores the intended behaviour of #4068 + #4069 taken together.
