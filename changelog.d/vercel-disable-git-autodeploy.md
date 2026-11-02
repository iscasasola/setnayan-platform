## 2026-07-30 · chore(infra): finish the migrate-then-deploy cutover — one deployer, one build per merge

Closes the cutover documented in `deploy-prod.yml`'s header. The owner created the Vercel deploy hook (`migrate-then-deploy`, branch `main`) and added `VERCEL_DEPLOY_HOOK_URL`; this turns off the trigger it replaces.

**`apps/web/vercel.json` → `"git": { "deploymentEnabled": { "main": false } }`**

Vercel removed the dashboard toggle for per-branch auto-deploy, so this is where the setting lives now. Between the secret landing and this line merging, **every push to main built twice** — Vercel's own git trigger *and* the workflow's hook. Confirmed live: commit `a66baab8` had two production deployments seconds apart, one tagged `deployHookName: migrate-then-deploy`, one carrying `repoPushedAt` with no hook id. This ends that: the hook is the only deployer, and it fires only after `db push` succeeds, so deployed code can no longer outrun its schema (the apply-lag that bit three times during the 2026-06-29 vendor-benefits build).

Scope check: `deploymentEnabled` names only `main`, so **PR previews are untouched** — and `claude/*` branches were already skipped by the existing `ignoreCommand`.

### ⛔ And a `schedule:` trigger was proposed for this workflow, then rejected — on inspection it was a cost trap

The idea was a safety-net cron mirroring `supabase-migrations.yml`, so retiring that workflow later stayed safe. Reading the steps killed it: the **"Trigger Vercel production deploy" step is gated only on `steps.gate.outputs.enabled`**, never on whether `db push` applied anything. A cron would therefore POST the deploy hook on *every* firing — at `'17,47 * * * *'` that is **~48 production builds a day of unchanged code**, on a repo that has already burned ~$787 on no-op builds (the reason `ignoreCommand` exists).

The migration safety-net stays in `supabase-migrations.yml`, which has that cron already and **never deploys**. Both facts are now written into `deploy-prod.yml`'s header as a `DO NOT ADD` so the next session doesn't re-propose it.

**And a skipped run here is not the hole it appears to be:** the hook deploys the `main` **ref**, not a pinned SHA (`deployHookRef=main`), so whichever run survives a concurrency supersession deploys main's tip — which already contains the commits whose runs were dropped. Same self-healing shape as `db push --include-all`. That is what makes disabling git auto-deploy safe rather than a single point of failure.

Verified before this landed: manual dispatch of `deploy-prod` printed `✅ Configured`, ran `db push` (`Remote database is up to date`), returned `Vercel deploy hook → HTTP 201`, and Vercel showed the resulting hook-tagged production deployment.

SPEC IMPACT: None — infrastructure only. Recorded in `DECISION_LOG.md` 2026-07-30.
