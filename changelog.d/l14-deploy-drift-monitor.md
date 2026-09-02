## 2026-09-02 · feat(ops): a check that production stopped shipping, and the CLAUDE.md rule for why it can happen

On 2026-09-02, a migration applied directly to prod outside the pipeline orphaned the ledger and
made `deploy-prod` fail on every run for over three hours (PRs #5078 → #5084, all merged and green
— CI never runs the deploy step). Production kept serving a seven-merges-stale commit and nothing
noticed, because the only place the truth existed was the Actions tab for `deploy-prod`.

- New `scripts/deploy-drift-doctor.mjs` (+ `deploy-drift-doctor.test.mjs`, wired into `ci.yml`) asks
  the Vercel API what commit production is ACTUALLY serving and diffs it against `origin/main`,
  independent of whether `deploy-prod` ran. Reports drift only past a grace window (default 20 min)
  so normal deploy latency never false-positives; anything it can't verify (missing token, deployed
  commit not in fetched history) is reported inconclusive, never healthy.
- New `.github/workflows/deploy-drift-monitor.yml`, triggered on `deploy-prod`'s completion (not a
  schedule — this repo is cron-free, owner 2026-07-12) — mirrors the existing
  `migration-drift-monitor.yml` pattern (dormant-until-configured gate, red workflow → GitHub's
  native failure email, the same mechanism that workflow already documents relying on). **Dormant**:
  needs a new `VERCEL_TOKEN` repo secret this repo does not yet hold — flagged for the owner, not
  invented.
- `CLAUDE.md` — new "NEVER APPLY A MIGRATION DIRECTLY TO PRODUCTION" section beside the existing
  migration-prefix warning, with the measured timeline and orphaned version
  (`20260902023553`) so the next session doesn't reach for a direct apply as a shortcut.

PROOF: replayed the actual incident's real commit-age numbers through the classifier —
`{behindCount:6, oldestPendingAgeSec:2212}` (first failure, 03:16Z) and
`{behindCount:24, oldestPendingAgeSec:10349}` (last failure, 05:31Z) both classify as drift; the
post-fix state (`behindCount:0`) classifies healthy. By the time this PR opened, the owner had
already run the ledger repair and `deploy-prod`'s last 3 runs succeeded — so this PR does not catch
a currently-red state, it replays the one that just happened.

SPEC IMPACT: None — this is repo/ops tooling, not a product surface.
