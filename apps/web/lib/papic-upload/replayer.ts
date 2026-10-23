// lib/papic-upload/replayer.ts — THE ONE page-side sender for saved Papic shots.
//
// Owner 2026-10-23: *"each phone can shoot continuously while uploading online
// works on the background"* — priorities reliability, speed, ease of use. The
// shutter saves a shot to this phone (IndexedDB) and is free at once; this loop
// sends it, piece by piece, whenever there is signal:
//
//   • ONE replayer per phone. No service-worker replayer and no Background Sync
//     (iOS has neither; two senders over one queue race). Between tabs, the Web
//     Locks API elects one sender; the others only save and announce.
//   • Two pieces in flight at once, in the order lib/papic-upload/schedule.ts
//     decides (every thumbnail before any display copy before any original).
//   • Woken by: a new shot, `online`, the page becoming visible, page open, and
//     its own back-off timer.
//   • Retries with exponential back-off + jitter on signal / server trouble;
//     drops a shot only for a refusal waiting can never fix (window closed, put
//     away, blocked); keeps — visibly — a shot refused for credits, because the
//     host can top up.
//   • Idempotent end to end by the shutter's clientCaptureId: a replayed PUT
//     overwrites one staging object, a replayed record answers `duplicate`.
//   • Screen Wake Lock while anything waits (Safari 16.4+), released when empty.
//
// Everything with I/O is injected (`UploaderDeps`) so the unit test drives the
// whole loop — offline, reconnect, duplicates — without a browser.

import {
  backoffMs,
  chipState,
  classifyAnswer,
  CREDITS_RECHECK_MS,
  currentPhase,
  jobKey,
  nextJobs,
  shotFinished,
  tiersInPhase,
  type ChipState,
  type QueuedShot,
  type UploadJob,
} from './schedule';
import type { CaptureLane, CapturePhase, CaptureTier } from './tiers';
import type { LocalPiece } from './store';
import type { LaneAnswer } from './lanes';
import type { PapicTransport } from './transport';

/** How long a saved shot may wait before the phone gives up on it (= the old queue's TTL). */
export const SHOT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PARALLEL_PUTS = 2;

export interface UploaderStore {
  saveShot(shot: QueuedShot): Promise<void>;
  saveBlob(shot: Pick<QueuedShot, 'id' | 'eventId'>, piece: LocalPiece, blob: Blob): Promise<void>;
  loadBlob(shotId: string, piece: LocalPiece): Promise<Blob | null>;
  deleteBlob(shotId: string, piece: LocalPiece): Promise<void>;
  deleteShot(shot: Pick<QueuedShot, 'id'>, pieces: readonly LocalPiece[]): Promise<void>;
  loadShots(): Promise<QueuedShot[]>;
}

export interface UploaderPrepare {
  photoPieces(original: Blob): Promise<{ thumb: Blob; tile: Blob; display: Blob } | null>;
  poster(source: Blob): Promise<Blob | null>;
  clipWeb(clip: Blob): Promise<Blob | null>;
  faceVectors(clean: Blob): Promise<{ vectors: number[][]; subjectCenter: { x: number; y: number } | null }>;
}

export interface UploaderDeps {
  store: UploaderStore;
  transport: () => PapicTransport;
  call: (lane: CaptureLane, body: Record<string, unknown>) => Promise<LaneAnswer>;
  bodies: {
    sign: (shot: QueuedShot, tier: CaptureTier) => Record<string, unknown>;
    record: (shot: QueuedShot) => Record<string, unknown>;
    attach: (shot: QueuedShot, tiers: readonly CaptureTier[]) => Record<string, unknown>;
  };
  prepare: UploaderPrepare;
  now: () => number;
  random: () => number;
  /** Wi-Fi (or unknown) — when an original may go. */
  fullAllowed: () => boolean;
  online: () => boolean;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (t: unknown) => void;
}

export type UploaderEvent =
  | { type: 'recorded'; shot: QueuedShot; body: Record<string, unknown> }
  | { type: 'refused'; shot: QueuedShot; code: string; body: Record<string, unknown> | null }
  | { type: 'credits'; shot: QueuedShot; code: string; body: Record<string, unknown> | null }
  | { type: 'done'; shot: QueuedShot };

