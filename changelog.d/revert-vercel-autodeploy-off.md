## 2026-07-30 · fix(infra): revert the auto-deploy switch-off — bot-merged pushes fire no workflows, so nothing was deploying

Reverts the `apps/web/vercel.json` line from #3916 (`"git": { "deploymentEnabled": { "main": false } }`) and corrects the diagnosis in `deploy-prod.yml`'s header.

### What actually happens, measured

**GitHub does not run `push`-triggered workflows for a push made with `GITHUB_TOKEN`.** `auto-enable-automerge.yml` arms auto-merge with that token, so GitHub completes the merge as `github-actions[bot]` and the resulting push to `main` triggers **nothing** — not `deploy-prod`, not `ci`, not `e2e`.

Of the last five merges to main:

| Merge | Author | `push` runs |
|---|---|---|
| `8760e19e6` (#3917) | human | ✅ fired |
| `4ba1703d0` (#3916) | `github-actions[bot]` | ❌ none |
| `d8216cb13` (#3919) | `github-actions[bot]` | ❌ none |
| `25bec371d` (#3918) | `github-actions[bot]` | ❌ none |
| `052ff19c4` (#3920) | `github-actions[bot]` | ❌ none |

Auto-merge is this repo's standing default, so that is **most** merges.

### Two corrections this forces

1. **The five "skipped" migrations earlier today were not concurrency supersession.** That was the wrong diagnosis, and #3919's justification for deleting the safety-net cron rested on it. The real cause is the GITHUB_TOKEN rule above — which also explains why the skips *persisted*: the applier simply never ran.
2. **With Vercel's git auto-deploy off AND push runs not firing, production silently stopped updating.** Three merges (#3919, #3918, #3920) landed with zero production deployments until a manual `gh workflow run deploy-prod.yml --ref main` swept them up. Vercel's git integration is its own webhook, independent of Actions, so it fires on bot-authored merges too — it was the only thing covering this, and #3916 turned it off.

The hook itself is fine and stays configured: verified gate `✅ Configured`, `db push` ran, `HTTP 201`, and Vercel showed a deployment carrying `deployHookName: migrate-then-deploy` at main's tip. **The hook was never the problem; its trigger was.**

### To finish the cutover, one of these must land first

- **A (preferred):** give `auto-enable-automerge.yml` a PAT or GitHub App token instead of `GITHUB_TOKEN`, so merge pushes carry a real identity and do trigger workflows. **Owner action** — a new repo secret.
- **B:** trigger `deploy-prod` off an event a bot merge still emits. ⚠ **Verify before relying on it** — `pull_request: [closed]` may be suppressed by the same rule; that assumption is exactly what went wrong here.

Until then: `deploy-prod` still runs on human-authored pushes and on `workflow_dispatch`, Vercel deploys everything else, and double builds occur only on human-authored merges. The ordering race returns for bot merges — which is where it was before today, not a new regression.

⚠ **#3919 (cron removal) is deliberately NOT reverted.** Its schedules were genuinely redundant *if* the applier runs on every merge — which is the thing that turns out to be false. But re-adding a 30-minute cron is not the fix for a broken trigger; fixing the trigger is. The header now records that the manual fallback is `gh workflow run deploy-prod.yml --ref main` and that Vercel covers deploys meanwhile.

SPEC IMPACT: None — infrastructure only.
