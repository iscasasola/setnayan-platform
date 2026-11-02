## 2026-10-08 · chore(deploy): a builder branch no longer starts a Vercel build at all

**Why.** Owner, 2026-10-08, on the Vercel bill: *"We are at around 220$ and 11 days remaining"* — the Usage
page shows **Build CPU Minutes $220.63** of a ~$225 cycle; every other line is under $1.50. Measured the same
day: a production build takes 6.6 minutes; every push to ANY other branch also started a Vercel build
machine, cloned the repo and ran the Ignored Build Step, which cancelled it after ~16 seconds — 54 of the 60
deployments in a five-hour window were such cancelled builds (builders push dozens of branches a day).

**What.** `apps/web/vercel.json` → `git.deploymentEnabled` now names what may build from a git push:
`preview/*` only. `main` stays off exactly as before (production deploys only through `deploy-prod.yml`'s
deploy hook, after `db push`). Every other branch is off, so Vercel does not start a machine for it. Vercel's
rule (docs: project-configuration/git-configuration): unspecified branches default to true; a branch matching
several patterns deploys if at least one matching rule is true — hence `**`/`*` false and `preview/*` true.

The Ignored Build Step is kept unchanged as the second fence (it still skips a `preview/*` push that touches
nothing the app builds).

**Not changed.** How production deploys; what `preview/*` branches do; any application code.

**Takes effect** per branch as each one carries this file (Vercel reads the pushed commit's `vercel.json`):
branches cut from or merged with `main` after this lands.

SPEC IMPACT: None.
