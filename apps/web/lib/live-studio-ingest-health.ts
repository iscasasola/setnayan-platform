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
 *
 * ── S5 ADDITION: THE DESKTOP TRANSPORT ENVELOPE (informational, NEVER a state)
 * `apps/web/lib/encoder/ipc-envelope.ts`'s go-live guard probes which envelope
 * carries the webview→Rust IPC (`raw` / `json_array` / `base64` / `loopback`)
 * BEFORE `encoder_start`. This is the one existing health surface that
 * decision is supposed to reach (rule 24 — extend this decider, never build a
 * second one) — but it must NEVER change `state`, only annotate it, because
 * the base64/JSON envelope is the EXPECTED path today (owner decision
 * 2026-09-06), not a degradation. A guard that turned `transportEnvelope !==
 * 'raw'` into `degraded` would mark every macOS user as broken — see
 * `Envelope::is_zero_copy`'s Rust docblock for the exact mistake this must
 * not repeat. Whether the transport is genuinely UNUSABLE is `probeTransport`'s
 * `usable` field, decided upstream of this module entirely (the go-live guard
 * refuses to start at all in that case) — by the time a broadcast is live and
 * being read here, the transport already passed that gate.
 *
 * ── S9 — THE ENCODER'S OWN HEALTH (build-sessions/encoder/S9.md) ───────────
 * Everything above this line answers "does YouTube see video?" — a question
 * that only exists once a Setnayan-managed broadcast exists to ask it of
 * (`live`). It cannot see a local RTMP reconnect loop, and it cannot see
 * anything at all on the couple's OWN channel (§ the by-hand route, which has
 * no `stream_id` and therefore no YouTube health to poll). `encoder` closes
 * both gaps: an OPTIONAL reading from the desktop app's native RTMP sender
 * (`src-tauri/crates/encoder::reconnect::HealthEvent`, S6/S7), forwarded
 * through S5's Tauri command surface.
 *
 * PRECEDENCE (measured, not guessed — see this module's tests):
 *   · YouTube `no_data` (never confirmed, or stale) ALWAYS wins. A locally
 *     "publishing" encoder cannot make the strip GREENER than what YouTube
 *     itself is reporting — see trap 1/2 above; this is the same trap with a
 *     second, louder liar added to the room.
 *   · Local `reconnecting`/`down` CAN pre-empt an otherwise-fine YouTube
 *     `receiving`/`degraded` reading — LOUDER AND FASTER than waiting for
 *     YouTube's own ~10s detection latency. `reconnecting` needs to have held
 *     for at least `LOCAL_PREEMPT_MS` first (one dropped TCP ack is not an
 *     outage); `down` — already past the supervisor's own grace window
 *     (`reconnect.rs`'s `HealthEvent::Down` doc) — pre-empts immediately.
 *   · A non-zero `bitrateRung` is a SUB-state, not a different top-level
 *     state: "streaming at reduced quality" while still `receiving`/
 *     `degraded`, never its own alarm color.
 *
 * ⚠ NOT WIRED END TO END YET. `src-tauri/src/encoder_ipc.rs` (S5, PR #5239)
 * ships `encoder_push`'s bytes into a STUB byte-counter (its own comment:
 * "S6 replaces this with the real FLV-tag/RTMP writer") — nothing today
 * calls `reconnect::supervise()`, and no Tauri `Channel<HealthEvent>` exists
 * for Rust to push updates to this page at all. `IngestHealthStrip` therefore
 * always passes `encoder: null` for now — see that component's own comment.
 * This module accepts the real shape today so a follow-up session only has
 * to wire the channel, never touch `decideIngestHealth` again.
 */

export type IngestHealthState =
  | 'waiting_for_encoder'
  | 'receiving'
  | 'degraded'
  | 'reconnecting'
  | 'encoder_down'
  | 'no_data';

export type IngestHealthDecision = {
  state: IngestHealthState;
  /** The operator-facing sentence for this state. Rendered, never logged only. */
  sentence: string;
  /**
   * S5: an informational annotation of which desktop IPC envelope the go-live
   * guard measured (`raw` / `json_array` / `base64` / `loopback`), or `null`
   * when the input carried none (web-only session, or the probe hasn't run
   * yet). NEVER influences `state` — see the module docblock.
   */
  transportNote: string | null;
};

/** Mirrors `reconnect::HealthEvent`'s states, collapsed to what the strip renders. */
export type EncoderRtmpState = 'idle' | 'connecting' | 'publishing' | 'reconnecting' | 'down';

export type EncoderHealthInput = {
  rtmp: EncoderRtmpState;
  /** How long the CURRENT reconnect attempt has been running. 0 when `rtmp` isn't `'reconnecting'`. */
  reconnectingForMs: number;
  droppedFrames: number;
  /** 0 = full quality; see `live-studio-encoder-bitrate.ts`'s `BITRATE_LADDER`. */
  bitrateRung: 0 | 1 | 2;
  recording: boolean;
};

/**
 * A local `reconnecting` reading must hold for at least this long before it
 * pre-empts a fine-looking YouTube reading — a single dropped ack that
 * recovers inside a second is not an outage worth alarming over. `down` has
 * no such grace: the supervisor only emits it once its OWN grace window has
 * already elapsed (see `HealthEvent::Down`'s doc in `reconnect.rs`).
 */
export const LOCAL_PREEMPT_MS = 1_000;

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
  /**
   * S5: which desktop IPC envelope `apps/web/lib/encoder/ipc-envelope.ts`'s
   * go-live guard measured for this session (`'raw' | 'json_array' | 'base64'
   * | 'loopback'`, mirroring `EnvelopeValue`), or `null`/omitted on the web
   * (no desktop app in play) or before the probe has run once. Optional and
   * ADDITIVE — every existing caller that never passes it keeps behaving
   * identically; see the module docblock for why it can only annotate, never
   * gate, `state`.
   */
  transportEnvelope?: string | null;
  /**
   * The desktop encoder's own reading, or `null` when there is none — no
   * desktop app, or (today) no wiring to it yet. See the S9 docblock above.
   */
  encoder?: EncoderHealthInput | null;
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
const OWN_CHANNEL_NO_YOUTUBE_NOTE =
  " Setnayan can't check your YouTube status directly on your own channel.";
const ENCODER_IDLE_SENTENCE = 'Your desktop encoder is idle. Start it before you go live.';
const ENCODER_CONNECTING_SENTENCE = 'Your desktop encoder is connecting…';
const ENCODER_PUBLISHING_SENTENCE = 'Receiving video from your desktop encoder.';
const ENCODER_RECONNECTING_SENTENCE = 'Your desktop encoder lost connection and is reconnecting…';
const ENCODER_DOWN_SENTENCE =
  "Your desktop encoder can't reach the ingest. Check your upload connection.";
const REDUCED_QUALITY_SUFFIX = ' Streaming at reduced quality to keep up with your connection.';

const YOUTUBE_BAD_HEALTH = new Set(['bad', 'noData']);

/** The encoder's own reading, with no YouTube broadcast to combine it against
 * (own-channel/by-hand, or not `live` yet). Used both when `!input.live` and
 * as the base for the S9 precedence rules below. */
function decideFromEncoderOnly(encoder: EncoderHealthInput, ownChannelNote: string): IngestHealthDecision {
  switch (encoder.rtmp) {
    case 'idle':
      return { state: 'waiting_for_encoder', sentence: ENCODER_IDLE_SENTENCE + ownChannelNote };
    case 'connecting':
      return { state: 'waiting_for_encoder', sentence: ENCODER_CONNECTING_SENTENCE + ownChannelNote };
    case 'publishing':
      return {
        state: 'receiving',
        sentence:
          (encoder.bitrateRung > 0
            ? ENCODER_PUBLISHING_SENTENCE + REDUCED_QUALITY_SUFFIX
            : ENCODER_PUBLISHING_SENTENCE) + ownChannelNote,
      };
    case 'reconnecting':
      return { state: 'reconnecting', sentence: ENCODER_RECONNECTING_SENTENCE + ownChannelNote };
    case 'down':
      return { state: 'encoder_down', sentence: ENCODER_DOWN_SENTENCE + ownChannelNote };
  }
}

/**
 * S5: format the informational transport annotation. Pure, and deliberately
 * NEVER returns anything that reads as an alarm — see the module docblock:
 * `base64`/`json_array` is the EXPECTED envelope today, not a degradation.
 */
function transportNoteFor(envelope: string | null | undefined): string | null {
  if (!envelope) return null;
  return `Desktop transport: ${envelope}.`;
}

/**
 * Decide the operator-facing ingest state. Pure and total: every input
 * combination returns a nameable state, never nothing — see trap 2 above.
 */
export function decideIngestHealth(input: IngestHealthInput): IngestHealthDecision {
  const transportNote = transportNoteFor(input.transportEnvelope);
  const encoder = input.encoder ?? null;

  if (!input.live) {
    // Own-channel (by-hand): no Setnayan-managed broadcast, so no stream_id
    // exists for YouTube to report on — that half must say so rather than
    // showing nothing (S9's mount-rule extension), while the desktop
    // encoder's OWN reading, when there is one, still gets shown.
    if (encoder) {
      return { ...decideFromEncoderOnly(encoder, OWN_CHANNEL_NO_YOUTUBE_NOTE), transportNote };
    }
    return { state: 'waiting_for_encoder', sentence: WAITING_SENTENCE, transportNote };
  }

  let youtube: Omit<IngestHealthDecision, 'transportNote'>;
  if (input.streamStatus === null) {
    youtube = { state: 'no_data', sentence: CANNOT_CONFIRM_SENTENCE };
  } else if (input.lastOkAt === null || input.lastOkAt > STALE_AFTER_MS) {
    youtube = { state: 'no_data', sentence: STALE_SENTENCE };
  } else if (input.streamStatus === 'active') {
    youtube =
      input.healthStatus !== null && YOUTUBE_BAD_HEALTH.has(input.healthStatus)
        ? { state: 'degraded', sentence: DEGRADED_SENTENCE }
        : { state: 'receiving', sentence: RECEIVING_SENTENCE };
  } else {
    youtube = { state: 'no_data', sentence: NOT_SENDING_SENTENCE };
  }

  // PRECEDENCE 1 — YouTube `no_data` always wins. A locally "fine" encoder
  // reading must never make this GREENER than what YouTube itself reports.
  if (youtube.state === 'no_data' || !encoder) {
    return { ...youtube, transportNote };
  }

  // PRECEDENCE 2 — local reconnecting/down pre-empts an otherwise-fine
  // YouTube reading, louder and faster than YouTube's own ~10s detection.
  if (encoder.rtmp === 'down') {
    return { state: 'encoder_down', sentence: ENCODER_DOWN_SENTENCE, transportNote };
  }
  if (encoder.rtmp === 'reconnecting' && encoder.reconnectingForMs >= LOCAL_PREEMPT_MS) {
    return { state: 'reconnecting', sentence: ENCODER_RECONNECTING_SENTENCE, transportNote };
  }

  // PRECEDENCE 3 — bitrate rung is a sub-state, never its own alarm color.
  if (encoder.bitrateRung > 0 && (youtube.state === 'receiving' || youtube.state === 'degraded')) {
    return { state: youtube.state, sentence: youtube.sentence + REDUCED_QUALITY_SUFFIX, transportNote };
  }

  return { ...youtube, transportNote };
}
