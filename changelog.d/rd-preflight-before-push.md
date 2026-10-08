## 2026-10-08 · chore(ci): `pnpm preflight` — the cheap faults are found on the builder's machine, before the push

Owner, verbatim: *"my issue is that we create locally, then when you go to github you do not make it
properly and we end up repeating again."*

**What was measured that day.** One CI round was about 80 minutes (typecheck ≈ 4 · lint ≈ 1.5 · unit ≈ 19 ·
DB replay ≈ 52), and the required job stopped at its first failing step. Seven draft PRs failed it, every one
for a small mechanical fault: a bare number (`numbers-carry-commas`, three times), a label that did not name
its switch, hand-typed selects (`lint:dup-rule`), a `children` prop (eslint), a dropped read result
(`ugat-both-ends`), one word (`the-couple-books-never-locks`), a typed peso figure (`public-price-literals`),
a stale test pin, and a type error left after a compile that was not re-run. PR #6416 took three rounds —
about four hours — for two one-line faults, because the unit guard hid the DB guard behind it.

**What this adds.**

- `scripts/preflight.mjs` (`pnpm preflight`, `pnpm -C apps/web preflight`). For the branch's changed files
  (`git diff origin/main...HEAD` plus uncommitted and untracked) it runs: every cheap guard step of
  `.github/workflows/ci.yml` as CI words it; eslint on the changed files; a one-project `tsc` of the changed
  files and their importers; the unit tests that name or import a changed file; every whole-tree guard test;
  the DB tests that scan source, plus the schema pins when a migration changed. It never stops at the first
  failure, ends with one table (check · result · first failing line · re-run command), exits non-zero on any
  failure, prints its wall time, and lists under `LEFT TO CI` everything it did not run.
- **It keeps no list of its own.** The cheap steps are parsed out of `ci.yml`; the whole-tree guards are
  discovered (a test that walks a directory, imports a helper that walks, or runs a guard script); the pinning
  tests are found through the import graph and by path tail. A guard written tomorrow is in preflight tomorrow.
- **It fails closed.** A killed process is a failure, not a pass. A test file that was asked for and reported
  nothing is a failure (a `[bracketed]` path is a glob that matches nothing — each bracket is passed as `?`
  and every file's result is read back through a reporter, `scripts/lib/preflight-reporter.mjs`). A missing
  `node_modules` is a failure, not a clean run that resolved nothing. A targeted compile that does not fit in
  memory is reported `NOT RUN`, never as a pass.
- `scripts/preflight.test.mjs` — a new step in the required "migration timestamp guard" job. It fails when
  `ci.yml` gains a step nobody classified, so CI and preflight cannot drift apart silently.
- `CLAUDE.md` › Rules for every session › rule 5: run it before every push; paste the table in the PR body.

No application code changed. No guard was weakened, skipped or re-budgeted; no check stopped being required.

SPEC IMPACT: None
