## 2026-11-24 · fix(ci): a run cancelled for a newer run on the same commit no longer leaves a red gate behind

Every pull_request run of ci.yml shares the group `ci-pr-<N>` with `cancel-in-progress`. A second run on the same commit cancels the first. Causes include `opened` plus `ready_for_review` a second apart, `reopened`, or a re-run. The required "typecheck + lint" gate is `if: always()`, so it still runs in the cancelled run, finds its jobs `cancelled`, and posts FAILED. That failure sits in the cancelled run's own check suite, where the newer run's green never replaces it, so the PR stays BLOCKED. Seen on #8252 (run 45266185097), follow-up to #8274.

- **The gate defers instead.** `scripts/ci-gate.mjs` now hands a red to the run replacing it, but only when all of these hold:
  - every job it needs is `success`, `cancelled` or `skipped` (never `failure`, never unreadable);
  - the event is `pull_request`;
  - GitHub lists another run of this workflow WAITING (queued, pending, waiting or requested, never in progress) on the same head commit, branch and PR.

  The gate then exits green with a notice naming that run. The successor's gate is required too and stays pending until it is done, so the PR stays blocked until an honest answer.
- **Fail-closed:** no token, a refused or unreadable lookup, or no waiting run all leave the gate red as before. A real failure is never handed on.
- **The workflow:** the gate job gets `permissions: actions: read`. It hands the script `EVENT_NAME`, `GITHUB_TOKEN`, `RUN_ID`, `HEAD_SHA`, `HEAD_BRANCH` and `PR_NUMBER`.
- **Pure logic:** `deferrable` and `supersedingRun` in `scripts/lib/ci-shape.mjs`.
- **New lint rule j:** the gate keeps `actions: read` and those inputs.
- **Tests:** `scripts/ci-gate.test.mjs` gets six new tests, including end-to-end runs of the real script against a stub GitHub (green with a waiting successor; red with none, with only an in-progress run, with a 500, with no token, on push, or after a real failure).
- **Unchanged:** the 9 names posted by the guards and build report steps. Every post lands in one shared check suite (measured on #8274), so the newest post already replaces the older ones. No required name changed.

SPEC IMPACT: None. CI plumbing only, and branch protection is unchanged.
