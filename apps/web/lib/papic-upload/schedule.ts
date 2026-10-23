// lib/papic-upload/schedule.ts — the replayer's decisions, with no I/O.
//
// Pure so every rule here is a unit test: what to send next, how long to wait
// after a failure, which answers mean "try again", "stop for good" or "wait for
// credits", and what the status chip says. `replayer.ts` is the thin I/O loop
// that runs these against IndexedDB, fetch and the page's events.

import {
  PHASE_ORDER,
  phaseOf,
  type CaptureLane,
  type CapturePhase,
  type CaptureTier,
} from './tiers';

/** One tier of one shot, as the queue remembers it (the bytes live beside it). */
export interface QueuedTier {
  contentType: string;
  size: number;
  /** The PUT to R2 finished (2xx). */
  uploaded: boolean;
}

/**
 * One shot in the queue. Written at the shutter, rewritten as it progresses,
 * deleted when every phase it needs has been settled with the server.
 */
export interface QueuedShot {
  /** = the shutter's clientCaptureId. Also the IndexedDB item id. */
  id: string;
  lane: CaptureLane;
  eventId: string;
  media: 'photo' | 'clip';
  capturedAtMs: number;
  queuedAtMs: number;
  durationMs?: number;
  sharePublicly?: boolean;
  /** Guest lane, mode_a events only: run the on-device face pass before record. */
  wantsFaceVectors?: boolean;
  faceVectors?: number[][];
  subjectCenter?: { x: number; y: number } | null;
  /** Vendor lane: the controller's consent gate was passed for this shot. */
  consent?: boolean;
  deviceModel?: string;
  /** Tiers made from the saved original (false until the prepare step ran). */
  prepared: boolean;
  tiers: Partial<Record<CaptureTier, QueuedTier>>;
  /** Phases the server has acknowledged. */
  settled: Partial<Record<CapturePhase, boolean>>;
  /** Server's answer at record: does this event keep full-res? null = not asked yet. */
  wantFull: boolean | null;
  captureId?: string | null;
  attempts: number;
  nextAttemptAtMs: number;
  /** A refusal that waits for someone else (a top-up) rather than for signal. */
  hold?: 'credits' | null;
  lastError?: string | null;
}

export type UploadJob =
  | { kind: 'put'; shotId: string; tier: CaptureTier }
  | { kind: 'settle'; shotId: string; phase: CapturePhase };

export function jobKey(job: UploadJob): string {
  return job.kind === 'put' ? `put:${job.shotId}:${job.tier}` : `settle:${job.shotId}:${job.phase}`;
}

/** Tiers of a shot that belong to one phase (only those the shot actually has). */
export function tiersInPhase(shot: QueuedShot, phase: CapturePhase): CaptureTier[] {
  const hasClipWeb = !!shot.tiers.clip_web;
  return (Object.keys(shot.tiers) as CaptureTier[]).filter(
    (t) => phaseOf(t, { hasClipWeb }) === phase,
  );
}

/** Is there anything left to do in this phase? A phase with no tiers is trivially done. */
export function phaseDone(shot: QueuedShot, phase: CapturePhase): boolean {
  if (shot.settled[phase]) return true;
  if (tiersInPhase(shot, phase).length === 0) return true;
  // 'full' is only ever wanted when the server said so at record.
  if (phase === 'full' && shot.wantFull === false) return true;
  return false;
}

/** The phase this shot is working on, or null when it is finished. */
export function currentPhase(shot: QueuedShot): CapturePhase | null {
  for (const p of PHASE_ORDER) if (!phaseDone(shot, p)) return p;
  return null;
}

export function shotFinished(shot: QueuedShot): boolean {
  return currentPhase(shot) === null;
}

/**
 * The next jobs to start, at most `slots` of them.
 *
 * Order (owner relay 2026-10-23, "all tier-1s before any tier-3"): every
 * runnable 'record' job in the queue, oldest shot first; then 'display'; then
 * 'full' — and 'full' only when `fullAllowed` (Wi-Fi, or the connection type is
 * unknown) AND nothing earlier is left to start. A shot in back-off or held for
 * credits does not block the others.
 */
export function nextJobs(
  shots: readonly QueuedShot[],
  opts: { nowMs: number; slots: number; inFlight: ReadonlySet<string>; fullAllowed: boolean },
): UploadJob[] {
  const out: UploadJob[] = [];
  if (opts.slots <= 0) return out;
  const ordered = [...shots].sort((a, b) => a.capturedAtMs - b.capturedAtMs);
  const busyShots = new Set<string>();
  for (const k of opts.inFlight) {
    const id = k.split(':')[1];
    if (id) busyShots.add(id);
  }
  let earlierPending = false;
  for (const phase of PHASE_ORDER) {
    if (phase === 'full' && (!opts.fullAllowed || earlierPending)) break;
    for (const shot of ordered) {
      if (out.length >= opts.slots) return out;
      if (!shot.prepared || shot.hold || shot.nextAttemptAtMs > opts.nowMs) continue;
      if (currentPhase(shot) !== phase) continue;
      const tiers = tiersInPhase(shot, phase);
      const missing = tiers.filter((t) => !shot.tiers[t]!.uploaded);
      if (missing.length > 0) {
        for (const tier of missing) {
          const job: UploadJob = { kind: 'put', shotId: shot.id, tier };
          if (opts.inFlight.has(jobKey(job))) continue;
          if (out.length >= opts.slots) return out;
          out.push(job);
          earlierPending = true;
        }
        continue;
      }
      // Everything in the phase is up — settle it, once, when no PUT of this
      // shot is still running.
      if (busyShots.has(shot.id)) continue;
      const job: UploadJob = { kind: 'settle', shotId: shot.id, phase };
      if (opts.inFlight.has(jobKey(job))) continue;
      out.push(job);
      earlierPending = true;
    }
    // Anything of this phase still waiting to START keeps the later phases shut.
    if (ordered.some((s) => s.prepared && !s.hold && currentPhase(s) === phase)) {
      earlierPending = true;
    }
  }
  return out;
}

