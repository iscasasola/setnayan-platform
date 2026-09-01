/**
 * apps/web/lib/panood-signal-status.ts
 *
 * The PURE half of the Live Studio signalling transport: what a subscribe status
 * means, and what a human is told when the channel refuses.
 *
 * ── WHY THIS IS ITS OWN MODULE ─────────────────────────────────────────────
 * `lib/panood-webrtc.ts` reaches `lib/webrtc-telemetry.ts` → the telemetry action →
 * `lib/analytics.ts`, which carries `import 'server-only'`. The repo's unit runner
 * (`tsx --test`) cannot resolve that, so anything exported from the transport is
 * untestable there. Same pure/server split as live-studio-readiness(.ts/-server.ts).
 *
 * ── THE DEFECT THESE EXIST FOR (measured 2026-09-01) ───────────────────────
 * The signalling channel is `private: true`, so Supabase evaluates RLS on
 * `realtime.messages` via `public.panood_rtc_can_access(topic)` — whose first line
 * refuses when `auth.uid()` is NULL. Both ends subscribed with:
 *
 *     .subscribe((status) => { if (status === 'SUBSCRIBED') … })
 *
 * CHANNEL_ERROR, TIMED_OUT and CLOSED were dropped. Supabase reports them once and
 * goes quiet, so a REFUSED channel and a SLOW one rendered identically — "connecting
 * to the controller…", forever, with an empty console. A camera with a healthy
 * heartbeat, bound to Channel 1, in the same browser as the controller, produced no
 * video and no explanation.
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL, and a silent branch is worse than a log.
 */

/**
 * A subscribe status that is not, and will never become, a working channel.
 *
 * ⚠ Deliberately an ALLOW-LIST of the three terminal states rather than
 * `!== 'SUBSCRIBED'`: a status Supabase adds later must not be guessed at as fatal
 * and tear down a working broadcast mid-ceremony.
 */
export function isSignalFailureStatus(status: string): boolean {
  return status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED';
}

/**
 * What the camera operator is told. One cause, one action, and it does not blame
 * them — they did nothing wrong and there is nothing on their side to fix. It also
 * never says "contact support", because the only useful act is a reload.
 */
export const SIGNAL_REFUSED_NOTICE =
  'Could not reach the control room’s signalling channel. This is on Setnayan’s side, not yours — reload this page, and tell Setnayan if it keeps happening.';
