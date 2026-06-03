import 'server-only';

// Server-side PostHog capture. Backed by plain `fetch` against the
// `/capture/` REST endpoint — the JS SDK is browser-only and bringing in
// `posthog-node` would just add weight for what is, in practice, three
// fire-and-forget event types.
//
// Design notes:
//
// - Gated entirely on `NEXT_PUBLIC_POSTHOG_KEY` + `_HOST`. When either is
//   missing this is a hard no-op so local/preview environments don't
//   need PostHog wired to function.
// - All errors are swallowed. Analytics MUST NOT break the request path —
//   if PostHog is down or the network is wobbly, the signup/checkout
//   flow it's instrumenting has to keep working.
// - `distinctId` is the Supabase `user_id` so server-side events line up
//   with whatever the browser SDK emits after `posthog.identify(user.id)`.

export type CaptureEventArgs = {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
};

export async function captureEvent(args: CaptureEventArgs): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!apiKey || !host) return; // not configured — silently no-op

  const { distinctId, event, properties } = args;
  if (!distinctId || !event) return;

  try {
    const endpoint = `${host.replace(/\/+$/, '')}/capture/`;
    // Bound the call. This is awaited inside request paths (e.g. the onboarding
    // commit), so an unbounded hang here can drag the whole serverless function
    // to its timeout — which surfaces to the user as a failed action (the
    // onboarding "Creating your dashboard" overlay stranded the couple this way,
    // owner report 2026-06-03). A 2s abort keeps telemetry from ever blocking the
    // response, which is this module's stated contract.
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2000);
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          event,
          distinct_id: distinctId,
          properties: properties ?? {},
        }),
        // Best-effort — never let analytics block the response.
        cache: 'no-store',
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Swallow. The whole point of telemetry being fire-and-forget is
    // that a failure here is invisible to the user (an abort lands here too).
  }
}
