## 2026-08-06 · chore(mobile): commit the `cap sync` output that registers the push-notifications plugin

Two tracked, generated Android build files had been sitting **uncommitted** on the
owner's machine. They register `@capacitor/push-notifications` with the native
Android project — the output of `npx cap sync`.

Everything else about that plugin already landed:

- it is a dependency in `apps/mobile/package.json` (`^8.0.1`)
- it resolves in the mobile lockfile (`apps/mobile` is deliberately excluded from
  the pnpm workspace and carries its own npm lock — see `pnpm-workspace.yaml`)
- `apps/mobile/src/push.ts` uses it, and its own docblock names the missing step:
  *"requires @capacitor/push-notifications + native setup (owner action: npx cap sync)"*

So the dependency and the code shipped; only the generated native wiring stayed
local. Someone ran the sync and the result never reached git. Committing it
completes the plugin registration and matches the repo's convention — these two
files are tracked, so the repository already commits its generated native state.

Found because these two files were among the three blocking the owner's main
checkout from updating: it sits **294 commits behind `origin/main`**, which is
why the home-directory protection merged earlier today is not yet active on that
machine. With this and the `CLAUDE.md` note (#4184) resolved, that checkout
fast-forwards cleanly — it has **zero commits of its own**, so nothing merges and
nothing is at risk.

SPEC IMPACT: None — generated native build files; no product behaviour changes.
