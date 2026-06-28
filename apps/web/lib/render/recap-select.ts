// Auto-Recap slot selection (Group B prototype · Oracle Always-Free).
//
// PURE selection — given an event's candidate captures, pick a chronological,
// timeline-spread set of "best moments" whose durations sum to ≤30s, ready to
// feed `buildAutoRecapFfmpegArgs`. No DB/fs/network — the worker builds the
// candidate list from a `papic_photos` (+ `photo_tags`) query and calls this.
//
// Heuristic (spec: "timestamp clusters + quality heuristic", no AI): divide the
// event timeline into N contiguous groups and take the best capture per group,
// so the recap COVERS the whole day rather than over-sampling one busy moment.
// "Best" = most-tagged (more guests/faces in frame ≈ a better moment); ties
// break to the earliest. Sharpness/exposure scoring is a deliberate follow-up
// (those scores aren't computed yet) — tag count is the signal we have today.

import { RECAP_MAX_DURATION_MS } from './recap-ffmpeg';

/** Hard 5s clip cap (corpus lock) — a clip slot never exceeds this. */
const CLIP_MAX_MS = 5_000;
/** A slot shorter than this isn't worth a cut — drop rather than flash it. */
const MIN_SLOT_MS = 1_000;

export interface RecapCandidate {
  /** R2 ref / id the worker will resolve + download. */
  inputRef: string;
  type: 'photo' | 'clip';
  capturedAtMs: number;
  /** Tags on the capture (guests/faces) — the quality proxy. */
  tagCount: number;
  /** Native clip length (clips only); clamped to the 5s cap. */
  clipDurationMs?: number;
}

export interface RecapSelectionOptions {
  /** Total recap budget (default = the 30s hard cap). */
  targetDurationMs?: number;
  /** On-screen time per still (default 2.5s → ~12 stills fill 30s). */
  photoSlotMs?: number;
}

export interface SelectedSlot {
  inputRef: string;
  type: 'photo' | 'clip';
  durationMs: number;
}

/**
 * Bucket `sorted` (ascending capturedAtMs) into `n` equal-TIME windows and
 * return the non-empty ones in order. Time-based (not count-based) is the point:
 * a burst of many captures at one instant lands in ONE window, so it can't
 * dominate the recap — coverage stays spread across the whole event.
 */
function timeWindows(sorted: RecapCandidate[], n: number): RecapCandidate[][] {
  const minT = sorted[0]!.capturedAtMs;
  const maxT = sorted[sorted.length - 1]!.capturedAtMs;
  if (maxT === minT) return [sorted]; // all at one instant → a single window
  const width = (maxT - minT) / n;
  const buckets: RecapCandidate[][] = Array.from({ length: n }, () => []);
  for (const c of sorted) {
    const idx = Math.min(n - 1, Math.floor((c.capturedAtMs - minT) / width));
    buckets[idx]!.push(c);
  }
  return buckets.filter((b) => b.length > 0);
}

/** The "best" candidate in a window: most tags, ties → earliest. */
function pickBest(group: RecapCandidate[]): RecapCandidate {
  return group.reduce((best, c) => {
    if (c.tagCount > best.tagCount) return c;
    if (c.tagCount === best.tagCount && c.capturedAtMs < best.capturedAtMs) return c;
    return best;
  });
}

/**
 * Select a chronological, timeline-spread set of slots summing to ≤ target.
 * Returns slots in capture order; total is guaranteed ≤ the 30s cap.
 */
export function selectAutoRecapSlots(
  candidates: RecapCandidate[],
  options: RecapSelectionOptions = {},
): SelectedSlot[] {
  const target = Math.min(options.targetDurationMs ?? RECAP_MAX_DURATION_MS, RECAP_MAX_DURATION_MS);
  const photoSlotMs = options.photoSlotMs ?? 2_500;
  if (candidates.length === 0 || target < MIN_SLOT_MS) return [];

  const sorted = [...candidates].sort((a, b) => a.capturedAtMs - b.capturedAtMs);

  // How many cuts fit, at most — one per timeline window.
  const maxSlots = Math.max(1, Math.floor(target / photoSlotMs));
  const windows = timeWindows(sorted, Math.min(maxSlots, sorted.length));
  const picks = windows.map(pickBest); // already chronological (windows are ordered)

  const slots: SelectedSlot[] = [];
  let used = 0;
  for (const c of picks) {
    const remaining = target - used;
    if (remaining < MIN_SLOT_MS) break;
    const want =
      c.type === 'clip' ? Math.min(c.clipDurationMs ?? photoSlotMs, CLIP_MAX_MS) : photoSlotMs;
    const durationMs = Math.min(want, remaining); // trim the last slot to fit the budget
    if (durationMs < MIN_SLOT_MS) break;
    slots.push({ inputRef: c.inputRef, type: c.type, durationMs });
    used += durationMs;
  }
  return slots;
}
