// Sentry initialization for the Node.js runtime (server components, route
// handlers, server actions). Loaded by instrumentation.ts when
// process.env.NEXT_RUNTIME === 'nodejs'.
//
// DSN is read from SENTRY_DSN (server-side only — never exposed to the
// client). If unset, we skip init silently.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Sample 10% of transactions; align with the client config.
    tracesSampleRate: 0.1,
    // Production only — local dev errors stay in the terminal.
    enabled: process.env.NODE_ENV === 'production',
  });
}
