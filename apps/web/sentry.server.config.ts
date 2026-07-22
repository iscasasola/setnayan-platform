// Sentry initialization for the Node.js runtime (server components, route
// handlers, server actions). Loaded by instrumentation.ts when
// process.env.NEXT_RUNTIME === 'nodejs'.
//
// DSN is read from SENTRY_DSN (server-side only — never exposed to the
// client). If unset, we skip init silently.
import * as Sentry from '@sentry/nextjs';
import { scrubFaceVectorsFromEvent } from '@/lib/observability-scrub';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Sample 10% of transactions; align with the client config.
    tracesSampleRate: 0.1,
    // RA 10173 (One-Pool spec §3.4 step 5): strip biometric face vectors from
    // every event before it leaves the server — server actions (e.g.
    // autoTagSeatCapture) and route handlers pass descriptors that must never
    // reach Sentry or request-body logs.
    beforeSend: (event) => scrubFaceVectorsFromEvent(event),
    // Production only — local dev errors stay in the terminal.
    enabled: process.env.NODE_ENV === 'production',
  });
}
