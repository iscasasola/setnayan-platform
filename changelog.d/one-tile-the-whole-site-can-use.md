## 2026-08-21 · refactor(ui): one tile the whole site can use

The three-size tile that makes the person's page read like a story — a lead
card with a picture, a medium card, a bare line — was written inside that one
page and could not be used anywhere else. Pulled out as `ScaledTile` /
`ScaledTileList` in `app/_components/scaled-tile.tsx`, with its 26 `.sn-*`
rules moved into `globals.css` so any surface can adopt it.

The person's page now renders through the shared component. Nothing about how
it looks changed — the private CSS it used to carry is deleted (0 leftovers)
and the page hands the tile its items as data.

`weighYearWithFloor` still decides the sizes, so the rule the owner cares
about is unchanged: a year that holds only bare lines promotes its newest one,
so no year ever reads as an empty list.

### Guard: a destination handed to a shared tile is still a destination

`scripts/port-controls.mjs` could not see an `href:` whose value is a bare
template literal — the exact shape a caller writes when it hands a link to a
shared component as data. The moment the person's page adopted the tile, the
guard reported `/u/[seg]/c/[seg]` as unreachable. It is not; the tile renders
it.

Widened the extractor rather than regenerating the baseline. The file's own
docblock already warns that regenerating on a reported "loss" is how a blind
spot becomes a recorded lie the guard then defends — and this is the third
time this pattern has bitten (after `PageMasthead`'s `back` prop and the
doorway kit's `primary={{ href: … }}`).

Measured: the widened extractor sees **879 destinations, up from 850** — 29
links across the app that no guard was watching before.

The baseline is deliberately NOT regenerated in this PR. A regeneration here
would also absorb 6 destination removals that arrived from other sessions'
merges since the baseline ref, which nobody in this change has reviewed.

### Tests

`scale-carries-meaning.test.ts` repointed at the shared component. Three of its
assertions were decoration and are fixed: one used `match` where it needed an
occurrence count, one mutated a comment, and one matched `.sn-lead` as a prefix
of `.sn-lead-a`. All re-mutated RED by occurrence count before → after.

974 app tests pass · typecheck 0 errors · radius lint passes.

SPEC IMPACT: None.
