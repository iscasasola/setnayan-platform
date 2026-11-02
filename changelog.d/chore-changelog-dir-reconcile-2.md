## 2026-07-25 · chore(changelog): rescue one fragment the new guard caught on main

Immediate follow-up to PR #3693 (which migrated 172 stranded fragments into the root `changelog.d/` and added the `lint-changelog-dir` guard). PR #3693 and PR `b9b9843c7` ("feat(vendor-pricing): open Papic Challenge to all tiers") merged within minutes of each other. The other branch predated the guard and, because branch protection here is non-strict, it merged while behind — recreating `apps/web/changelog.d/` with one new fragment and turning `main` red on the brand-new check.

- `git mv apps/web/changelog.d/papic-challenge-all-tiers-gate.md changelog.d/` — blob `002c0d98` unchanged, so zero bytes differ; `apps/web/changelog.d/` removed again. Root goes 1685 → 1686 files. `lint-changelog-dir` back to green on `main`.

The guard earned its place inside one merge cycle: without it this fragment would have sat in the orphan directory looking healthy while its content — a flag-dark backend gate plus migration `20271001130000` — never reached `CHANGELOG.md`, exactly as the previous 172 did. Worth noting for anyone landing a branch opened before #3693: rebase on `main` before merging, or the guard will catch the same thing again.

SPEC IMPACT: None — changelog plumbing only; no product surface, schema, pricing, or SKU change.
