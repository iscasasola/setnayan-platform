## 2026-07-10 · chore(ci): skip Vercel production + preview builds for non-web commits

Vercel on-demand charges this cycle were dominated by **Build CPU Minutes (~$787)** — everything else combined was under $2. Root cause: every push/merge triggered a full Next.js compile of `apps/web`, including commits that touch **nothing the web build consumes** (spec corpus under `Setnayan/`, root `*.md` docs, `changelog.d/` fragments, `supabase/` migrations, `apps/mobile`, `src-tauri`). At PR #2982 and ~2 builds per PR (preview branch + production merge), the no-op builds were the bulk of the spend.

- `apps/web/vercel.json`: added an `ignoreCommand` that runs `git diff --quiet HEAD^ HEAD` against only the paths the web build depends on — `apps/web`, `packages/shared`, and the root build config (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`). If none changed, Vercel skips the build (exit 0); otherwise it builds (exit 1). Any git error (e.g. missing `HEAD^`) is non-zero → **fails safe to BUILD**. `cd "$(git rev-parse --show-toplevel)"` anchors pathspecs to the repo root since the ignore step runs from the `apps/web` Root Directory.
- Verified by dry-running the guard over the last 12 commits (all frontend PRs → all correctly BUILD) plus synthetic commits: docs/spec-only → SKIP, supabase-migration-only → SKIP, `apps/web`-only → BUILD, mixed web+docs → BUILD.
- `apps/web` does not declare or import `@setnayan/shared`, but `packages/shared` is kept in the build set as a conservative safety margin (a rare shared-only change triggers a harmless web build rather than risking a skipped one).

Note for further savings (dashboard, not code): Settings → Git → set Preview Deployments to the production branch only (or disable per-branch previews) to cut the second build per PR; and batch PR merges. A spend cap under Settings → Billing is recommended given 10 days left in the cycle.

SPEC IMPACT: None
