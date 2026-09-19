## 2026-09-19 · fix(ci): one deployer — retire supabase-migrations.yml's push trigger so a merge cannot cancel its own deploy

`deploy-prod.yml` and `supabase-migrations.yml` both fired on `push` to `main` and share the
concurrency group `supabase-migrations-prod`. GitHub keeps one pending run per group and cancels
the other. On 2026-09-18, with the runner queue 200+ deep, no run started before the next push
arrived, so every new merge cancelled the previous pending deploy, and a merge that touched
`supabase/migrations/**` had its OWN deploy cancelled one second after creation because the
migrations run was the one kept (`ad0634875`, 23:06:36Z, cancelled 23:06:37Z; zero deploys
pending for main's head).

Measured: 38 cancelled `deploy-prod` runs that day, last success 19:39Z, production frozen at
`7ce7913` while roughly forty merges landed, including #5615. Vercel's native auto-deploy for
`main` is off, so the deploy hook in `deploy-prod` is the only path to production; when the
migrations workflow won the group it applied migrations and deployed nothing.

`deploy-prod.yml` already runs `supabase db push --include-all --yes` on every push before the
hook, fail-closed, and its own docblock has listed "retire supabase-migrations.yml" as cutover
step 3 since June. This does that half: the `push` trigger is removed; `workflow_dispatch`
stays as the named manual retry (`scripts/migration-doctor.mjs`) and still serializes through
the shared group.

SPEC IMPACT: None — infrastructure only; no product behaviour changes.
