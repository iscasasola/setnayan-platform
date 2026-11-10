## 2026-11-10 · perf(bundle): win back shared-bundle headroom from the webpack runtime's lazy-chunk table

`main` sat at 202.3KB gzipped against the 202.3KB lock (`apps/web/scripts/check-bundle-size.mjs`) with 0.0KB headroom, so the required "bundle size check" flipped between pass and fail on hash noise and blocked merges. The budget is unchanged.

Of the six chunks the check counts, five are Next.js / React code with no app code in them. The live chunks, split into modules, show `framework`, `5fe533a1`, `5006`, `main` and `main-app` contain only Next/React. So the only part of the measured bundle that our code moves is the webpack runtime's lazy-chunk table (247 entries, ~2.5KB of its ~5.5KB). Two filename-only changes in `apps/web/next.config.ts`, client production build only:

- **Chunk content hash 9 → 8 hex.** −152 B gzipped, measured on the live runtime. 8 is the floor, because the service worker's `IMMUTABLE_PATH` needs ≥ 8 hex.
- **Next's `lib` cache group (node_modules modules > 160KB) goes unnamed.** A named lazy chunk costs a second runtime map entry. −106 B gzipped (12 named lib chunks). Modules are still grouped by the set of chunks that load them, so no page gains a byte.

Expected total: about −0.25KB. Same bytes in every file and the same pages; only chunk file names change.

SPEC IMPACT: None
