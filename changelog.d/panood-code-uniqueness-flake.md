## 2026-07-12 · fix(test): de-flake the screen-pairing-code uniqueness test

`generateScreenPairingCode is unique across calls` drew 5000 random 6-char codes and asserted EXACTLY zero collisions. From a 32⁶ (~1.07e9) space the birthday paradox expects ~0.012 collisions, so a perfect RNG still fails ~1.2% of runs — this single test was intermittently failing the required `typecheck + lint` check and blocking otherwise-green PRs from auto-merging (it is what held PR #3144). Replaced the exact-uniqueness assertion with a tolerance of ≤5 collisions in 5000 draws: P(≥5) ≈ 2e-12 so it never flakes, while a genuinely broken generator (constant → 4999 collisions, or a shrunken space) still fails loudly. Generator unchanged.

SPEC IMPACT: None (test-only reliability fix).
