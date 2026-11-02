## 2026-07-25 · chore(changelog): migrate stranded apps/web + apps fragments to the root dir, add a guard

`scripts/changelog-collect.mjs` reads **only** `<repoRoot>/changelog.d` (`const fragDir = join(root, 'changelog.d')`). Two orphan fragment directories had accumulated **172 fragments** that the collector never saw — never folded into `CHANGELOG.md`, never deleted, and indistinguishable from healthy pending fragments. The failure mode is pure silence: no error, no warning, no missing file, which is why it ran unnoticed for months.

- **Migrated 172 fragments into the root `changelog.d/`** via `git mv` (all 172 land as `R100` pure renames — byte-identical):
  - `apps/web/changelog.d/` → 167 fragments
  - `apps/changelog.d/` → 5 fragments (a **third** orphan dir found during the sweep, beyond the two originally reported)
- Root `changelog.d/` goes **1511 → 1683 files**; total fragment bytes unchanged at **3,688,338**. Zero basename collisions between any pair of directories, so nothing could be overwritten. Both orphan directories are removed (neither had a README, and there is no `apps/web/CHANGELOG.md`, so neither served a per-package purpose — they were cwd accidents).
- **New guard `apps/web/scripts/lint-changelog-dir.mjs`** fails the build if a `changelog.d/` directory exists anywhere but the repo root, reporting each offender with its stranded-fragment count. Deliberately generalized past the two known directories — a guard hardcoded to `apps/web` would have stayed green on `apps/changelog.d`. Filesystem walk rather than `git ls-files`, so it also catches an orphan created but not yet committed. Wired as `lint:changelog-dir` in `apps/web/package.json` and as its own `lint-changelog-dir` CI job in `.github/workflows/ci.yml`, matching the 11 sibling guards (pure node, no install; not a required check until the owner promotes it via branch protection).
- `changelog.d/README.md` now states that the documented `changelog.d/<branch-slug>.md` path is relative to the **repo root** and names the guard that enforces it. A doc line alone was not enough: the README and `CLAUDE.md` both already said "create the file here" for the entire period the 172 fragments piled up — documentation cannot catch a mistake whose only symptom is silence.

`CHANGELOG.md` is untouched: folding these fragments in is a release action (`node scripts/changelog-collect.mjs`), not this PR's job. The collector was verified by inspection only — the migrated files are flat `*.md`, which is exactly the shape it globs, and it skips `README.md` case-insensitively.

Pre-existing oddity noted, not fixed: `changelog.d/fix-table-delete-crash-hotfix.md` is 0 bytes (already empty on `origin/main` before the move), so it will contribute an empty entry when the collector next runs.

SPEC IMPACT: None — repo tooling and changelog plumbing only; no product surface, schema, pricing, or SKU change.
