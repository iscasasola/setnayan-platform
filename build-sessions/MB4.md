# MB4 — The palette-style engine lands as a real lib

**Goal:** the verified OKLCH engine moves from prototype markers into `apps/web/lib`, **with its
verification moving with it.**

**Model:** Opus · high effort — the correctness core of the whole feature. The six-rank ordering
is a proven invariant, and translation is precisely where invariants die.
**Size:** 1 day. **Depends on:** MB0 + **the owner's docblock decision (below).**

## 🛑 Blocked until the owner answers

`apps/web/lib/color-space.ts`'s docblock locks CIELAB as "the one perceptual colour space".
The verified palette engine is **OKLCH**.

**Recommendation: amend the docblock, do not re-derive the engine.** The six-rank visibility
ordering and the fuzz results were all verified in OKLCH; re-deriving in CIELAB would throw away
the verification to satisfy a comment. Amend it to state the boundary explicitly:

- **CIELAB** — colour *naming* and ΔE audits (unchanged)
- **OKLCH** — the palette-style engine only
- one importer each, plus a guard pinning that no third space ever appears

This is the single decision most worth making today: everything colour-shaped queues behind it.

## Delivers

- `spec/palette-styles.mjs` ported as a typed lib — `deriveBoard`, `deriveVenue`,
  `normalizeMajors`, `visibility`, `VISIBILITY_RANK`
- The three styles: *Our colours only* / *Softer room, richer people* / *Room and people*
- The invariant harness rewritten as **repo tests** — `spec/run.ts` invariants, `touched.mjs`,
  `fuzz-palettes.mjs`, `namer-check.mjs`'s 38-colour parity. The verification becomes permanent
  rather than a scratchpad memory.

## Verify

- `pnpm exec tsc --noEmit` from `apps/web`
- **the rank-ordering invariant suite green** — 97 ordered pairs, 0 failures
- the fuzz harness as a repo test: no board throws, no role holds the same hex twice
- the namer parity check
- a guard that no third colour space appears
- **sabotage the invariant suite itself** — swap two ranks, confirm red. An invariant suite that
  has never gone red has never been tested.

## Owner decides first

The docblock amendment.
