## 2026-07-15 · fix(ci): bot-armed auto-merges suppress ALL main-branch workflows — arm with AUTOMERGE_PAT

Merges of PRs whose auto-merge was armed by `auto-enable-automerge` (github.token) are attributed to app/github-actions, so GitHub suppresses every main-branch workflow: supabase-migrations (prod schema push!), ci, e2e, deploy-prod — observed on #3243/#3245 (the Samahan schema migration had to be applied via manual dispatch). The workflow now arms with `secrets.AUTOMERGE_PAT` (falls back to github.token until set).

OWNER ACTION REQUIRED: create a repo secret `AUTOMERGE_PAT` (classic PAT, repo scope — or a GitHub App token). Until it exists, any bot-armed merge needs `gh workflow run supabase-migrations.yml --ref main` after merging a migration.

SPEC IMPACT: None (ops).
