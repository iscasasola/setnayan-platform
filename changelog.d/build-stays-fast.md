## 2026-11-04 · perf(build): no webpack disk cache in `next build` — compile −20%, peak memory −40%; a CI build budget

Owner: *"can you keep the builds on 7 minutes?"* Measured on main `78112195` (clean build, dummy env, Linux 4 cores, RSS summed over the build tree):

| | compile | wall | peak |
|---|---|---|---|
| before | 11.2 min | 14.1 min | 11.4 GB |
| after | 8.9 min | 11.8 min | 6.8 GB |

- **Why it grew:** no config regressed since #6223. The app did: non-test source 48 → 64 MB, pages 439 → 494, route handlers 156 → 178.
- **What was cut:** Next writes webpack's filesystem cache when each compile ends. The server cache write took 2.0 min, ran before the edge and client compiles could start, and was the build's memory peak (7.8 → 11.4 GB). It came to 5.6 GB. Vercel keeps at most 3 GB of build cache on an Enhanced machine, so it could not be reused. `next build` now skips it (`lib/build-webpack-cache.ts`); `next dev` keeps its cache, and `NEXT_BUILD_WEBPACK_CACHE=1` keeps it for repeated local builds.
- **Guard:** `scripts/check-build-budget.mjs` runs in CI's `production build` job. It FAILS if the build wrote `.next/cache/webpack` or pre-rendered more than 300 pages (261 today), and only WARNS when the build is >20% over its time baseline, because runner speed varies. `lib/the-build-stays-fast.test.ts` pins the cache decision and the in-build skips (type-check, lint, browser source maps), and fails if CI stops running `pnpm typecheck` / `pnpm lint` on its own.
- Measured, not shipped: `webpackMemoryOptimizations: false` + `cpus: 2` (−0.5 min, would loosen two memory guards); turning off Sentry's per-route server wrappers (−1.0 min; trims Sentry's server tracing, an owner call).

SPEC IMPACT: None — build configuration only. No Vercel setting or env var changed.
