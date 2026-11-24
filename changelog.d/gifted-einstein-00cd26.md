## 2026-11-24 · fix(ci): the draft gate reads the PR's draft flag live, so a green PR is never stuck behind a draft run

On 24 Nov #8252, #8259 and #8261 sat BLOCKED with every check green. The cause was in `.github/workflows/ci.yml`. The heavy jobs and the required "typecheck + lint" gate read `github.event.pull_request.draft`, the event's frozen copy of the PR. `opened` (as a draft) and `ready_for_review` fire a second apart, so a run that read "draft" could land on the head commit after the PR was ready. Its red gate then stayed on that commit, and re-running it replayed the same payload and failed again. It cost about an hour.

- **New job `pr-state`** ("draft or ready (read live)") asks GitHub's API for the PR's draft flag at run time (`gh api repos/$REPO/pulls/$PR_NUMBER --jq .draft`, `pull-requests: read`). It answers `false` on push and dispatch.
- **Every heavy job follows it.** typecheck, eslint, the unit shards, the DB replay shards and the production build carry `needs: pr-state` plus `if: needs.pr-state.outputs.draft == 'false'`.
- **The gate follows it.** It gets `PR_DRAFT: needs.pr-state.outputs.draft` and needs `pr-state`.
- **What this fixes:**
  - A run that is created late reads "ready" and tests everything.
  - "Re-run all jobs" on an old draft run reads the live state and passes on its merits.
- **The draft fence is unchanged.** A draft PR is still red on the gate and can never merge.
- **Fail-closed:**
  - A failed read turns `pr-state` red. The heavy jobs then skip and the gate is red.
  - Re-running only the gate replays the old answer and the old skipped jobs, so it stays red on purpose (nothing was tested in that run). The gate's log now says to use "Re-run all jobs".
- **Guards:** `scripts/lib/ci-shape.mjs` gets rule d (the live clause is the one `if:` a gated job may carry, and `pr-state` the one `needs:`), rule h (the gate's PR_DRAFT comes from `pr-state`) and new rule i (the live job exists, has no `if:` and no `needs:`, has the permission, reads the API, outputs `draft`, and is needed by the gate). Rule i also bars any non-comment line of ci.yml from reading `github.event.pull_request.draft`.
- **Tests:** `scripts/ci-gate.test.mjs` gets four new tests. The shipped shape before this change fails the new rules 12 ways.
- **Left alone:** `e2e.yml` and `lighthouse.yml` keep the payload clause. A skipped job there reads as passed, so it cannot leave a PR stuck red.

SPEC IMPACT: None. CI plumbing only. No required check is renamed and branch protection is unchanged.
