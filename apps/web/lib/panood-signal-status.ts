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

/**
 * The operator-facing link states, mirrored structurally from
 * `PeerConnectionState` in `lib/panood-webrtc.ts`. Duplicated rather than imported
 * because that module pulls in the `server-only` telemetry chain and this one must
 * stay resolvable by `tsx --test` (see the module header).
 */
export type CameraLinkState = 'waiting' | 'connecting' | 'connected' | 'failed';

/**
 * ⭐ WHAT THE CAMERA OPERATOR IS TOLD ABOUT THE LINK — and why the ORDER is the fix.
 *
 * `publishPanoodCamera` reports a refused channel through BOTH callbacks: it calls
 * `onSignalRefused(status)` AND `onState('failed')`, because the caller must also stop
 * saying "connecting…". The page then chose its sentence by testing `link === 'failed'`
 * FIRST — so on a refusal the network sentence always won and `SIGNAL_REFUSED_NOTICE`
 * could not render on any input at all. The refusal branch shipped inert in the same
 * commit as the refusal itself.
 *
 * 🔑 THAT IS WHY THIS IS A FUNCTION AND NOT A TERNARY IN JSX. The old wiring guard
 * asserted that `signalRefused` appeared BEFORE the string "connecting to the
 * controller" — which was true, and proved nothing, because the branch that actually
 * won sat above both. A guard on adjacency cannot see precedence; a guard on the
 * RETURNED SENTENCE can. (Measured 2026-09-01, the same day the branch was written.)
 *
 * The network sentence is gone with it. It read "couldn't reach the controller on this
 * network — try the same Wi-Fi as the operator", which named a cause nobody had
 * measured and prescribed an action TURN exists specifically to make unnecessary. Two
 * sessions were spent on AP isolation and TURN pricing because of that sentence; the
 * real fault, both times, was authorization and had nothing to do with any network.
 */
export function cameraLinkNotice({
  streamingEnabled,
  link,
  signalRefused,
}: {
  streamingEnabled: boolean;
  link: CameraLinkState | null;
  signalRefused: boolean;
}): string {
  if (!streamingEnabled) {
    return 'connected · the operator will bring you live from the controller.';
  }
  // FIRST, always: a refusal is a strictly more specific fact than the 'failed' that
  // accompanies it, and it is the only one of the two that names what went wrong.
  if (signalRefused) return SIGNAL_REFUSED_NOTICE;
  if (link === 'connected') {
    return "live to the controller — the operator picks when you're on screen.";
  }
  if (link === 'failed') {
    // A genuine peer failure: the two ends DID talk, and still could not open a media
    // path. Says that, and nothing it has not measured.
    return 'couldn’t open a video path to the controller — reload to try again, and tell Setnayan if it keeps happening.';
  }
  return 'connecting to the controller…';
}
