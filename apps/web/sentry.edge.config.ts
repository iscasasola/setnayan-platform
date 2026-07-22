// Sentry initialization for the Edge runtime — used by middleware.ts and
// any route opting into `export const runtime = 'edge'`. Loaded by
// instrumentation.ts when process.env.NEXT_RUNTIME === 'edge'.
//
// Same DSN env var as the Node runtime (SENTRY_DSN). If unset, skip init.
import * as Sentry from '@sentry/nextjs';
import { scrubFaceVectorsFromEvent } from '@/lib/observability-scrub';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // RA 10173 (One-Pool spec §3.4 step 5): strip biometric face vectors from
    // every event before it leaves the edge runtime. Mirrors the Node config.
    beforeSend: (event) => scrubFaceVectorsFromEvent(event),
    enabled: process.env.NODE_ENV === 'production',
  });
}
