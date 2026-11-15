## 2026-11-16 · ci: draft PRs skip the heavy jobs and are RED on the gate; marking a PR ready runs everything

Owner-confirmed process (16 Nov): runners are spent on PRs that are ready.

- The heavy jobs — `typecheck`, `eslint`, `unit tests (n/3)`, `DB replay (n/6)`, `production build`, `bundle size check`
  (it runs a full build), `playwright e2e`, `lighthouse` — carry `if: ${{ github.event.pull_request.draft != true }}`.
  The cheap ones (`guards`, `source guards`, `secret scan`, the lint guards, the migration guard) still run on a draft.
- The required gate `typecheck + lint` does NOT take that `if:` — it keeps `always()` — and it is handed
  `PR_DRAFT`: on a draft it FAILS with "Draft PR: checks not run. Mark ready to test." So a draft is always red on the
  required gate and can never merge, by auto-merge (armed on new PRs) or anyone else. `auto-merge.yml` is untouched.
- Each `pull_request` trigger lists `types: [opened, synchronize, reopened, ready_for_review]`, so marking a PR ready
  runs every job. On `push` to `main` and `workflow_dispatch` there is no pull request (`null != true`): unchanged.

`scripts/lib/ci-shape.mjs` (lint-ci-gate) changes only as far as that needs: rule (b) — the gate is exactly
`always()` — is unchanged; rule (d) accepts the ONE draft clause on a gated job and nothing else; new rule (g) requires
`ready_for_review` wherever the clause is used; new rule (h) requires the gate to be handed `PR_DRAFT`. `ci-gate.test.mjs`
fails if the gate ever gets the draft clause, if the gate passes on a draft, if (g) or (h) is dropped (each sabotaged → red).

SPEC IMPACT: None.
