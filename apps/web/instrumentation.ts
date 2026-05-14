// Next.js instrumentation entry point — runs once per server runtime at
// startup. We use it to bootstrap Sentry on the matching runtime so the
// Node and Edge SDKs are wired up before any request is served.
//
// See https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// App Router error capture — Next calls this hook for any error thrown
// from a server component, route handler, or server action. Forwards the
// error to Sentry with the originating request context.
export const onRequestError = Sentry.captureRequestError;
