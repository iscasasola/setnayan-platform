/**
 * apps/web/lib/encoder/backpressure-ring.ts
 *
 * S5 · THE REAL DROP POLICY for the video worker's bounded ring.
 *
 * S4 (`video-encode.ts`, `createChunkRing`) ships a PLACEHOLDER: drop the oldest entry
 * of ANY kind on overflow, "so producer and counters exist" — its own docblock says
 * "S5 owns what actually happens when the IPC consumer falls behind the encoder." This
 * is that policy, as its own module (S4 has not merged onto `origin/main` as of this
 * branch — a concurrent session, `claude/encoder-s4-video-encode`, is still building
 * it) so the two branches merge cleanly; whichever lands second swaps S4's placeholder
 * `createChunkRing` for `createBackpressureRing` at the one call site.
 *
 * `RingEntry`'s shape is copied field-for-field from S4's `video-encode.ts` so this is
 * a drop-in replacement, not a competing type.
 *
 * THE POLICY (S5 prompt): capacity 90 video chunks (3 s at 30 fps). On overflow:
 *   1. Drop the OLDEST NON-KEYFRAME chunk first — a single delta frame lost from the
 *      middle of a GOP is invisible on playback (frames either side still decode).
 *   2. If every remaining chunk is a keyframe (each one starts its own GOP with no
 *      deltas left to shed — only possible under sustained, severe overflow), drop the
 *      OLDEST WHOLE GOP as one unit: the oldest keyframe together with everything up to
 *      (not including) the next keyframe.
 *   3. NEVER drop the ring down to nothing: the newest keyframe's GOP is the resync
 *      point a decoder needs, so it is never evicted by this policy. If overflow
 *      persists past that floor, the ring is allowed to sit one GOP over capacity
 *      rather than destroy the only frame a downstream decoder could resume from —
 *      the caller's own cadence (a new keyframe every `KEYFRAME_INTERVAL_TICKS`) bounds
 *      how large that GOP can be, so this is a small, temporary, counted overshoot, not
 *      an unbounded one.
 *   4. AUDIO NEVER ENTERS THIS RING. `RingEntry` has no audio member — audio is bundled
 *      separately per rule 19/S3's mixer and takes its own path to IPC entirely. "Never
 *      audio" is enforced by this ring's input type, not by a runtime branch it could
 *      silently fail.
 * Every drop is counted; `push` never blocks and never awaits a consumer.
 */

export type RingEntry = {
  keyframe: boolean;
  timestampMicros: number;
  seq: number;
  data: Uint8Array;
};

export type BackpressureRingStats = {
  size: number;
  capacity: number;
  pushed: number;
  droppedNonKeyframe: number;
  droppedGop: number;
  totalDropped: number;
};

export type BackpressureRing = {
  /** Never blocks, never awaits a consumer. */
  push(entry: RingEntry): void;
  drain(): RingEntry[];
  stats(): BackpressureRingStats;
};

/** The S5 prompt's number: 90 video chunks is 3 s of ring at the locked 30 fps. */
export const DEFAULT_RING_CAPACITY = 90;

export function createBackpressureRing(
  capacity: number = DEFAULT_RING_CAPACITY,
  onDrop?: (stats: Pick<BackpressureRingStats, 'droppedNonKeyframe' | 'droppedGop' | 'totalDropped'>) => void,
): BackpressureRing {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error(`backpressure-ring: capacity must be a positive integer, got ${capacity}`);
  }
  const buf: RingEntry[] = [];
  let pushed = 0;
  let droppedNonKeyframe = 0;
  let droppedGop = 0;

  function dropOldestNonKeyframe(): boolean {
    const idx = buf.findIndex((e) => !e.keyframe);
    if (idx === -1) return false;
    buf.splice(idx, 1);
    droppedNonKeyframe += 1;
    return true;
  }

  /**
   * Drop the oldest whole GOP — everything from the front up to (excluding) the
   * SECOND keyframe in the buffer — unless fewer than two keyframes remain, in which
   * case the one keyframe left IS the resync point and must survive (rule 3 above).
   */
  function dropOldestGop(): boolean {
    let firstKeyframeSeen = false;
    let secondKeyframeIdx = -1;
    for (let i = 0; i < buf.length; i++) {
      if (!buf[i]!.keyframe) continue;
      if (!firstKeyframeSeen) {
        firstKeyframeSeen = true;
        continue;
      }
      secondKeyframeIdx = i;
      break;
    }
    if (secondKeyframeIdx === -1) return false; // at most one keyframe left — refuse
    const removed = buf.splice(0, secondKeyframeIdx);
    droppedGop += removed.length;
    return true;
  }

  function notifyDrop(): void {
    onDrop?.({
      droppedNonKeyframe,
      droppedGop,
      totalDropped: droppedNonKeyframe + droppedGop,
    });
  }

  return {
    push(entry) {
      pushed += 1;
      buf.push(entry);
      while (buf.length > capacity) {
        if (dropOldestNonKeyframe()) {
          notifyDrop();
          continue;
        }
        if (dropOldestGop()) {
          notifyDrop();
          continue;
        }
        // Cannot evict further without destroying the only remaining (newest)
        // keyframe's GOP — see rule 3. Stop; the ring sits over capacity by at most
        // one GOP until the producer's own cadence drains it.
        break;
      }
    },
    drain() {
      return buf.splice(0, buf.length);
    },
    stats: () => ({
      size: buf.length,
      capacity,
      pushed,
      droppedNonKeyframe,
      droppedGop,
      totalDropped: droppedNonKeyframe + droppedGop,
    }),
  };
}
