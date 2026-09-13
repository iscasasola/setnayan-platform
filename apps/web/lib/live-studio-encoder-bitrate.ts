/**
 * apps/web/lib/live-studio-encoder-bitrate.ts
 *
 * S9 (build-sessions/encoder/S9.md) — "step the bitrate before frames pile
 * up". The Rust side (`src-tauri/crates/encoder/src/occupancy.rs`) samples
 * how many bytes are sitting unsent in the RTMP send path every ~500ms and
 * forwards the raw byte count; THIS module turns that into "how many seconds
 * of video are backed up" and decides whether to step the ladder — the same
 * pure-decider / impure-sampler split as `live-studio-ingest-health.ts`.
 *
 * ⚠ NOT WIRED TO A LIVE `VideoEncoder` YET. S4 (the browser-side H.264
 * encode from the canvas) has not landed on `origin/main` as of this
 * session — see the S9 hand-back. This module is a pure, fully-tested unit
 * ready for S4's `VideoEncoder.configure()` call site to consume; it makes
 * no assumption about how samples arrive.
 *
 * ── THE LADDER ───────────────────────────────────────────────────────────
 * Rung 0 is the default for PH mobile upload (~10 Mb/s typical, this session
 * scope's own ceiling figure) — 720p30 @ 2.5 Mbps. Two steps down trade
 * resolution for headroom rather than motion smoothness, because a frozen
 * frame reads as "broken" to a couple's guests in a way a softer picture
 * does not.
 *
 * ── HYSTERESIS — WHY A SINGLE SAMPLE NEVER FLIPS THE RUNG ───────────────
 * A single occupancy spike is a burst, not a trend — GOP boundaries and
 * keyframes routinely produce one. Stepping DOWN needs the buffered-send
 * time to stay above `DOWN_BUFFERED_THRESHOLD_MS` for a full
 * `DOWN_AFTER_MS` continuously (reset to zero the instant one sample drops
 * back under the threshold — see `stepBitrateRung`). Stepping UP is the
 * mirror image and far more patient (`UP_AFTER_CLEAN_MS`): recovering
 * bandwidth after a step down is not urgent, and flapping between rungs
 * would be a worse viewer experience than staying one rung lower briefly.
 */

/** Index into `BITRATE_LADDER` — also what `IngestHealthInput.encoder.bitrateRung` carries. */
export type BitrateRung = 0 | 1 | 2;

export type RungConfig = {
  bitrateBps: number;
  width: number;
  height: number;
  /** Operator-facing label — same string the "reduced quality" sentence can cite. */
  label: string;
};

/** 2.5 → 1.8 → 1.2 Mbps, 720p30 → 720p30 → 540p30 — S9.md's numbers, verbatim. */
export const BITRATE_LADDER: readonly [RungConfig, RungConfig, RungConfig] = [
  { bitrateBps: 2_500_000, width: 1280, height: 720, label: '720p30 @ 2.5 Mbps' },
  { bitrateBps: 1_800_000, width: 1280, height: 720, label: '720p30 @ 1.8 Mbps' },
  { bitrateBps: 1_200_000, width: 960, height: 540, label: '540p30 @ 1.2 Mbps' },
];

export const MIN_RUNG: BitrateRung = 0;
export const MAX_RUNG: BitrateRung = (BITRATE_LADDER.length - 1) as BitrateRung;

/** A sample must sit above this many ms of buffered send to count as "bad". */
export const DOWN_BUFFERED_THRESHOLD_MS = 1_500;
/** ...continuously, for at least this long, before the rung actually steps down. */
export const DOWN_AFTER_MS = 2_000;
/** ...and this long continuously CLEAN before it steps back up. */
export const UP_AFTER_CLEAN_MS = 30_000;

export type RungState = {
  rung: BitrateRung;
  /** Consecutive ms spent ABOVE the threshold. Reset to 0 by any clean sample. */
  aboveThresholdMs: number;
  /** Consecutive ms spent AT/BELOW the threshold. Reset to 0 by any bad sample. */
  cleanMs: number;
};

export const INITIAL_RUNG_STATE: RungState = { rung: 0, aboveThresholdMs: 0, cleanMs: 0 };

export type OccupancySample = {
  /** Unsent bytes currently queued in the send path (Rust's raw sample). */
  unsentBytes: number;
  /** ms elapsed since the previous sample — nominally 500, per the Rust sampler's cadence. */
  elapsedMs: number;
};

/** unsentBytes expressed as ms of video at the CURRENT rung's bitrate — "how far behind are we". */
export function bufferedMs(unsentBytes: number, rung: BitrateRung): number {
  const bytesPerMs = BITRATE_LADDER[rung].bitrateBps / 8 / 1000;
  if (bytesPerMs <= 0 || unsentBytes <= 0) return 0;
  return unsentBytes / bytesPerMs;
}

/**
 * One pure step of the ladder per sample. Bounded (never below `MIN_RUNG` or
 * above `MAX_RUNG`) and hysteretic (see module docblock) — both are
 * mutation-tested guards; deleting either turns this into an unbounded or
 * single-sample-triggered ladder.
 */
export function stepBitrateRung(state: RungState, sample: OccupancySample): RungState {
  const elapsed = Math.max(0, sample.elapsedMs);
  const buffered = bufferedMs(sample.unsentBytes, state.rung);

  if (buffered > DOWN_BUFFERED_THRESHOLD_MS) {
    const aboveThresholdMs = state.aboveThresholdMs + elapsed;
    if (aboveThresholdMs >= DOWN_AFTER_MS && state.rung < MAX_RUNG) {
      return { rung: (state.rung + 1) as BitrateRung, aboveThresholdMs: 0, cleanMs: 0 };
    }
    return { rung: state.rung, aboveThresholdMs, cleanMs: 0 };
  }

  const cleanMs = state.cleanMs + elapsed;
  if (cleanMs >= UP_AFTER_CLEAN_MS && state.rung > MIN_RUNG) {
    return { rung: (state.rung - 1) as BitrateRung, aboveThresholdMs: 0, cleanMs: 0 };
  }
  return { rung: state.rung, aboveThresholdMs: 0, cleanMs };
}