export interface UploaderSnapshot {
  shots: QueuedShot[];
  chip: ChipState;
  online: boolean;
}

/** What the shutter hands over. Bytes are written before the shutter is freed. */
export interface NewShot {
  id: string;
  lane: CaptureLane;
  eventId: string;
  media: 'photo' | 'clip';
  capturedAtMs: number;
  durationMs?: number;
  sharePublicly?: boolean;
  consent?: boolean;
  deviceModel?: string;
  /** Photo: the saved JPEG. Clip: the recording. */
  primary: Blob;
  /** Clip: the poster frame (full size; shrunk in the background). */
  poster?: Blob | null;
  /** Guest mode_a only: the clean frame for the on-device face pass. */
  faceSource?: Blob | null;
}

const ALL_PIECES: readonly LocalPiece[] = [
  'thumb', 'tile', 'display', 'original', 'poster', 'clip_web', 'clip_raw', 'face', 'source',
];

export class PapicUploader {
  private shots = new Map<string, QueuedShot>();
  private inFlight = new Set<string>();
  private doneThisVisit = 0;
  private refused: { count: number; reason: string } | null = null;
  private listeners = new Set<(s: UploaderSnapshot) => void>();
  private eventListeners = new Set<(e: UploaderEvent) => void>();
  private preparing = false;
  private pumping = false;
  private pumpAgain = false;
  private timer: unknown = null;
  private netFailedAt = 0;
  private loaded: Promise<void> | null = null;
  /** False in a tab that is not the elected sender — it saves, never sends. */
  sender = true;

  constructor(private deps: UploaderDeps) {}

  /** Load what an earlier visit left behind. Idempotent. */
  load(): Promise<void> {
    if (!this.loaded) {
      this.loaded = (async () => {
        try {
          for (const s of await this.deps.store.loadShots()) {
            if (!this.shots.has(s.id)) this.shots.set(s.id, { ...s, hold: null, nextAttemptAtMs: 0 });
          }
        } catch {
          // IndexedDB unavailable (private mode): the live session still works.
        }
        this.notify();
      })();
    }
    return this.loaded;
  }

  /** Re-read the queue (another tab saved a shot). */
  async reload(): Promise<void> {
    try {
      for (const s of await this.deps.store.loadShots()) {
        if (!this.shots.has(s.id)) this.shots.set(s.id, s);
      }
    } catch {
      /* keep what we have */
    }
    this.notify();
    this.kick();
  }

