/**
 * S3 · the MASTER CLOCK — pure.
 *
 * Everything the encoder emits is stamped from ONE counter: the number of audio frames the
 * `AudioContext` has rendered since go-live. Video ticks are derived from it, video PTS is
 * derived from it, and AAC packet PTS is derived from it. Because both media timelines come
 * out of the same integer, `videoPTS − audioPTS` cannot drift — it can only ever be the
 * quantisation of one tick against one AAC frame.
 *
 * WHY NOT A TIMER. S1 drove the compositor from a worker `setTimeout` and MEASURED what that
 * costs (S1 close, 2026-09-05, plain Chromium 148, load held constant by a visible control on
 * the same machine): visible 30.0 ticks/s with 0 gaps > 2 ticks in 180 s; tab hidden with the
 * window on screen 21.6 ticks/s, 381 long gaps, worst 1.35 s; hidden AND minimised 26.0
 * ticks/s, 635 long gaps in 540 s, worst 8.4 s. The throttling tracks the VISIBILITY STATE,
 * not the load — so no amount of work-shedding fixes it, and a live encoder cannot be at the
 * mercy of which window the couple has in front. The audio render thread is real-time and is
 * not throttled by visibility, so the tick now comes from there. S13's minimise test on the
 * real installers (WKWebView / WebView2) is the measurement that decides the shipped app.
 *
 * ARITHMETIC. One video tick is `48000 / 30 = 1600` audio frames — EXACTLY, with no
 * remainder — and a render quantum is 128 frames, so a tick falls every 12.5 quanta. The
 * S3 prompt says "every 12.8 quanta (accumulate the fraction)": 12.8 is wrong (128 × 12.8 =
 * 1638.4 frames = 29.3 fps) and there is no fraction to accumulate if you never count quanta
 * in the first place. This module counts FRAMES and floors — `slot = ⌊frames / 1600⌋` — which
 * is exact integer arithmetic, cannot accumulate error over a six-hour wedding, and lands the
 * tick on the first quantum boundary at or after its nominal instant (≤ 2.67 ms late, never
 * early, never drifting).
 *
 * NEVER BURSTS. If quanta are delivered late in a clump, several slots can come due at once.
 * Like S1's clock, this one fires the LATEST due slot and counts the ones it skipped: S4 pulls
 * one encode per tick, and three composites stamped inside the same millisecond are duplicates,
 * not catch-up.
 */

/** The one sample rate. `AudioContext({ sampleRate })` is constructed with it; nothing resamples. */
export const AUDIO_SAMPLE_RATE = 48_000;

/** A Web Audio render quantum. Fixed by the spec, not a choice. */
export const AUDIO_QUANTUM_FRAMES = 128;

/** Frames in one AAC-LC access unit — and therefore in one `AudioData` handed to `AudioEncoder`. */
export const AAC_FRAME_SAMPLES = 1024;

/** Programme frame rate. Shared with the canvas so both timelines quantise against the same grid. */
export const PROGRAM_FPS = 30;

/** Audio frames per video tick: 1600, exactly. */
export const VIDEO_TICK_FRAMES = AUDIO_SAMPLE_RATE / PROGRAM_FPS;

/** 12.5 — kept as a named export because the prompt's "12.8" has to be refutable by import. */
export const QUANTA_PER_VIDEO_TICK = VIDEO_TICK_FRAMES / AUDIO_QUANTUM_FRAMES;

/** An inter-tick gap wider than this many ticks counts as a long gap (S1's threshold, kept). */
export const LONG_GAP_TICKS = 2;

/**
 * Frames → microseconds on the media timeline. WebCodecs timestamps are integer microseconds
 * (`long long`), so this rounds — and rounds the ABSOLUTE frame index every time rather than
 * accumulating a per-packet delta, so packet n is always at `round(n × 1024 × 1e6 / 48000)`
 * and the error against the true instant never exceeds half a microsecond, at any hour.
 */
export function framesToMicros(frames: number): number {
  return Math.round((frames * 1_000_000) / AUDIO_SAMPLE_RATE);
}

export type ProgramTick = {
  /** How many ticks have fired, 1-based (S1's `onTick` contract). */
  index: number;
  /** The grid slot this tick lands on, 0-based. Skips when quanta arrive late. */
  slot: number;
  /** The audio frame the slot is nominally at — `slot × 1600`. */
  frameIndex: number;
  /** `VideoFrame.timestamp` for the composite drawn on this tick. */
  timestampMicros: number;
};

export type AudioClockStats = {
  /** Ticks fired. */
  ticks: number;
  /** Worst gap between two consecutive fired ticks, in whole ticks (1 = no gap at all). */
  maxGapTicks: number;
  maxGapMs: number;
  /** Media-time position (ms since go-live) of the tick that ended the worst gap. */
  maxGapAtMs: number;
  /** Gaps wider than `LONG_GAP_TICKS`. The evidence number: 0 outside warm-up. */
  longGaps: number;
  /** Audio frames rendered so far — the clock itself, exposed for the drift check. */
  frames: number;
  /** Media time in ms, i.e. `frames / 48`. */
  mediaMs: number;
};

export type AudioMasterClock = {
  /**
   * Feed the running total of frames the context has rendered (the worklet's `currentFrame`
   * minus its value at go-live). Fires at most one tick. Non-monotonic input is ignored — a
   * replaced worklet restarts the count, and rewinding the master clock would rewind PTS.
   */
  advance(framesRendered: number): void;
  stats(): AudioClockStats;
};

export function createAudioMasterClock(
  onTick: (tick: ProgramTick) => void,
  tickFrames = VIDEO_TICK_FRAMES,
): AudioMasterClock {
  let frames = 0;
  let lastSlot = -1;
  let ticks = 0;
  let maxGapTicks = 0;
  let maxGapAtMs = 0;
  let longGaps = 0;

  return {
    advance(framesRendered: number): void {
      if (!Number.isFinite(framesRendered) || framesRendered <= frames) return;
      frames = framesRendered;
      const due = Math.floor(frames / tickFrames);
      if (due <= lastSlot) return;
      const gap = lastSlot < 0 ? 1 : due - lastSlot;
      const frameIndex = due * tickFrames;
      const timestampMicros = framesToMicros(frameIndex);
      if (gap > maxGapTicks) {
        maxGapTicks = gap;
        maxGapAtMs = timestampMicros / 1000;
      }
      if (gap > LONG_GAP_TICKS) longGaps += 1;
      lastSlot = due;
      ticks += 1;
      try {
        onTick({ index: ticks, slot: due, frameIndex, timestampMicros });
      } catch {
        /* a throwing tick must not stop the clock — the next composite is 1600 frames away */
      }
    },
    stats(): AudioClockStats {
      return {
        ticks,
        maxGapTicks,
        maxGapMs: (maxGapTicks * 1000) / PROGRAM_FPS,
        maxGapAtMs,
        longGaps,
        frames,
        mediaMs: (frames * 1000) / AUDIO_SAMPLE_RATE,
      };
    },
  };
}
