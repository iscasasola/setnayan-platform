## 2026-11-28 · fix(ci): a PR pushed as a draft is not stuck BLOCKED after it is marked ready

Batch PR #8465 sat BLOCKED after "Ready for review" with every required check green. Testing the fix on #8524 found two separate traps, and both are fixed here.

1. **An all-skipped suite swallowed reported checks.** Its head was pushed while it was a draft, so the one job in `lighthouse.yml` skipped and that workflow's check suite concluded "skipped". GitHub can file the required checks that `scripts/ci-report-checks.mjs` posts by name into that suite, and branch protection does not count runs in a skipped suite. This is the same trap `auto-merge.yml` fixed for #8098.
   - `lighthouse.yml` and `e2e.yml` each gain a `suite-is-never-skipped` job that always runs. It gates nothing and is not a required check.
   - `lint-ci-gate` rule k: any workflow that runs on `pull_request` must have at least one job with no `if:` and no `needs:`.
2. **A finished draft run's red gate stayed counted.** When the draft CI run finished before "Ready for review", its gate went red. A newer "typecheck + lint" does not replace an older one (#8274), so the red stayed on the commit after the ready run went green. Measured on #8524: all 13 required checks were green and the PR was still BLOCKED.
   - A lone draft gate now posts a PENDING hold (`draftHoldCheckBody`) instead of going red. A draft still cannot merge.
   - The ready run's honest gate completes the hold with its real verdict, using the existing deferral machinery.
   - A refused hold, or a draft whose guards really failed, stays red as before.

SPEC IMPACT: None.
