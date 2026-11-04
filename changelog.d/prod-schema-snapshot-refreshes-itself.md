## 2026-11-04 · ci(deploy): the prod schema snapshot refreshes itself after every publish

`supabase/security/prod-schema.snapshot.txt` was refreshed only by a human with
production access. When it fell 41 migrations behind the "prod snapshot is fresh
enough" ceiling (40) in `apps/web/tests/db/schema-drift.db.test.ts`, every PR that
added a migration went red at once — 5 PRs on 5 Nov, cleared by hand in #7272.

- `deploy-prod.yml`: after `supabase db push` succeeds (and after the deploy hook
  and marker), regenerate the snapshot READ-ONLY through the already-linked
  project (`gen-schema-snapshot.ts` → two SELECTs via `supabase db query --linked`;
  no URL is built or printed). Job timeout 15 → 20 min to leave room for it.
- New `scripts/refresh-prod-schema-snapshot.sh`: if the file changed, commit it
  plus a changelog fragment on `bot/prod-schema-snapshot`, push with
  `AUTOMERGE_PAT` (a GITHUB_TOKEN push fires no CI), open or update ONE PR and arm
  auto-merge (merge commit). Never force-pushes: while the PR is open it merges
  `main` in and adds a commit; a branch whose PR is closed is deleted and started
  again. Re-proposes nothing when the bot branch already carries the same
  snapshot, and refuses to push if the branch would touch any other file.
- It never fails the deploy: every error becomes a `::warning::` + exit 0, and the
  step also has `continue-on-error` and a 6-minute timeout.
- The ceiling and the check are unchanged; only the freshness test's failure
  message and the generator's docblock now mention the automatic path.

SPEC IMPACT: None.
