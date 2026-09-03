## 2026-09-03 · feat(mood-board): the palette-style engine lands as a real lib

Ports the mood-board's palette-style engine — `deriveBoard` / `deriveVenue` / `normalizeMajors`
/ `visibility` / `VISIBILITY_RANK` and the full six-rank visibility ladder — from the prototype's
`spec/palette-styles.mjs` into `apps/web/lib/palette-styles.ts`, a typed lib. Three styles: *Our
colours only* (`simple`) / *Softer room, richer people* (`depth`) / *Room and people* (`complex`).

**The engine is OKLCH, not CIELAB** — `apps/web/lib/color-space.ts`'s "one perceptual space"
docblock is amended (not overridden) to add an OKLCH section, `palette-styles.ts`'s sole
importer. A full CIELAB re-tune of the same engine was built and measured to need a chroma/hue
threshold that moves across the operating window (36% chroma spread across hue sectors; the
warm-arc boundary swings 107.5°→112.75°) and measurably emitted 7 cool colours on all-warm
palettes where OKLCH emits 0. `color-space-has-exactly-two-perceptual-spaces.test.ts` fingerprints
both conversion matrices and fails if a third space ever appears outside `color-space.ts`.

**Three fixes carried over from the prototype's `atelier-board.html`, not present in
`spec/palette-styles.mjs`** despite that file calling itself "FINAL derivation" — found by diffing
the two prototype copies line-for-line after `spec/palette-styles.mjs` threw on the fuzz harness's
own all-pale-trio fixtures: (1) `rankPrimaries`'s REDUCED RESULT tier (an all-bridal-white palette
now falls back to the couple's own majors with gates waived, reported via `__meta.reduced`,
instead of throwing), (2) `ceremony` dedupes its two swatches, (3) exempt roles (bride/groom)
dedupe theirs. Diffed the two prototype files after normalizing comments/exports — no other
behavioural difference exists between them. **Confirmed zero emitted-colour drift**: the ported
TypeScript, compared hex-for-hex against the (fixed) prototype engine, matches on all 27 fixture
boards, all 4 all-pale trios × 3 styles, and the full 1800-board fuzz corpus — 0 diffs.

The invariant harness moves with the engine, as repo tests:
- `palette-styles-rank-ordering-is-monotonic.test.ts` — the six-rank ordering, 97 ordered pairs /
  0 failures, plus determinism, bridal/child-floor, and grey-theme-leak checks. Sabotage-verified
  during this session (disabling the descending-ceiling constraint) — confirmed red with real
  inversions listed, then reverted; not shipped.
- `palette-styles-touched-roles-are-never-written.test.ts` — `touchedRoles` is honored and pure.
- `palette-styles-fuzz-never-throws-or-duplicates.test.ts` — 1800-board deterministic fuzz (fixed
  seed) plus the four named all-pale trios: 0 throws, 0 duplicate swatches on any ranked role.
- `palette-styles-warm-arc-guard-reads-the-emitted-hue.test.ts` — `isWithinWarmArc` takes only the
  emitted hex (no "requested hue" parameter exists to check by mistake), sabotage-tested with a
  colour whose real hue sits outside the arc.
- `palette-styles-attire-library-namer-parity.test.ts` — 22 of 38 ATTIRE_LIBRARY colours don't
  match `nearestColorName`'s CIELAB vocabulary; pinned as a baseline (two independently-tuned
  naming tables, not a bug), fails on any NEW divergence.

Full `apps/web` unit suite (12,482 tests) re-run clean after the port; `tsc --noEmit` clean.

SPEC IMPACT: DECISION_LOG.md row added (`~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`,
2026-09-03, "OKLCH JOINS CIELAB AS A SECOND, PERMITTED PERCEPTUAL COLOR SPACE") — the docblock
amendment is itself the spec-impacting decision.
