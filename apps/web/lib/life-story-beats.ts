/**
 * Life Story · beat compiler — the flash's script, as a pure function.
 *
 * compileBeats(graph) → the ordered cinematic arc the flash plays:
 *
 *   1. face_open        — the most-recurring person, out of darkness
 *   2. moment × 3–5     — top-significance, burst-deduped, event-breadth aware
 *   3. perspective      — "this is how {name} saw that day" (another person's
 *                         camera, within the viewer's OWN event — Phase-1 scope)
 *   4. memoriam_hold    — the ✦ beat: longest dwell, only when an opt-in
 *                         in_memoriam person appears in the graph. Never synthesized.
 *   5. present_forward  — ALWAYS last, never omitted: the newest moment +
 *                         "keep giving it days worth remembering" → event creation.
 *                         The arc ends on the present, pointing forward — never
 *                         at death (owner-locked framing, 2026-07-08).
 *
 * ≤ MAX_BEATS total — the bounded-arc evidence (strategy §1: structured,
 * time-bounded life-review outperforms open-ended; ~≤8 chapters).
 *
 * Pure module: deterministic, no I/O, no Date.now(). The GSAP layer (PR-4)
 * only renders what this returns — so the emotional arc itself is unit-tested.
 */

import type { MomentGraph, MomentPerson, ScoredMoment } from './life-story-types';
import { sortBySignificance } from './life-story-significance';

/** Hard cap on the arc length (face + moments + specials + ending). */
export const MAX_BEATS = 8;
/** Floor so the fixed beats (face/perspective/memoriam/present) always fit. */
export const MIN_BEATS = 5;

/** Dwell suggestions (ms). The flash may ease around these but not reorder. */
export const DWELL_MS = {
  face: 4200,
  momentFloor: 2600,
  momentScale: 4200, // dwell = floor + significance × scale
  perspective: 5200,
  memoriam: 6000, // the longest hold — "the gone get the silences"
} as const;

export type Beat =
  | { kind: 'face_open'; person: MomentPerson; dwellMs: number }
  | { kind: 'moment'; moment: ScoredMoment; dwellMs: number }
  | { kind: 'perspective'; moment: ScoredMoment; dwellMs: number }
  | { kind: 'memoriam_hold'; moment: ScoredMoment; person: MomentPerson; dwellMs: number }
  /** moment is the newest frame, or null on an empty graph; dwell is open-ended (holds on the CTA). */
  | { kind: 'present_forward'; moment: ScoredMoment | null; dwellMs: null };

export type CompileBeatsOptions = {
  /** Clamped to [MIN_BEATS, MAX_BEATS]. */
  maxBeats?: number;
};

export function compileBeats(graph: MomentGraph, opts: CompileBeatsOptions = {}): Beat[] {
  const maxBeats = Math.min(MAX_BEATS, Math.max(MIN_BEATS, opts.maxBeats ?? MAX_BEATS));
  const sorted = sortBySignificance(graph.moments);
  const beats: Beat[] = [];

  // 1. Open on a face — highest recurrence, deterministic tie-break.
  const topPerson =
    [...graph.people].sort(
      (a, b) => b.recurrence - a.recurrence || a.personId.localeCompare(b.personId),
    )[0] ?? null;
  if (topPerson) beats.push({ kind: 'face_open', person: topPerson, dwellMs: DWELL_MS.face });

  // Reserve the two signature specials before filling the middle.
  const memoriamMoment =
    sorted.find((m) => m.peoplePresent.some((p) => p.inMemoriam)) ?? null;

  const viewerPersonId = graph.viewer.personId;
  const perspectiveMoment =
    sorted.find(
      (m) =>
        m.id !== memoriamMoment?.id &&
        m.capturedBy.kind !== 'self' &&
        m.capturedBy.personId !== null &&
        m.capturedBy.personId !== viewerPersonId &&
        m.capturedBy.displayName !== null,
    ) ?? null;

  // Ending anchor — the newest frame (reuse of an earlier beat's moment is
  // acceptable here; the ending must never be dropped for dedup reasons).
  const newest =
    [...graph.moments].sort(
      (a, b) => b.capturedAt.localeCompare(a.capturedAt) || a.id.localeCompare(b.id),
    )[0] ?? null;

  const reservedIds = new Set(
    [memoriamMoment?.id, perspectiveMoment?.id].filter((id): id is string => Boolean(id)),
  );

  // 2. Middle: top-significance moments, one per burst cluster.
  const fixedCount =
    beats.length + (perspectiveMoment ? 1 : 0) + (memoriamMoment ? 1 : 0) + 1; // +1 present_forward
  const middleSlots = Math.max(0, maxBeats - fixedCount);
  const seenClusters = new Set<string>();
  const middle: ScoredMoment[] = [];
  for (const m of sorted) {
    if (middle.length >= middleSlots) break;
    if (reservedIds.has(m.id)) continue;
    if (m.clusterId) {
      if (seenClusters.has(m.clusterId)) continue;
      seenClusters.add(m.clusterId);
    }
    middle.push(m);
  }

  // Soft breadth: when the graph spans ≥2 events but the middle collapsed onto
  // one, swap the weakest pick for the best moment of another event.
  if (middle.length >= 2 && new Set(middle.map((m) => m.eventId)).size === 1) {
    const homeEventId = middle[0]!.eventId;
    const alt = sorted.find(
      (m) =>
        m.eventId !== homeEventId &&
        !reservedIds.has(m.id) &&
        !middle.some((picked) => picked.id === m.id),
    );
    if (alt) middle[middle.length - 1] = alt;
  }

  for (const m of middle) {
    beats.push({
      kind: 'moment',
      moment: m,
      dwellMs: Math.round(DWELL_MS.momentFloor + m.significance * DWELL_MS.momentScale),
    });
  }

  // 3. The perspective turn.
  if (perspectiveMoment) {
    beats.push({ kind: 'perspective', moment: perspectiveMoment, dwellMs: DWELL_MS.perspective });
  }

  // 4. The ✦ hold — quietest and longest. Only ever from an opt-in flag.
  if (memoriamMoment) {
    const person = memoriamMoment.peoplePresent.find((p) => p.inMemoriam)!;
    beats.push({
      kind: 'memoriam_hold',
      moment: memoriamMoment,
      person,
      dwellMs: DWELL_MS.memoriam,
    });
  }

  // 5. The present, pointing forward — always, even on an empty graph.
  beats.push({ kind: 'present_forward', moment: newest, dwellMs: null });

  return beats;
}
