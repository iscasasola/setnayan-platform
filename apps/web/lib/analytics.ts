import 'server-only';

import { cookies } from 'next/headers';

import { CONSENT_STORAGE_KEY } from '@/lib/cookie-consent';

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

/**
 * 🔴 THE SERVER HALF OF THE ANALYTICS CHOICE — added 2026-08-25.
 *
 * The browser SDK has been consent-gated since the cookie banner shipped. This
 * module was not: 15 call sites captured events keyed to the Supabase user_id
 * from server actions — signup, login, onboarding, event creation, payments —
 * with NO consent check anywhere. Somebody could decline analytics in the banner
 * and still be measured, by name, from the server. A choice honoured on one of
 * two paths is not honoured.
 *
 * ONE GATE, AT THE ONE FUNCTION. Checking the cookie at 15 call sites is 15
 * chances to forget, and the sixteenth call site makes it 16. This is the same
 * reasoning that fused the photo wall's three surface checks into one.
 *
 * ⚖ FAILS CLOSED, on purpose and in three directions:
 *   · no cookie yet (nobody has answered)  → no capture. Consent is OPT-IN, and
 *     this is exactly what the browser already does.
 *   · a malformed cookie                   → no capture.
 *   · no request context at all            → no capture.
 * Silence is the recoverable failure here; capturing somebody who said no is not.
 *
 * ⚠ NAMED, NOT SOLVED: the cookie belongs to the BROWSER MAKING THE REQUEST,
 * while `distinctId` names the SUBJECT. For 14 of the 15 call sites those are
 * the same person. The exception is the admin payment action, which captures
 * against the couple's user_id from an admin's session — so that one is gated on
 * the ADMIN's choice, not the couple's. That is strictly MORE private than
 * today (which gates on nothing) and never less, so it ships; keying consent to
 * the subject would require a per-user consent record, which is a DPO decision
 * the owner has not made.
 */
async function analyticsConsented(): Promise<boolean> {
  try {
    const store = await cookies();
    const raw = store.get(CONSENT_STORAGE_KEY)?.value;
    if (!raw) return false;
    const parsed = JSON.parse(decodeURIComponent(raw)) as { analytics?: unknown };
    return parsed.analytics === true;
  } catch {
    return false;
  }
}

export async function captureEvent(args: CaptureEventArgs): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!apiKey || !host) return; // not configured — silently no-op
  if (!(await analyticsConsented())) return; // they said no, or have not said yes

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
