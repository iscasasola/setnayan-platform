## 2026-06-29 · fix(ci): gate the prod deploy on the migration apply (apply-lag root-cause)

Root-cause fix for the recurring migration apply-lag: Vercel's native git
auto-deploy fires on every push to main and runs **fully in parallel** with
`supabase-migrations.yml` (`supabase db push`), so deployed code routinely
outran its schema — a multi-minute window where a just-merged feature
42703/42P01-errors in prod (hit 3× during the vendor-benefits build: the Wave-2
discovery substrate, No-Show, and Batch-1 Wave-5; each was caught by a manual
schema introspection + idempotent re-apply via the Supabase MCP).

New `.github/workflows/deploy-prod.yml` makes ONE pipeline own the order: on
push to main → `supabase db push` → **on success** → trigger the Vercel
production deploy via a Deploy Hook. Vercel still builds; it's just triggered
*after* migrations apply, so the schema is always ahead of the code. Fail-closed:
if `db push` fails, the deploy never fires (far safer than today's
deploy-anyway race).

**Non-breaking as merged** — the workflow is a green no-op (dormant gate,
mirroring `supabase-migrations.yml`) until the owner does the one-time CUTOVER
(see the workflow header): (1) disable Vercel's git auto-deploy for main, (2)
set `VERCEL_DEPLOY_HOOK_URL` (the 3 supabase secrets are already set), (3) retire
`supabase-migrations.yml` (this subsumes it; they share a concurrency group so
they never double-push meanwhile), (4) verify via a manual run. Until cutover,
Vercel's native auto-deploy stays in charge and nothing changes.

SPEC IMPACT: None — CI/deploy ordering only; no schema/SKU/pricing/flow change.
Owner cutover required to activate (load-bearing deploy-pipeline change — left
to a deliberate owner action with Vercel access, per the surface-load-bearing
rule).
