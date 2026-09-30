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

## Measurement notes (2026-10-01)
- ⚠ `ps` RSS / `/usr/bin/time -l` UNDER-REPORT on this Mac: pages in the compressor are not RSS. Mid-build the main `next build` showed RSS 1.8 GB while `top` MEM (phys footprint) was 8.66 GB (6.6 GB compressed). Sampler now sums `top -l 1 -stats pid,mem` over the build's process tree — the Linux-RSS equivalent.
- Baseline, maps ON (dummy SENTRY_AUTH_TOKEN, = Vercel): rc 0, 16.5 min wall, compile 14.7 min, time -l max RSS 5.23 GB (under-reported), footprint >= 9.64 GB sampled only AFTER compile (sampler started late — compile peak unmeasured). 2101 .map files, .next = 8.5 GB.
- Fix commit in progress: sourcemaps.disable gated on TOKEN && SENTRY_PROJECT.
