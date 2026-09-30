# BUILDMEM progress (rd/build-fits-in-memory)

## Done
- Worktree at origin/main 5440da56f; pnpm install.
- Read failed Vercel log dpl_BwGjedz6GwabUURy5KAWUSiPihYu: 8 cores/16 GB, cache skipped, died 137 after 20m14s in "Creating an optimized production build".

## Findings
- `experimental.cpus: 1` and `webpackMemoryOptimizations: true` are ALREADY on.
- Custom `webpack` fn (ours + Sentry's) => Next 15.5 `webpackBuildWorker` defaults OFF => all three compilers run in ONE main-process heap.
- **SENTRY_AUTH_TOKEN is set in Vercel Production (138d), SENTRY_PROJECT/SENTRY_ORG are NOT.** next.config gates `sourcemaps.disable` on the token only, so every Vercel build runs devtool `source-map` (server) + `hidden-source-map` (client) — and the Sentry plugin then logs "No project provided. Will not upload source maps." Maps are built and never uploaded. Local builds (no token) never paid this cost, which is why local RSS (4.7–5.7 GB) never reproduced Vercel.

## Next
- Measure baseline with a dummy token (maps on, = Vercel) vs fix (maps off), sampler sums RSS of all build processes.
- Then consider webpackBuildWorker.
