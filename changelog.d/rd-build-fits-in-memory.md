## 2026-10-01 · fix(build): the production build fits in 16 GB again

`15df3c1` and `5440da5` died on Vercel with `exited (137)` + "Out of Memory"
(8 cores / 16 GB, build cache already OFF). Two causes, both measured on
5440da5 on the owner's Mac, phys footprint summed over the whole build tree:

- **Source maps built for nobody.** Vercel Production has `SENTRY_AUTH_TOKEN`
  (138 days) and has never had `SENTRY_PROJECT`, and `sourcemaps.disable` was
  gated on the token alone — so every deploy built ~2,100 maps and the Sentry
  plugin then logged "No project provided. Will not upload source maps." Now
  gated on token AND project (`lib/sentry-sourcemaps-can-upload.ts`). Compile
  14.7 → 6.8 min, `.next` 8.5 → 4.7 GB. Adding `SENTRY_PROJECT` in Vercel turns
  maps (and upload) back on with no code change.
- **The 12288 MB heap ceiling was the plateau, not headroom.** V8 grows to its
  ceiling before collecting, and a compiler carries ~1.8 GB off-heap on top, so
  a 12 GB ceiling on a 16 GB box is a container SIGKILL waiting to happen.
  `experimental.webpackBuildWorker: true` (off by default because we have a
  custom `webpack` fn) runs each compiler in a child that exits, and the heap
  is now 8192 (4096 → V8 heap OOM; 6144 passed with no slowdown).

Peak footprint 12.35–12.45 GB → **9.75–10.01 GB**; wall 16.5 min (as Vercel ran
it) → **~7 min**. Output unchanged (376/376 static pages, same route table);
no runtime behaviour change. `lib/the-build-has-headroom-ci-cannot-prove.test.ts`
now pins a heap BAND (8192–10240), the build worker, `cpus: 1`, and the
source-map gate — each sabotaged red.

SPEC IMPACT: None
