import { trackFailure } from '@/lib/telemetry/track-error';

/**
 * Problems · an error boundary's one line. Every `error.tsx` and
 * `global-error.tsx` calls this (dynamically imported, so no boundary pays for
 * it before it renders); `every-failure-is-recorded.test.ts` fails if one
 * stops.
 *
 * A crash that carries a `digest` began on the SERVER, where
 * instrumentation.ts `onRequestError` already recorded it with its route and
 * stack — recording the browser's half too would split one failure into two
 * issues, so only browser-born crashes are sent from here.
 */
export function reportCrash(error: (Error & { digest?: string }) | null | undefined, boundary: string): void {
  if (!error || error.digest) return;
  if (typeof window === 'undefined') return;
  void trackFailure({
    eventType: 'PAGE_CRASH',
    elementName: `${boundary} error screen`,
    error,
    payload: { page: window.location.pathname, boundary, action: `crash ${boundary}` },
  });
}
