## 2026-11-21 · fix(ci): a labelled PR's required checks are counted

Batch PR #8098 sat BLOCKED with all 30 checks green: "9 of 13 required status checks are expected". It was opened with the `do-not-auto-merge` label, so both jobs in `auto-merge.yml` skipped and that workflow's check suite concluded "skipped". It was the first github-actions suite on the head commit. GitHub filed the nine required checks that `scripts/ci-report-checks.mjs` posts into that suite, and branch protection does not count runs in a skipped suite. Re-running `guards` re-filed them into the same suite.

- A new `suite-is-never-skipped` job always runs, so the suite concludes "success". It arms and disarms nothing; `lint-automerge-hold` and `hold-label-actually-disarms.test.ts` still pass.

SPEC IMPACT: None.