  subscribe(fn: (s: UploaderSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  on(fn: (e: UploaderEvent) => void): () => void {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }

  snapshot(): UploaderSnapshot {
    const shots = [...this.shots.values()];
    const online = this.isOnline();
    return {
      shots,
      online,
      chip: chipState({ shots, online, doneThisVisit: this.doneThisVisit, refused: this.refused }),
    };
  }

  pending(): number {
    return this.shots.size;
  }

  private isOnline(): boolean {
    if (!this.deps.online()) return false;
    // A network failure in the last 15 s reads as offline until something lands.
    return this.deps.now() - this.netFailedAt > 15_000;
  }

  private notify(): void {
    const snap = this.snapshot();
    for (const fn of this.listeners) fn(snap);
  }

  private emit(e: UploaderEvent): void {
    for (const fn of this.eventListeners) fn(e);
  }

  /**
   * THE SHUTTER'S HAND-OFF. Writes the bytes to this phone, then returns —
   * no network. Throws only if the phone could not store the shot at all, so
   * the camera can say so instead of pretending it saved.
   */
  async addShot(input: NewShot): Promise<void> {
    await this.load();
    const nowMs = this.deps.now();
    const shot: QueuedShot = {
      id: input.id,
      lane: input.lane,
      eventId: input.eventId,
      media: input.media,
      capturedAtMs: input.capturedAtMs,
      queuedAtMs: nowMs,
      durationMs: input.durationMs,
      sharePublicly: input.sharePublicly,
      consent: input.consent,
      deviceModel: input.deviceModel,
      wantsFaceVectors: !!input.faceSource,
      prepared: false,
      tiers: {},
      settled: {},
      wantFull: null,
      attempts: 0,
      nextAttemptAtMs: 0,
      hold: null,
      lastError: null,
    };
    const type = input.primary.type || (input.media === 'clip' ? 'video/mp4' : 'image/jpeg');
    if (input.media === 'photo') {
      await this.deps.store.saveBlob(shot, 'original', input.primary);
      shot.tiers.original = { contentType: type, size: input.primary.size, uploaded: false };
    } else {
      await this.deps.store.saveBlob(shot, 'clip_raw', input.primary);
      shot.tiers.clip_raw = { contentType: type, size: input.primary.size, uploaded: false };
      if (input.poster) await this.deps.store.saveBlob(shot, 'source', input.poster);
    }
    if (input.faceSource) await this.deps.store.saveBlob(shot, 'face', input.faceSource);
    await this.deps.store.saveShot(shot);
    this.shots.set(shot.id, shot);
    // A new shot is a reason to re-ask anything held for credits.
    for (const s of this.shots.values()) if (s.hold === 'credits') s.hold = null;
    this.notify();
    this.kick();
  }

  /** Wake the loop (a trigger: shot, online, visible, open). Clears back-off. */
  wake(): void {
    const nowMs = this.deps.now();
    for (const s of this.shots.values()) {
      if (s.hold === 'credits') s.hold = null;
      if (s.nextAttemptAtMs > nowMs) s.nextAttemptAtMs = nowMs;
    }
    this.netFailedAt = 0;
    this.notify();
    this.kick();
  }

  kick(): void {
    if (!this.sender) return;
    void this.prepareNext();
    void this.pump();
  }

  // ── prepare: the small pieces, one shot at a time, off the shutter ───────
  private async prepareNext(): Promise<void> {
    if (this.preparing) return;
    this.preparing = true;
    try {
      for (;;) {
        // A guest clip's web copy needs the ffmpeg core from the network: made
        // offline it would fail, and the clip would then send its whole raw.
        // So a guest clip waits for signal to be prepared; photos never wait.
        const next = [...this.shots.values()]
          .filter((s) => !s.prepared && (s.media === 'photo' || s.lane !== 'guest' || this.deps.online()))
          .sort((a, b) => a.capturedAtMs - b.capturedAtMs)[0];
        if (!next) break;
        await this.prepareShot(next);
        this.notify();
        void this.pump();
      }
    } finally {
      this.preparing = false;
    }
  }

  private async prepareShot(shot: QueuedShot): Promise<void> {
    const { store, prepare } = this.deps;
    try {
      if (shot.media === 'photo') {
        const original = await store.loadBlob(shot.id, 'original');
        if (!original) return this.lose(shot, 'lost_on_phone');
        const pieces = await prepare.photoPieces(original);
        if (pieces) {
          for (const tier of ['thumb', 'tile', 'display'] as const) {
            await store.saveBlob(shot, tier, pieces[tier]);
            shot.tiers[tier] = { contentType: pieces[tier].type, size: pieces[tier].size, uploaded: false };
          }
        }
      } else {
        const source = await store.loadBlob(shot.id, 'source');
        if (source) {
          const poster = (await prepare.poster(source)) ?? source;
          await store.saveBlob(shot, 'poster', poster);
          shot.tiers.poster = { contentType: poster.type || 'image/jpeg', size: poster.size, uploaded: false };
          await store.deleteBlob(shot.id, 'source').catch(() => {});
        }
        if (shot.lane === 'guest') {
          const raw = await store.loadBlob(shot.id, 'clip_raw');
          const web = raw ? await prepare.clipWeb(raw) : null;
          if (web) {
            await store.saveBlob(shot, 'clip_web', web);
            shot.tiers.clip_web = { contentType: 'video/mp4', size: web.size, uploaded: false };
          }
        }
      }
      if (shot.wantsFaceVectors) {
        const clean = await store.loadBlob(shot.id, 'face');
        if (clean) {
          const fe = await prepare.faceVectors(clean);
          shot.faceVectors = fe.vectors;
          shot.subjectCenter = fe.subjectCenter;
        }
        await store.deleteBlob(shot.id, 'face').catch(() => {});
        shot.wantsFaceVectors = false;
      }
    } catch {
      // A piece that could not be made is simply not sent; the server makes it.
    }
    shot.prepared = true;
    await this.persist(shot);
  }

  // ── the send loop ─────────────────────────────────────────────────────────
  private async pump(): Promise<void> {
    if (!this.sender) return;
    if (this.pumping) {
      this.pumpAgain = true;
      return;
    }
    this.pumping = true;
    try {
      do {
        this.pumpAgain = false;
        this.expireOld();
        const jobs = nextJobs([...this.shots.values()], {
          nowMs: this.deps.now(),
          slots: PARALLEL_PUTS - this.inFlight.size,
          inFlight: this.inFlight,
          fullAllowed: this.deps.fullAllowed(),
        });
        for (const job of jobs) {
          const key = jobKey(job);
          this.inFlight.add(key);
          void this.run(job).finally(() => {
            this.inFlight.delete(key);
            this.notify();
            void this.pump();
          });
        }
      } while (this.pumpAgain);
    } finally {
      this.pumping = false;
    }
    this.armTimer();
  }

  /** Sleep until the earliest back-off ends. */
  private armTimer(): void {
    if (this.timer) this.deps.clearTimer(this.timer);
    this.timer = null;
    const nowMs = this.deps.now();
    const waits = [...this.shots.values()]
      .filter((s) => s.prepared && s.nextAttemptAtMs > nowMs)
      .map((s) => s.nextAttemptAtMs - nowMs);
    if (waits.length === 0) return;
    this.timer = this.deps.setTimer(() => {
      this.timer = null;
      void this.pump();
    }, Math.max(250, Math.min(...waits)));
  }

  private expireOld(): void {
    const nowMs = this.deps.now();
    for (const s of [...this.shots.values()]) {
      if (nowMs - s.queuedAtMs > SHOT_TTL_MS) void this.drop(s, 'expired', null);
    }
  }

  private async run(job: UploadJob): Promise<void> {
    const shot = this.shots.get(job.shotId);
    if (!shot) return;
    if (job.kind === 'put') await this.runPut(shot, job.tier);
    else await this.runSettle(shot, job.phase);
  }

  private async runPut(shot: QueuedShot, tier: CaptureTier): Promise<void> {
    const blob = await this.deps.store.loadBlob(shot.id, tier).catch(() => null);
    if (!blob) {
      // The bytes are gone from this phone (storage cleared). Nothing to send.
      delete shot.tiers[tier];
      if (tier === 'original' || tier === 'clip_raw' || tier === 'thumb' || tier === 'poster' || tier === 'clip_web') {
        if (currentPhase(shot) === 'record' && tiersInPhase(shot, 'record').length === 0) {
          return this.lose(shot, 'lost_on_phone');
        }
      }
      await this.persist(shot);
      return;
    }
    const answer = await this.deps.call(shot.lane, this.deps.bodies.sign(shot, tier));
    if (answer.httpStatus === 0) return this.netFail(shot, 'network');
    const verdict = classifyAnswer(answer.httpStatus, answer.body);
    if (verdict.verdict === 'ok') {
      if (answer.body?.already === true) return this.markUploaded(shot, tier);
      const url = typeof answer.body?.uploadUrl === 'string' ? answer.body.uploadUrl : null;
      if (!url) return this.retry(shot, 'no_url');
      const t = shot.tiers[tier]!;
      const put = await this.deps.transport().put({ url, contentType: t.contentType.split(';')[0]!, body: blob });
      if (put.ok) return this.markUploaded(shot, tier);
      if (put.status === null) return this.netFail(shot, 'put_network');
      return this.retry(shot, `put_${put.status}`);
    }
    return this.applyVerdict(shot, verdict, answer);
  }

  private async runSettle(shot: QueuedShot, phase: CapturePhase): Promise<void> {
    const tiers = tiersInPhase(shot, phase);
    const body =
      phase === 'record' ? this.deps.bodies.record(shot) : this.deps.bodies.attach(shot, tiers);
    const answer = await this.deps.call(shot.lane, body);
    if (answer.httpStatus === 0) return this.netFail(shot, 'network');
    const verdict = classifyAnswer(answer.httpStatus, answer.body);
    if (verdict.verdict !== 'ok') return this.applyVerdict(shot, verdict, answer);

    shot.settled[phase] = true;
    shot.attempts = 0;
    shot.lastError = null;
    this.netFailedAt = 0;
    for (const t of tiers) await this.deps.store.deleteBlob(shot.id, t).catch(() => {});
    if (phase === 'record') {
      shot.captureId = typeof answer.body?.captureId === 'string' ? answer.body.captureId : null;
      shot.wantFull = answer.body?.wantFull === false ? false : true;
      if (!shot.wantFull) await this.forgetFull(shot);
      this.emit({ type: 'recorded', shot, body: answer.body ?? {} });
    }
    // A display copy the screen refused ends the shot: nothing more to send.
    if (answer.body?.blocked === true) {
      for (const p of ['tile', 'display', 'original'] as const) delete shot.tiers[p];
      shot.settled.display = true;
      shot.settled.full = true;
    }
    if (shotFinished(shot)) return this.finish(shot);
    await this.persist(shot);
  }

  private async applyVerdict(
    shot: QueuedShot,
    verdict: ReturnType<typeof classifyAnswer>,
    answer: LaneAnswer,
  ): Promise<void> {
    switch (verdict.verdict) {
      case 'ok':
        return;
      case 'no_full':
        await this.forgetFull(shot);
        if (shotFinished(shot)) return this.finish(shot);
        return this.persist(shot);
      case 'credits':
        shot.hold = 'credits';
        shot.lastError = verdict.error;
        shot.nextAttemptAtMs = this.deps.now() + CREDITS_RECHECK_MS;
        this.emit({ type: 'credits', shot, code: verdict.error, body: answer.body });
        return this.persist(shot);
      case 'reupload': {
        const redo = verdict.tiers.length > 0 ? verdict.tiers : (Object.keys(shot.tiers) as CaptureTier[]);
        for (const t of redo) if (shot.tiers[t]) shot.tiers[t]!.uploaded = false;
        return this.retry(shot, verdict.error);
      }
      case 'drop':
        return this.drop(shot, verdict.error, answer.body);
      case 'retry':
        return this.retry(shot, verdict.error);
    }
  }

  private async markUploaded(shot: QueuedShot, tier: CaptureTier): Promise<void> {
    if (shot.tiers[tier]) shot.tiers[tier]!.uploaded = true;
    this.netFailedAt = 0;
    await this.persist(shot);
  }

  private async retry(shot: QueuedShot, error: string): Promise<void> {
    shot.attempts += 1;
    shot.lastError = error;
    shot.nextAttemptAtMs = this.deps.now() + backoffMs(shot.attempts - 1, this.deps.random());
    await this.persist(shot);
  }

  private async netFail(shot: QueuedShot, error: string): Promise<void> {
    this.netFailedAt = this.deps.now();
    await this.retry(shot, error);
  }

  private async forgetFull(shot: QueuedShot): Promise<void> {
    shot.wantFull = false;
    for (const t of tiersInPhase(shot, 'full')) {
      delete shot.tiers[t];
      await this.deps.store.deleteBlob(shot.id, t).catch(() => {});
    }
  }

  private async finish(shot: QueuedShot): Promise<void> {
    this.shots.delete(shot.id);
    this.doneThisVisit += 1;
    await this.deps.store.deleteShot(shot, ALL_PIECES).catch(() => {});
    this.emit({ type: 'done', shot });
    this.notify();
  }

  private async drop(shot: QueuedShot, code: string, body: Record<string, unknown> | null): Promise<void> {
    if (!this.shots.has(shot.id)) return;
    this.shots.delete(shot.id);
    this.refused = { count: (this.refused?.count ?? 0) + 1, reason: code };
    await this.deps.store.deleteShot(shot, ALL_PIECES).catch(() => {});
    this.emit({ type: 'refused', shot, code, body });
    this.notify();
  }

  private async lose(shot: QueuedShot, code: string): Promise<void> {
    return this.drop(shot, code, null);
  }

  private async persist(shot: QueuedShot): Promise<void> {
    if (!this.shots.has(shot.id)) return;
    try {
      await this.deps.store.saveShot(shot);
    } catch {
      // The in-memory copy still sends this visit.
    }
    this.notify();
  }
}
