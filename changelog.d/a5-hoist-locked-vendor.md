# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-10 · fix(bench): a locked vendor leads its category instead of sorting like a candidate

Owner: *"yes, hoist it."*

`bench-sort.ts` had **no reference to `locked` anywhere in the file**. A locked vendor sorted by
the same lens as everyone else, so it could sit at position 3 behind two candidates the couple
will never choose — and in a `hardSingle` category ("This category holds exactly one — locking
fills the slot") the decision was already made, leaving the answer buried behind dead cards.

🔑 **The bench already announced the lock in FOUR places above the carousel** — the Coverage Strip
tile (`.ctile.st-locked`), the folder-head pill (`● N locked · N to decide`), the category-head
lock line (`lockedNamesLine`), and the card's own badge. The carousel was the one surface still
ordering as if no decision had been made. This makes it agree with the other four.

`hoistLocked` is a stable partition applied to all three lenses (Best fit · Lowest price · Top
rated), so lens order survives untouched underneath and two locked vendors keep their order
relative to each other.

⚠ **Reason pills are assigned BEFORE the hoist, deliberately.** "Lowest price" means *this card is
the lowest price*, not *this card is first* — a hoisted lock pushing it to position 2 leaves the
pill true. Re-deriving reasons after the hoist would silently turn every superlative into a claim
about position; a test now pins that the pill stays with the card that earned it.

Five new cases in `bench-sort.test.ts` (all three lenses · stability · two-locked ordering · the
pill · no-locked-is-unchanged). Mutation-checked: neutralising the hoist turns 4 of 5 RED, the
fifth being the non-regression guard that must hold either way. Restored, 41/41 green.

🔁 **This is a re-landing.** Commit `e67420406e` carrying this fix shipped on
`origin/claude/plan-name-overwrites` on 2026-09-06 but its PR (#5222) merged into `main` without
it — `git cherry origin/main e67420406e` still marked it `+` on 2026-09-10. Cherry-picked here
against `bench-sort.ts`'s subsequent refactor (`orderByBenchSort`, single ordering rule shared by
the bench carousel and the inline "More in {category}" row): `hoistLocked` now wraps the
already-ordered `arr` instead of re-sorting it, since the sort itself moved into
`orderByBenchSort`.

SPEC IMPACT: None — this restores a fix already recorded against the 2026-09-06 DECISION_LOG row;
no new decision, no SKU, price, schema or migration change.
