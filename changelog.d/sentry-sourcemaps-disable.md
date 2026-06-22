## 2026-06-22 · fix(build): disable Sentry source-map generation until SENTRY_AUTH_TOKEN is set

Salvages the one unshipped hunk from the now-stale PR #1560. That PR's OOM fixes (`experimental.cpus: 1` webpack-worker cap + the turbo build env vars) already shipped to `main` via commit `eada18d2`; its `BUILD_3STATE_ENABLED` change is retired dead config. The only piece never landed was a Sentry source-map-disable block.

- **`apps/web/next.config.ts`** — adds a `sourcemaps` block to the `withSentryConfig` options object:
  ```ts
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
  ```
  Without a `SENTRY_AUTH_TOKEN` the build can't upload maps to Sentry anyway, so generating full source maps is pure wasted build work — a real memory + time cost on this #1258-OOM-prone build. Keying `disable` off the token makes it self-re-enable the moment the owner provisions one; `deleteSourcemapsAfterUpload` then keeps maps out of the deployed bundle once upload is live. Verified `@sentry/nextjs` is `8.55.2` (lockfile), which supports the modern `sourcemaps` option shape.

Verified: config still type-checks (`pnpm --filter web typecheck`). #1560 closed as superseded with a salvage pointer to this PR.

SPEC IMPACT: None — build efficiency only.
