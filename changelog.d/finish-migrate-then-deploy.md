## 2026-07-30 · ci(deploy): finish the migrate-then-deploy cutover — one deployer, migrations first

`deploy-prod` is now the only thing that deploys `main`, and it deploys only after
`supabase db push` succeeds. Vercel's native git auto-deploy for `main` is turned off
(`apps/web/vercel.json` → `git.deploymentEnabled.main: false`), so deployed code can no
longer outrun its schema — the apply-lag that produced 42703/42P01 errors three times
during the 2026-06-29 vendor-benefits build.

This is the second attempt. The first (#3916) made the same vercel.json change while
push-triggered workflows were silently suppressed, and production stopped deploying for
three merges. Root cause: GitHub does not run `push` workflows for a push made with
`GITHUB_TOKEN`, and `auto-enable-automerge.yml` was arming auto-merge with it — so merges
completed as `github-actions[bot]` and fired nothing. Fixed by adding the `AUTOMERGE_PAT`
repo secret, which that workflow already read with a `|| github.token` fallback.

Verified end-to-end on #3936 (merge `9752224e4`): auto-merge `enabledBy=iscasasola`, merge
commit authored by `iscasasola`, push runs `[deploy-prod, e2e, ci]` all fired, migrations
applied, Vercel deployed.

Side effect this also ends: between the deploy hook landing and this change, every merge
touching `apps/web` built TWICE (Vercel's own git trigger plus the hook).

The failure tell is documented in the workflow header: if merge commits start showing
`github-actions[bot]` as author, the PAT expired and `main` will silently stop deploying
while CI stays green. Recovery is `gh workflow run deploy-prod.yml --ref main`.

SPEC IMPACT: None — CI/deployment configuration.
