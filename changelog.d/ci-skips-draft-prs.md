## 2026-11-16 · ci: draft PRs skip ci, e2e and lighthouse; marking a PR ready runs them all

Owner-confirmed process (16 Nov): runners are spent on PRs that are ready. Every job in `ci.yml`, `e2e.yml` and
`lighthouse.yml` carries `if: ${{ github.event.pull_request.draft != true }}` (the gate: `always() && <that>`), and each
`pull_request` trigger lists `types: [opened, synchronize, reopened, ready_for_review]`. On `push` to `main` and on
`workflow_dispatch` there is no pull request (`draft` is null, `null != true`), so every job runs exactly as before.

The required-gate lint (`scripts/lib/ci-shape.mjs`) forbade any job-level `if:` on a gated job and pinned the gate to
`always()` — on purpose, because a skipped required check counts as passed. It now accepts exactly ONE extra condition,
`DRAFT_CLAUSE`, and a new rule (g) makes it safe: a workflow that uses it must list `ready_for_review`, or a PR marked
ready would keep only the draft's skipped checks. Any other `if:` is still caught. `scripts/ci-gate.test.mjs` holds
both (rule g sabotaged → red).

SPEC IMPACT: None.
