// Sentry initialization for the Edge runtime — used by middleware.ts and
// any route opting into `export const runtime = 'edge'`. Loaded by
// instrumentation.ts when process.env.NEXT_RUNTIME === 'edge'.
//
// Same DSN env var as the Node runtime (SENTRY_DSN). If unset, skip init.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === 'production',
  });
}
