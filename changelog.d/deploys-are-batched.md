## 2026-09-23 · perf(deploy): production publishes 6×/day instead of once per merge

Every production build is a Build CPU Minute, and Build CPU Minutes are 100% of the Vercel bill.
`deploy-prod.yml` ran on every push to `main` — ~15 builds/day. It now runs on
`cron: '7 */4 * * *'` plus `workflow_dispatch`, and skips entirely when `main` has not moved past
the `deployed-prod` marker tag.

Merging is untouched: PRs merge the moment their checks are green. Each run publishes everything
merged since the last one, and `db push --include-all` keeps migrations ordered and ahead of the
code. `deploy-drift-doctor.mjs` gets `--grace-min 285` so the monitor does not alarm on the
intended lag.

SPEC IMPACT: None.
