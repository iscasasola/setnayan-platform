/**
 * apps/web/lib/live-studio-ingest-health.ts
 *
 * ── THE DEFECT THIS CLOSES ──────────────────────────────────────────────────
 * `getYoutubeStreamStatus` (lib/panood-youtube.ts) has existed since Wave 9,
 * costs 1 quota unit, and had zero callers — see
 * `Live_Studio_Encoder_Scope_2026-09-03.md` § 3.1. YouTube knows within ~10s
 * when a couple's encoder (OBS today) stops sending frames; the controller
 * said nothing, and the operator found out from a guest. This module is the
 * DECISION half of closing that gap — see live-studio-ingest-health-server.ts
 * for the read, and the controller page for the render.
 *
 * PURE — same split as lib/live-studio-readiness.ts / -server.ts and
 * lib/live-studio-window.ts / -window-server.ts: the decision must be
 * unit-testable and importable from a client component without dragging a
 * database (or `server-only`) into the browser bundle.
 *
 * ── WHY `lastOkAt` IS AN AGE, NOT A TIMESTAMP ───────────────────────────────
 * A pure module cannot call `Date.now()` and stay pure. `lastOkAt` is
 * therefore the number of milliseconds that have elapsed SINCE the caller's
 * cached `streamStatus`/`healthStatus` were last confirmed by an actual,
 * successful YouTube read — not since "now". `null` means there has never
 * been a successful read since the broadcast went live. The caller (the
 * client poller) is the one holding a clock; this module only compares
 * durations it is handed.
 *
 * ── THE TWO TRAPS THIS MUST NOT FALL INTO (both from this repo's history) ──
 *   1. A STALE READING IS NOT HEALTH. The Papic upload defect hid exactly
 *      this way: a stopped upload fires no event at all, so a chip sat at 0%
 *      forever and "still working" looked identical to "dead". Here, the
 *      caller may keep re-sending a CACHED `streamStatus: 'active'` from
 *      several polls ago because the most recent poll failed outright — this
 *      module must not trust it once `lastOkAt` is stale. See the
 *      `lastOkAt > STALE_AFTER_MS` branch below; delete it and a dead encoder
 *      reports as `receiving` forever.
 *   2. A FAILED READ MUST SAY "CANNOT TELL", NEVER "RECEIVING". When there
 *      has been no successful read at all yet (`streamStatus === null`), this
 *      is a READ (not an `actions.ts` write) — an absence must be SHOWN, not
 *      denied by rendering nothing or by guessing "fine".
 */

export type IngestHealthState =
  | 'waiting_for_encoder'
  | 'receiving'
  | 'degraded'
  | 'no_data';

export type IngestHealthDecision = {
  state: IngestHealthState;
  /** The operator-facing sentence for this state. Rendered, never logged only. */
  sentence: string;
};

export type IngestHealthInput = {
  /**
   * The caller's cached `liveStreams.status.streamStatus` from the last
   * successful read (`'active' | 'ready' | 'created' | 'inactive' | 'error'`
   * per the YouTube Data API), or `null` when there has never yet been one.
   * This is deliberately NOT required to be THIS tick's read — see the module
   * docblock on `lastOkAt`.
   */
  streamStatus: string | null;
  /** The caller's cached `liveStreams.status.healthStatus.status`, or `null`. */
  healthStatus: string | null;
  /**
   * Is there a Setnayan-managed broadcast for this event right now — the SAME
   * predicate the controller's tally already uses (`resolveLiveAir`'s
   * `hasActiveBroadcast`, i.e. `Boolean(activeBroadcast)`). `false` before
   * the couple has pressed "Go live", or when they are on air by hand with no
   * Setnayan-created stream to poll.
   */
  live: boolean;
  /** Milliseconds since `streamStatus`/`healthStatus` were last confirmed. See module docblock. */
  lastOkAt: number | null;
};

/**
 * ⏱ POLL INTERVAL — checked against the quota ceiling, not guessed.
 *
 * `getYoutubeStreamStatus` costs 1 quota unit/poll (panood-youtube.ts). The
 * YouTube Data API's default project quota is 10,000 units/day (the same
 * figure this repo already cites for archive resolution —
 * panood-youtube.ts's `videos.list` comment). The scope doc's own ceiling
 * (`Live_Studio_Encoder_Scope_2026-09-03.md` § 1) is roughly 12–15
 * weddings/day, and its cost model elsewhere assumes 6h typical / 12h worst
 * case per broadcast.
 *
 * Reserving HALF the daily quota (5,000 units) for this poller — the other
 * half must still cover broadcast/stream creation (50 units/write ×
 * cameras/event) and archive resolution — the worst case (15 weddings × 12h,
 * i.e. every wedding running the full archive ceiling) requires:
 *
 *   15 × 12h × (3600s/T) × 1 unit  ≤  5,000
 *   648,000 / T                    ≤  5,000
 *   T                               ≥  129.6s
 *
 * 150s clears that with headroom: worst case costs 648,000/150 ≈ 4,320 units
 * (43% of the full daily quota); the 6h-typical case costs ≈ 2,160 units
 * (22%). A 150s detection latency for a dead encoder is still vastly better
 * than the status quo — the operator finding out from a guest.
 */
export const POLL_INTERVAL_MS = 150_000;

/**
 * A cached reading older than this is no longer trusted — see trap 1 above.
 * Two missed polls (one transient blip tolerated, two is a stalled loop).
 */
export const STALE_AFTER_MS = 2 * POLL_INTERVAL_MS;

const WAITING_SENTENCE =
  'Not live yet. Start your encoder (OBS or similar) before you press Go live.';
const CANNOT_CONFIRM_SENTENCE =
  "Can't confirm your encoder right now — YouTube didn't answer. Retrying.";
const STALE_SENTENCE =
  "Haven't confirmed your encoder in a while — the last known status is too old to trust. Check your connection.";
const NOT_SENDING_SENTENCE =
  'Your encoder is not sending video. YouTube reports no incoming stream — check that OBS is running and streaming.';
const DEGRADED_SENTENCE =
  'Your encoder is connected but the stream is unstable. Check your upload connection.';
const RECEIVING_SENTENCE = 'Receiving video from your encoder.';

const YOUTUBE_BAD_HEALTH = new Set(['bad', 'noData']);

/**
 * Decide the operator-facing ingest state. Pure and total: every input
 * combination returns a nameable state, never nothing — see trap 2 above.
 */
export function decideIngestHealth(input: IngestHealthInput): IngestHealthDecision {
  if (!input.live) {
    return { state: 'waiting_for_encoder', sentence: WAITING_SENTENCE };
  }

  if (input.streamStatus === null) {
    return { state: 'no_data', sentence: CANNOT_CONFIRM_SENTENCE };
  }

  if (input.lastOkAt === null || input.lastOkAt > STALE_AFTER_MS) {
    return { state: 'no_data', sentence: STALE_SENTENCE };
  }

  if (input.streamStatus === 'active') {
    if (input.healthStatus !== null && YOUTUBE_BAD_HEALTH.has(input.healthStatus)) {
      return { state: 'degraded', sentence: DEGRADED_SENTENCE };
    }
    return { state: 'receiving', sentence: RECEIVING_SENTENCE };
  }

  return { state: 'no_data', sentence: NOT_SENDING_SENTENCE };
}
