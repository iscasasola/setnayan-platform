## 2026-07-29 · fix(packages): unticking a package line no longer makes it vanish — removal is reversible

`visibleLineTree` dropped removed roots outright, so an unticked line disappeared
for the session (close() keeps `removedIds`), every removed-state style in the
lock modal — the strikethrough, the dimmed row, "+₱X back to budget" — was
unreachable dead code, and the copy's invitation to experiment was a one-way
door. A removed non-required root now stays in the tree marked `removed: true`:
the modal's existing styling lights up untouched and the line can be re-ticked.

The mark is display-only, threaded through the money boundary explicitly: both
charge walkers (`chargeableOptionIds…`, `chargeableExtraHours…`) skip removed
entries; a removed root reveals no follow-ups and none of its options are in
force; `visibleLines`/`visibleLineIds` (and through them
`unfinishedChoiceLines`, so a removed pick-N line can't block the lock CTA)
keep pre-reversibility booking semantics; the picks-summary builder keeps
removed roots out of the build lines (they list under "removed" only). Six new
tests incl. a remove→re-tick money roundtrip on both pricer branches;
neutralisation-probed (reverting the keep-visible change fails a named test).

SPEC IMPACT: None
