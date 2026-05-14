// Sentry initialization for the browser runtime. Loaded automatically by
// Next.js (via withSentryConfig) on every client navigation.
//
// DSN is read from NEXT_PUBLIC_SENTRY_DSN so it ships in the client bundle.
// If unset, we skip init silently — keeps local dev / preview deploys
// without a DSN from crashing on import.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Sample 10% of transactions for performance traces. Tune up/down later
    // once we have a feel for volume vs. quota.
    tracesSampleRate: 0.1,
    // Session replays are expensive — disable steady-state capture and only
    // record when an error actually fires (replaysOnErrorSampleRate: 1.0).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Only emit events in production. Dev errors are noisy and already
    // visible in the terminal / browser console.
    enabled: process.env.NODE_ENV === 'production',
  });
}
