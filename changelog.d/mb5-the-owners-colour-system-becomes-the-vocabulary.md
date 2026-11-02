## 2026-09-03 · feat(colour-names): the owner's colour system merges into the naming vocabulary, without the regressions a swap would have shipped

`WEDDING_NAMES` (`apps/web/lib/color-names.ts`) grows from 69 to 139 curated
entries by MERGING in 69 hand-picked swatches from the owner's 336-swatch
`color-vocabulary.generated.ts` system — a wholesale swap was measured and
refused because it re-pointed 38 already-shipped words to a different colour
under the same name, converged 56 near-white and 28 near-black swatches into
perceptually indistinguishable clusters, and dropped "Moss" and "Burgundy"
the owner had just corrected.

- All 38 name collisions between the two tables KEEP the shipped hex — the
  generated table's alternate for the same word is simply not imported.
- Near-white (L* ≥ 95) and near-black (L* < 15) generated swatches are
  excluded from import entirely (measured pairwise ΔE76 as low as 0.35
  inside the near-white band).
- The generated system's `abo`/`ash` and `ulap`/`cloud` neutral families are
  one grey ladder under two names (ΔE76 0.6–5.9 at every step) — neither is
  imported; the shipped neutrals already span the axis.
- `Emerald` repoints from `#059669` (ΔE 24.5 from the real gem colour) to
  `#5AC275` (the generated system's "Leaf Green", ΔE 4.5 from it).
- `Burgundy` (`#7A1F2B`) is retired — it sat ΔE 4.1 from the generated
  system's `Garnet` (`#842334`), i.e. the same colour under two names.
  `Garnet` replaces it in the table.
- A new `COLOR_NAME_ALIASES` layer in `color-names.ts` redirects the WORDS
  `burgundy` → Garnet and `crimson` → Carmine in the name → hex direction
  only (`namedColor`/`hexForColorName`); the hex → name direction is
  unaffected — CSS's own "Crimson" (`#DC143C`) still names itself.
  `lib/theme-text-intent.ts`'s `COLOUR_WORDS` dictionary and its
  Christmas/Valentine/fiesta colour suggestions were updated from "Crimson"
  to "Carmine" to match, rather than relying on the alias to paper over a
  literal string mismatch.
- Coverage of the sRGB cube at the shipped `WEDDING_NAME_RADIUS_DE` (16)
  rises from 44.3% (69 entries) to 65.0% (139 entries), re-measured on a
  32,768-hex sweep, with the "wins on lightness alone" rate still at 0.14%
  (well under the existing test's ceiling).
- Nine new regression/alias tests added to `color-names.test.ts`, including
  a dedicated Moss anchor (sabotage-tested: breaking it and reverting it
  during development correctly flipped 3 tests red then green) and a
  near-white/near-black convergence guard.

SPEC IMPACT: None — this is a naming-vocabulary change inside the shipped
`color-names.ts`/`color-vocabulary.generated.ts` pair, not a new decision
requiring a corpus update. The generator (`scripts/gen-color-vocabulary.mjs`)
and its source (`scripts/color-system.md`) ship alongside as the record of
where the 336-swatch system came from.
