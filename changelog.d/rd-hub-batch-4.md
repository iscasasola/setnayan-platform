## 2026-10-13 · release(hub): Event Hub batch 4 — Maker weight, entrance chart, Prints + seat counter, follow-ups, leftovers, instant Undo, Scrub on

One release branch joining seven finished draft PRs onto main 670cdba1d, merged `--no-ff` in this order:
#6513 (Maker first-load dedupe) · #6503 (entrance seating chart) · #6520 (Maker Prints + seat counter) ·
#6515 (batch-3 follow-ups) · #6518 (hub leftovers) · #6525 (instant Undo; contains #6513) · #6517 (Scrub out turned on; carries #6496).
#6517's own CI showed only the Maker first-load budget red (507.0/507.0, the same number main itself fails at since
670cdba1d); #6513, first in this batch, clears it.

No textual conflicts. Generated files regenerated against the join (never hand-merged):
`lib/ugat/screens.generated.json` (`pnpm ugat:screens` — the seating editor's new door to `/seating/chart`) and
`scripts/port-control-baseline.json` (`pnpm port:baseline`, additions only).

Each member keeps its own fragment; this one only records the join.

SPEC IMPACT: None (each member's own fragment carries its spec impact).
