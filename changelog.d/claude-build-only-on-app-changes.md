## 2026-11-21 · fix(deploy): production builds only when an app file changed

Owner, verbatim: *"Yes, fix it"* — to "make production build only when app files change".

- `deploy-prod.yml` used to rebuild the whole app on Vercel for ANY new commit on
  `main` — a changelog fragment, a docs edit, or the bot's prod-schema snapshot.
  A build is the Vercel bill. Now: migrations still apply on any new commit
  (`db push` unchanged), but the Vercel deploy hook fires only when a file in
  `scripts/app-build-paths.mjs` changed since `deployed-prod`. Reading the list
  failing BUILDS (fail open), never skips.
- `deploy-drift-doctor.mjs` counts production as "behind" only by first-parent
  commits that change a built file (`pendingAppCommits`), each merge diffed
  against its first parent explicitly — `git rev-list -- <paths>` would drop
  every merged PR through history simplification. Without this the monitor would
  report drift forever after a docs merge.
- One list, three readers: `scripts/app-build-paths.mjs` = `apps/web/vercel.json`'s
  `ignoreCommand` paths; a test fails if they diverge.
- ⚠ `/api/health`'s served commit can now trail `origin/main` by commits that
  change no built file. That is not a failed deploy — run the drift doctor.
- Measured: 32 of the last 198 first-parent commits on main (7 days) touched no
  built file.

SPEC IMPACT: None
