## 2026-11-24 · fix(ci): a run cancelled for a newer run on the same commit no longer leaves a red gate behind

Every pull_request run of ci.yml shares the group `ci-pr-<N>` with `cancel-in-progress`. A second run on the same commit cancels the first. Causes include `opened` plus `ready_for_review` a second apart, `reopened`, or a re-run. The required "typecheck + lint" gate is `if: always()`, so it still runs in the cancelled run, finds its jobs `cancelled`, and posts FAILED. That failure sits in the cancelled run's own check suite, where the newer run's green never replaces it, so the PR stays BLOCKED. Seen on #8252 (run 45266185097), follow-up to #8274.

- **The gate defers instead, and says PENDING, never success.** `scripts/ci-gate.mjs` hands its red to the run replacing it, but only when all of these hold:
  - every job it needs is `success`, `cancelled` or `skipped` (never `failure`, never unreadable);
  - the event is `pull_request`;
  - GitHub lists another run of this workflow WAITING (queued, pending, waiting or requested, never in progress) on the same head commit, branch and PR.

  It then POSTS a "typecheck + lint" check run with status `in_progress` and no conclusion ("Deferred to run N: pending"). Its job ends 0 only after GitHub accepted that post. GitHub counts every check run of a required name, so the context reads PENDING. That closes the window the controller found: a waiting successor has no check runs yet, and a draft run's skipped jobs count as passed.
- **The successor completes it.** Every honest gate PATCHes each pending deferred check on its commit to its own verdict. A newer run of the same name does not replace an older one (measured on #8274). A draft-red gate leaves them pending.
- **Fail-closed:** the gate stays red as before when there is no token, the lookup is refused or unreadable, there is no waiting run, or the pending post is refused. A real failure is never handed on. If a completion fails, the context stays pending (blocked).
- **The workflow:** the gate job gets `permissions: actions: read` and `checks: write`. It hands the script `EVENT_NAME`, `GITHUB_TOKEN`, `RUN_ID`, `HEAD_SHA`, `HEAD_BRANCH` and `PR_NUMBER`.
- **Pure logic:** `deferrable` and `supersedingRun` in `scripts/lib/ci-shape.mjs`.
- **New lint rule j:** the gate keeps `actions: read`, `checks: write` and those inputs.
- **Tests:** `scripts/ci-gate.test.mjs` gets nine new tests (47 in all), including end-to-end runs of the real script against a recording stub GitHub. The 🔒 tests fail if a deferring path can ever post a conclusion or end 0 without an accepted pending post; two sabotages were seen red.
- **Unchanged:** the 9 names posted by the guards and build report steps. Every post lands in one shared check suite (measured on #8274), so the newest post already replaces the older ones. No required name changed.
- **Not covered yet (proved on #8285):** three required JOB names in a cancelled run end `cancelled` and still block: `production build`, `playwright e2e (chromium)` and `lighthouse`. A same-commit cancel of a FULL run (reopen, re-trigger) still needs a fresh head commit. The draft-run race is fully covered, because those jobs skip there and are never cancelled.

SPEC IMPACT: None. CI plumbing only, and branch protection is unchanged.
