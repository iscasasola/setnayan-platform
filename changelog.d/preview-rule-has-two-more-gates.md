## 2026-09-23 · docs(vercel): `preview/<name>` is a half-rule — three silent gates recorded

Three gates found by build sessions after the opt-in preview rule landed, each of which fails as a
preview that never appears rather than as an error: the tip commit must touch a watched path
(`HEAD^ HEAD`, last commit only); Vercel keys deployments on the COMMIT so re-pushing a deployed SHA
under a `preview/` name creates nothing (`--amend --no-edit` is the fix, an empty commit is not);
and the `ignoreCommand` comes from each deployment's own commit, so branches cut before `7a6191b8e`
keep building previews until they rebase.

Also records that a branch push fires no GitHub checks at all (`ci.yml` is `push: branches:[main]` +
`pull_request`) — so pushing `rd/*` is free while pushing `preview/*` buys a build — and that once
publishing is batched, "merged" and "applied" come apart, so anything regenerated from prod must ask
prod rather than infer from a green merge.

SPEC IMPACT: None.
