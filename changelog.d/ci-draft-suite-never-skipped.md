## 2026-11-28 · fix(ci): a PR pushed as a draft is not stuck BLOCKED after it is marked ready

Batch PR #8465 sat BLOCKED after "Ready for review" with every required check green. Its head was pushed while it was a draft, so the one job in `lighthouse.yml` skipped and that workflow's check suite concluded "skipped". GitHub filed the required checks that `scripts/ci-report-checks.mjs` posts by name (secret scan, migration timestamp guard, bundle size check, the lints) into that suite, and branch protection does not count runs in a skipped suite. Re-running replayed the draft event and skipped again. Same trap `auto-merge.yml` already fixed for #8098.

- `lighthouse.yml` and `e2e.yml` each gain a `suite-is-never-skipped` job that always runs, so their suites conclude "success". It gates nothing and is not a required check; the required `lighthouse` and `playwright e2e (chromium)` jobs are unchanged.
- `lint-ci-gate` rule k: any workflow that runs on `pull_request` must have at least one job with no `if:` and no `needs:`. Held by three new tests in `scripts/ci-gate.test.mjs`, each mutation-checked.

SPEC IMPACT: None.
