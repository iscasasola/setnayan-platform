'use client';

// Lazy-loads Sentry's browser SDK after the page has become interactive.
//
// Why this exists:
//   The Sentry Next.js wrapper (`withSentryConfig`) auto-injects
//   `sentry.client.config.ts` into every client entry point, which pulls
//   the entire `@sentry/nextjs` browser bundle (~105 kB gzipped — Browser
//   Tracing, Session Replay shims, the full integration set) into the
//   "First Load JS shared by all" chunk for every route. That dominates
//   the lighthouse Performance score on cold loads of `/` and `/login`,
//   neither of which need observability before first paint.
//
// What we do instead:
//   1. Drop `sentry.client.config.ts` so Sentry's webpack plugin doesn't
//      inject the SDK into the shared client entry.
//   2. Render this component from the root `Providers` tree.
//   3. After hydration, schedule a `requestIdleCallback` (with a 2s
//      `setTimeout` fallback) that dynamic-imports `@sentry/nextjs` and
//      calls `Sentry.init` with the same options as before.
//
// Result: Sentry gets its own webpack chunk, fetched lazily only after
// the main route is interactive. Server-side Sentry (instrumentation.ts
// + sentry.server.config.ts + sentry.edge.config.ts) is untouched, so
// server-component / server-action / route-handler error capture still
// works as before. The only behavioral change: client-side errors that
// fire in the first ~1–2 s after hydration won't be captured. That's an
// acceptable trade for the perf recovery — the same window where the
// browser is still parsing/executing the main bundle anyway.

import { useEffect } from 'react';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

type IdleDeadline = { didTimeout: boolean; timeRemaining: () => number };
type IdleCallbackHandle = number;
type RequestIdleCallback = (
  cb: (deadline: IdleDeadline) => void,
  opts?: { timeout?: number },
) => IdleCallbackHandle;
type CancelIdleCallback = (handle: IdleCallbackHandle) => void;

function scheduleIdle(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const w = window as unknown as {
    requestIdleCallback?: RequestIdleCallback;
    cancelIdleCallback?: CancelIdleCallback;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const handle = w.requestIdleCallback(() => cb(), { timeout: 4000 });
    return () => {
      if (typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(handle);
      }
    };
  }
  // Fallback: short setTimeout — anything > 0 lets the main thread paint
  // the LCP image and run any synchronous hydration work first.
  const handle = window.setTimeout(cb, 2000);
  return () => window.clearTimeout(handle);
}

export function DeferredObservability() {
  useEffect(() => {
    if (!SENTRY_DSN) return;

    let cancelled = false;
    const cancelIdle = scheduleIdle(() => {
      if (cancelled) return;
      // Dynamic import keeps `@sentry/nextjs` out of the main entry chunk.
      // Webpack will split it into its own async chunk that's only fetched
      // when this useEffect runs (i.e. post-hydration, post-idle).
      void import('@sentry/nextjs')
        .then((Sentry) => {
          if (cancelled) return;
          // Mirror the previous `sentry.client.config.ts` Sentry.init call
          // so behavior is unchanged once the SDK has loaded.
          Sentry.init({
            dsn: SENTRY_DSN,
            // Sample 10% of transactions for performance traces. Tune
            // up/down later once we have a feel for volume vs. quota.
            tracesSampleRate: 0.1,
            // Register the Replay integration so the on-error sampling below
            // actually records. Without it, replaysOnErrorSampleRate is inert
            // (Sentry only captures replays when replayIntegration() is in the
            // integration set). Loaded inside the deferred chunk, so it adds
            // nothing to the main bundle / LCP path.
            integrations: [Sentry.replayIntegration()],
            // Session replays are expensive — disable steady-state
            // capture and only record when an error actually fires.
            replaysSessionSampleRate: 0,
            replaysOnErrorSampleRate: 1.0,
            // Only emit events in production. Dev errors are noisy and
            // already visible in the terminal / browser console.
            enabled: process.env.NODE_ENV === 'production',
          });
        })
        .catch(() => {
          // Sentry chunk failed to load (offline, blocked, etc.). Drop
          // silently — observability is best-effort, not load-bearing.
        });
    });

    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, []);

  return null;
}
