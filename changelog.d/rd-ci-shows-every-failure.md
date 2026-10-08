## 2026-10-08 · chore(ci): one push shows every failure — the required check is a gate over parallel jobs

Owner, verbatim: *"my issue is that we create locally, then when you go to github you do not make it
properly and we end up repeating again."*

**What was wrong.** The required check `typecheck + lint` was one job whose steps ran one after another —
typecheck, eslint, the unit suite, the DB replay, the duplicated-rule guards, the root map — and it stopped at
the first step that failed. Everything behind that step was skipped, so its failures stayed hidden until the
first was fixed and another whole round (about 80 minutes) had run. PR #6416 needed three rounds for two
one-line faults: a unit guard hid a DB guard behind it.

**What changed** (`.github/workflows/ci.yml`).

- The same steps now run as separate jobs, side by side: `guards` · `typecheck` · `eslint` ·
  `unit tests (n/3)` · `DB replay (n/6)` · `source guards`. None can stop another.
- The job named **`typecheck + lint`** — the name branch protection requires — is now a gate: it `needs:` all
  of the above, always runs (`if: always()`), and is red unless every one of them finished exactly `success`
  (`scripts/ci-gate.mjs`). `failure`, `cancelled` and `skipped` are all red; a skipped required check would
  otherwise count as passed.
- The unit suite and the DB replay are sharded with node's own `--test-shard` (sorted files, dealt
  round-robin, so the shards together run every file once). The flag is read from `TEST_SHARD_FLAG` by the
  package scripts `test:unit` / `test:db:ci`, because node ignores it after the globs (measured).
- Each test shard names every failing test in the run summary and as PR annotations, and FAILS if it ran
  nothing (`scripts/ci-test-summary.mjs`) — "0 tests, 0 failures" is not a pass.
- A newer push to the same pull request cancels that PR's run in progress. A push to `main` is never
  cancelled (each non-PR run has a concurrency group of its own).

**What did not change.** Which checks are required (13, confirmed against branch protection), and what each
means: every required name is still the name of exactly one job, and `typecheck + lint` is red for everything
it was red for before. No guard, test or budget was removed, skipped or loosened; the blocking-guard
aggregator and every trap documented in the workflow's comments are kept.

**What holds it in place.** `scripts/lint-ci-gate.mjs` (a new blocking guard step) fails when a job is in
nobody's `needs:` and is not itself required, when a required name is renamed or duplicated, when the gate
loses `if: always()` or reads a subset of `needs`, when a step the gate used to run is run by no job it needs,
when a shard list skips a number or lacks `fail-fast: false`, when a piped test step lacks `shell: bash`
(no pipefail — a killed run would read as success), and when the shard flag sits after the globs.
`scripts/ci-gate.test.mjs` checks each rule against the real workflow with one thing broken.

No application code changed.

SPEC IMPACT: None
