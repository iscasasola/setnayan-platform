## 2026-09-03 · feat(mood-board): the progressive colour recommender lands as a real lib

`lib/palette-recommender.ts` ports the scratchpad's Setnayan AI suggestion-chip math
(`harmonySuggestions` / `shadeSuggestions` / `candidatesFor` / `dedupeSuggestionsByName`, from
`atelier-board.html`) as a typed lib with 15 unit tests, and wires it into section 02's Palette
editor (`palette-editor.tsx`'s `addColor('reception')`), replacing the static
`DEFAULT_PALETTE_SUGGESTIONS.reception` modulo-cycle — which repeated the Dominant colour by the
fourth slot and never once looked at what the couple had already picked — with genuinely
cumulative suggestions: `candidatesFor` builds its pool from EVERY chosen colour and filters so a
candidate is distinct from ALL of them, not just the latest one. This is exactly the defect the
owner named on 2026-09-03 ("second row does not offer 4th and 5th color").

⚠ **CORRECTION TO THIS SESSION'S OWN BUILD BRIEF (`build-sessions/MB13.md`) — the spec predates
MB4, and the shipped code wins.** The brief calls this "the OKLCH progressive recommender", but
the scratchpad spec it's ported from says otherwise in its own words, right beside the code
(`atelier-board.html`, above its `[PALETTE-ENGINE BEGIN]` marker): *"the HSL set above serves the
drag picker and suggestion chips only, never placement."* `color-space.ts`'s shipped, owner-
approved MB4 docblock is explicit that OKLCH has exactly one importer (`palette-styles.ts`) for
exactly one job — the derivation engine's placement math. This port keeps that boundary: the
colour-wheel math here is HSL, matching what the prototype actually ships for suggestions, not a
second OKLCH importer that would contradict MB4's locked "one importer each." Confirmed
`color-space-has-exactly-two-perceptual-spaces.test.ts` still passes unmodified (0 offenders) — no
new importer was added.

**Gate: reuses `hasChosenMajors` (`lib/mood-board.ts`, MB3), not a parallel signal.**
`progressiveReceptionSuggestion(chosen)` returns `undefined` until `hasChosenMajors({ reception:
chosen })` is true, so `addColor` falls through to the pre-existing static default for the very
first colour — the prototype's "starter five" panel for a genuinely blank board is out of this
session's scope; `page.tsx`'s own comment defers that dismissible starting-palette affordance to
"the palette-style engine landing in MB4/MB5." Sabotage-tested: replaced the gate with an
unconditional path that seeds a default base colour on a blank board — confirmed
`⭐ THE GUARD · stays silent...` red, reverted, confirmed green again.

**MB5 status, checked before starting:** no `claude/mb5-*` PR exists (open or merged) and no file
in `apps/web/app` imports `deriveBoard`/`deriveVenue` from `palette-styles.ts` — section 02's
palette-style chip row and theme-derivation wiring have not landed. A local worktree carrying a
`claude/mb5-the-owners-colour-system-becomes-the-vocabulary` branch name exists but is untracked,
unpushed, uncommitted scratch (`.mjs` probes, `.mb5/`/`.mb6/` dirs) pre-dating MB4's merge, not a
real MB5 deliverable — not branched from. Branched from `origin/main` directly instead, wired into
the legacy (pre-MB5) `PaletteEditor`, which is the only section-02 surface that currently exists
and ships today.

Verified: `pnpm exec tsc --noEmit` from `apps/web` clean; `palette-recommender.test.ts` (15/15);
the rank-ordering invariant suite (`palette-styles-rank-ordering-is-monotonic.test.ts` and the
other four `palette-styles-*.test.ts` guards, 63/63 combined with `mood-board.test.ts` and the
colour-space guard) unaffected — no palette-styles.ts or color-space.ts file was touched.

SPEC IMPACT: None. No locked decision changed — MB4's OKLCH/HSL boundary is upheld, not revised.
