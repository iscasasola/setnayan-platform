## 2026-09-26 · feat(event-hub): a locked navigator tile says where it is edited

The Maker navigator's fixed sections either open a Maker tool or — when there is
nothing to edit in the Maker — say where the content comes from, with a link. The
entourage tile (which did nothing when tapped) now reads "Nothing to edit here. It
comes from your guest list" with "Open your guest list →". `MAKER_FIXED_TOOL` moved
from `editor-shell.tsx` into `lib/maker-scene-list.ts` beside the new
`MAKER_FIXED_SOURCE`; `lib/every-fixed-section-says-where.test.ts` fails if any fixed
section has neither (sabotage: dropping the entourage line → 2 fail).

SPEC IMPACT: None (implements DECISION_LOG 2026-09-25 "THE NAVIGATOR ADAPTS TO EVERYTHING").
