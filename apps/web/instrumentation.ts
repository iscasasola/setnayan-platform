// Next.js instrumentation entry point — runs once per server runtime at
// startup. We use it to bootstrap Sentry on the matching runtime so the
// Node and Edge SDKs are wired up before any request is served.
//
// See https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
import * as Sentry from '@sentry/nextjs';
import type { Instrumentation } from 'next';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
    // 📋 Problems list: the PostgREST fetch layer (refused / zero-row writes)
    // and logQueryError's non-PostgREST failures reach the recorder through
    // these sinks — see lib/supabase/db-error-log.ts and error-detect.ts.
    try {
      const { installProblemSinks } = await import('./lib/telemetry/server-fault');
      installProblemSinks();
    } catch {
      /* the app must start even if the recorder cannot */
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// App Router error capture — Next calls this hook for any error thrown
// from a server component, route handler, or server action. Forwards the
// error to Sentry with the originating request context.
//
// 📋 AND TO THE PROBLEMS LIST (2026-10-02, "every action that fails is
// recorded, traced and listed"). This is the ONE place every thrown server
// failure passes, so it is recorded here and nowhere per action: route
// pattern, the action's file#export, the digest the person's error screen
// shows, and the build. Next's own control-flow throws (redirect, notFound)
// never reach this hook as failures and are filtered again in
// `shapeRequestError`. Node runtime only — the recorder needs the service-role
// client and the build's actions manifest.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  Sentry.captureRequestError(error, request, context);
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { recordRequestError } = await import('./lib/telemetry/server-fault');
    await recordRequestError(error, request, context);
  } catch {
    // Recording a failure must never become a second failure.
  }
};
