/**
 * sentry-replay.ts — the Session Replay recorder, in a module of its own so that only the signed-in work areas fetch
 * it (`lib/telemetry/replay-scope.ts`). `app/_components/deferred-observability.tsx` `import()`s this file when the
 * path is a work area and adds the integration to the already-initialised client; every other `import('@sentry/nextjs')`
 * names the exports it uses (`webpackExports`), so the recorder is in none of their chunks.
 */
export { replayIntegration } from '@sentry/nextjs';
