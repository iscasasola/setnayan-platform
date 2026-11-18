## 2026-11-18 · ci: fold nine seconds-long jobs into `guards` — one run starts 15 jobs, not 24

GitHub Pro runs at most 40 jobs at once on this account (GitHub Support, 2026-11-18); one `ci.yml` run started 24, so only one or two PRs could check at a time and ~30 open PRs queued for hours.

- `source guards`, `secret scan`, `migration timestamp guard`, `lint bottom-nav template`, `lint nav icon source`, `lint entitlement gates`, `lint guest legibility`, `lint nested forms` and `lint exposure baseline` are now steps of the `guards` job — each `continue-on-error` with its own `id`, its own named step and its own line in the aggregator, `if: !cancelled()` so no red step hides another.
- Eight of them are REQUIRED checks by name. The new last step of `guards` (`scripts/ci-report-checks.mjs`) posts each back to the PR head commit under its exact name through the Checks API with the job's `GITHUB_TOKEN` (the GitHub Actions app, the app branch protection pins them to). Fail-closed: green only when every step it stands for is exactly `success`. Branch protection is untouched.
- `scripts/lib/ci-shape.mjs` / `lint-ci-gate`: a required name may now be a job name OR one report line, still exactly once; new rules catch a report step that can be skipped, posts to the merge commit, lacks `checks: write`, or reads a step id that does not exist. Sabotage tests in `scripts/ci-gate.test.mjs`. Preflight classifies the reporter as infra (never runs it locally).
- Unchanged: unit tests 3 shards, DB replay 6, typecheck/eslint/build/bundle-size separate jobs, the `typecheck + lint` gate and its draft behaviour.
- Per PR push: ci.yml 24 → 15 jobs; with e2e + lighthouse 26 → 17.

SPEC IMPACT: None
