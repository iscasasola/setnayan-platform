# BUILDMEM progress (rd/build-fits-in-memory) — DONE

## Cause
1. **Source maps built for nobody.** Vercel Production has SENTRY_AUTH_TOKEN (138 d) and never SENTRY_PROJECT; `sourcemaps.disable` was gated on the token alone → devtool `source-map`/`hidden-source-map` on every deploy, then Sentry: "No project provided. Will not upload source maps." (~2,100 .map files, .next 8.5 GB.) Local builds never have the token, so no local measurement ever paid this.
2. **The 12288 MB V8 ceiling was the plateau.** V8 defers major GC until near its ceiling; a compiler also carries ~1.8 GB off-heap. With `webpackBuildWorker` defaulting OFF (custom webpack fn), all compilers shared one long-lived heap → ~12.4 GB + extras on a 16 GB box → SIGKILL 137 (not a V8 heap OOM — that's what Vercel logged).
Already on before this PR: `experimental.cpus: 1`, `webpackMemoryOptimizations: true`, VERCEL_FORCE_NO_BUILD_CACHE=1 (cache not the cause).

## Measurements — 5440da5, owner's Mac (10 cores, 16 GB, Node 22), no Supabase env, dummy SENTRY_AUTH_TOKEN (= Vercel), phys footprint summed over the build tree (top MEM; ps RSS under-reports on macOS)
| setting | compile | wall | peak footprint | result |
|---|---|---|---|---|
| maps ON, 12288, one process (Vercel as-is) | 14.7 min | 16.5 min | not sampled in compile; ≥ 9.64 GB after | pass locally |
| maps OFF, 12288, one process | 6.8 min | 8.3 min | 12.35 GB | pass |
| maps OFF, 12288, webpackBuildWorker | ~5 min | 6.1 min | 12.45 GB | pass |
| maps OFF, 6144, webpackBuildWorker | ~5 min | 6.1 min | 9.46 GB | pass |
| maps OFF, 4096, webpackBuildWorker | — | 3.2 min | 6.70 GB | **FAIL** V8 heap OOM |
| **maps OFF, 8192, webpackBuildWorker (SHIPPED)** | 5.0–5.2 min | 6.9–7.0 min | **9.75–10.01 GB** | pass ×2 |
Vercel reference: last good 1579ea8 compiled 6.3 min; failures died at 12.7 / 20.2 min.

## Shipped
- `lib/sentry-sourcemaps-can-upload.ts` (token AND project) → `sourcemaps.disable`.
- `experimental.webpackBuildWorker: true`.
- build script heap 12288 → 8192.
- `lib/the-build-has-headroom-ci-cannot-prove.test.ts`: heap band 8192–10240, worker true, cpus 1, sourcemap gate; each sabotaged red (6 sabotages).
- Checks: typecheck ✓, next lint (changed files) ✓, 39 CI node guards ✓, bundle-size-check ✓, maker budget ✓, 147 config-reading unit tests ✓.

## Owner follow-ups (not done — settings are owner-only)
- If Sentry source maps are WANTED: add SENTRY_PROJECT (+ SENTRY_ORG if needed) in Vercel; maps + upload return automatically. Re-measure the build then.
- Verify on the first Vercel deploy after merge: compile time in the log should be ~6 min, no 137.