/** Exponential back-off with jitter: ~1 s, 2 s, 4 s … capped at 5 minutes. */
export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_CAP_MS = 5 * 60 * 1000;
/** A shot held for credits is asked again on this beat (and on every trigger). */
export const CREDITS_RECHECK_MS = 2 * 60 * 1000;

export function backoffMs(attempts: number, random: number): number {
  const exp = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts));
  const jitter = 0.5 + Math.min(1, Math.max(0, random));
  return Math.round(Math.min(BACKOFF_CAP_MS, exp * jitter));
}

// ── Answers ─────────────────────────────────────────────────────────────────

/**
 * What the replayer does with one server answer.
 *   ok       — move on
 *   retry    — signal / server trouble: back off and try again
 *   credits  — the event (or this guest) is out of credits: keep the shot, wait
 *   reupload — the server could not find / accept a tier's object: PUT it again
 *   drop     — this shot can never land (closed window, put away, blocked …)
 *   no_full  — the event does not keep full-res: forget the original / raw
 */
export type AnswerVerdict =
  | { verdict: 'ok' }
  | { verdict: 'retry'; error: string }
  | { verdict: 'credits'; error: string }
  | { verdict: 'reupload'; tiers: CaptureTier[]; error: string }
  | { verdict: 'drop'; error: string }
  | { verdict: 'no_full' };

/** Refusals that waiting for signal can never fix. */
export const PERMANENT_REFUSALS: ReadonlySet<string> = new Set([
  // guest lane
  'guest_capture_not_open_yet',
  'guest_capture_closed',
  'event_put_away',
  'blocked',
  'terms_required',
  'not_owned',
  'invalid_guest',
  // vendor lane
  'disabled',
  'consent_required',
  'no_vendor',
  'not_allowed',
  'video_not_allowed',
  'event_over',
  'no_event',
  // both — the shot itself is unacceptable
  'bad_type',
  'too_large',
  'too_small',
  'too_long',
  'bad_request',
  'bad_tier',
]);

/** "No credits right now" — a top-up can still land the shot later. */
export const CREDIT_REFUSALS: ReadonlySet<string> = new Set([
  'camera_points_exhausted',
  'quota_exhausted',
  'out_of_points',
]);

export function classifyAnswer(
  httpStatus: number,
  body: { status?: string; error?: string; missing?: unknown } | null,
): AnswerVerdict {
  const code = body?.error ?? body?.status ?? '';
  if (httpStatus >= 200 && httpStatus < 300 && (body?.status === 'ok' || body?.status === undefined)) {
    return { verdict: 'ok' };
  }
  if (code === 'full_not_wanted') return { verdict: 'no_full' };
  if (code === 'object_missing' || code === 'object_rejected') {
    const missing = Array.isArray(body?.missing)
      ? (body!.missing as unknown[]).filter((t): t is CaptureTier => typeof t === 'string')
      : [];
    return { verdict: 'reupload', tiers: missing, error: code };
  }
  if (CREDIT_REFUSALS.has(code)) return { verdict: 'credits', error: code };
  if (PERMANENT_REFUSALS.has(code)) return { verdict: 'drop', error: code };
  // 408 / 429 / 5xx / an unknown 4xx / a body we could not read — try again.
  return { verdict: 'retry', error: code || `http_${httpStatus}` };
}

// ── The status chip (corpus 0012_papic_offline_note.md §6, house words) ──────

export type ChipState =
  | { kind: 'idle' }
  | { kind: 'saved' }
  | { kind: 'sending'; n: number; of: number }
  | { kind: 'offline'; waiting: number }
  | { kind: 'credits'; waiting: number }
  | { kind: 'refused'; count: number; reason: string };

/**
 * What the chip says. A failure must never read like success or like nothing
 * (repo rule: the measurement must reach the render) — so "All saved" appears
 * ONLY when the queue is genuinely empty after this visit sent something.
 */
export function chipState(input: {
  shots: readonly QueuedShot[];
  online: boolean;
  /** Shots that finished during this visit (the M in "N of M"). */
  doneThisVisit: number;
  /** Shots dropped this visit for a permanent refusal, newest reason. */
  refused: { count: number; reason: string } | null;
}): ChipState {
  const { shots, online, doneThisVisit, refused } = input;
  const waiting = shots.length;
  if (refused && refused.count > 0 && waiting === 0) {
    return { kind: 'refused', count: refused.count, reason: refused.reason };
  }
  if (waiting === 0) return doneThisVisit > 0 ? { kind: 'saved' } : { kind: 'idle' };
  if (shots.every((s) => s.hold === 'credits')) return { kind: 'credits', waiting };
  if (!online) return { kind: 'offline', waiting };
  const of = doneThisVisit + waiting;
  return { kind: 'sending', n: Math.min(of, doneThisVisit + 1), of };
}

export function chipLabel(state: ChipState): string | null {
  switch (state.kind) {
    case 'idle':
      return null;
    case 'saved':
      return 'All saved';
    case 'sending':
      return `Sending ${state.n} of ${state.of}`;
    case 'offline':
      return `Offline · ${state.waiting} waiting`;
    case 'credits':
      return `Credits ran out · ${state.waiting} not sent`;
    case 'refused':
      return `${state.count} not saved`;
  }
}
