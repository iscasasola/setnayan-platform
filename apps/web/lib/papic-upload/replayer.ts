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
//   • Retries with exponential back-off + jitter on signal / server trouble.
//     DROPS a shot only when the hosts blocked the guest. Everything else is
//     KEPT on the phone, visibly, and asked again: credits (a top-up), the
//     capture window / put-away / event over / photo terms (review 2026-10-23
//     blocker 1 · 2026-10-24) — a kept shot never ages out.
//   • Sends only a shot whose event AND person have a camera open on this page
//     (`register` / `canSend`, review 2026-10-23 blocker 2); a shot adopted from
//     the old queue waits for "Send as me" (`confirmAdopted`).
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
/**
 * The small pieces are made only after the camera has been quiet this long, so
 * the decode + resize never competes with a burst of shutter presses (it all
 * runs on the page's one thread).
 */
export const PREPARE_QUIET_MS = 800;
/** …but never deferred longer than this, so a guest who never stops shooting still uploads. */
export const PREPARE_MAX_DEFER_MS = 3000;

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
  /** Refused today, KEPT on the phone (the window, put-away …) — never deleted. */
  | { type: 'kept'; shot: QueuedShot; code: string; body: Record<string, unknown> | null }
  /** A phase the server acknowledged ('display' = the display copy is on the row). */
  | { type: 'settled'; shot: QueuedShot; phase: CapturePhase }
  | { type: 'done'; shot: QueuedShot };

/** A camera open on this page: the shots it may send (its event + its person). */
export interface UploadContext {
  lane: CaptureLane;
  eventId: string;
  /** The server-stamped owner tag of the person holding this camera. */
  ownerTag: string | null;
}

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
  /** The camera's owner tag (see QueuedShot.ownerTag). */
  ownerTag?: string | null;
  /** From the old queue: held until confirmed (see QueuedShot.adopted). */
  adopted?: boolean;
}

/** A 'kept' shot is asked again on this beat (and on every wake). */
export const KEPT_RECHECK_MS = 30 * 60 * 1000;

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
  private lastShotAtMs = 0;
  private prepareTimer: unknown = null;
  private contexts: UploadContext[] = [];
  private loaded: Promise<void> | null = null;
  /** False in a tab that is not the elected sender — it saves, never sends. */
  sender = true;

  /**
   * Bytes this visit could not write to the phone (no IndexedDB at all — some
   * private modes). The shot still sends while the page is open; it is just
   * not durable across a reload, which is no worse than the camera before.
   */
  private memBlobs = new Map<string, Blob>();

  constructor(private deps: UploaderDeps) {}

  private async putBlob(shot: Pick<QueuedShot, 'id' | 'eventId'>, piece: LocalPiece, blob: Blob): Promise<void> {
    try {
      await this.deps.store.saveBlob(shot, piece, blob);
    } catch {
      this.memBlobs.set(`${shot.id}:${piece}`, blob);
    }
  }

  private async getBlob(shotId: string, piece: LocalPiece): Promise<Blob | null> {
    const mem = this.memBlobs.get(`${shotId}:${piece}`);
    if (mem) return mem;
    return this.deps.store.loadBlob(shotId, piece).catch(() => null);
  }

  private async dropBlob(shotId: string, piece: LocalPiece): Promise<void> {
    this.memBlobs.delete(`${shotId}:${piece}`);
    await this.deps.store.deleteBlob(shotId, piece).catch(() => {});
  }

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

  /**
   * Re-read the queue (another tab saved or sent a shot). The SENDER only adds
   * shots it does not know; a tab that is NOT the sender takes the stored state
   * as the truth, so its chip follows what the sender is doing instead of saying
   * "Sending" about shots that already landed (review 2026-10-23, minor 9).
   */
  async reload(): Promise<void> {
    try {
      const stored = await this.deps.store.loadShots();
      if (this.sender) {
        for (const s of stored) if (!this.shots.has(s.id)) this.shots.set(s.id, s);
      } else {
        const keep = [...this.shots.values()].filter((s) => s.memoryOnly);
        this.shots = new Map(stored.map((s) => [s.id, s]));
        for (const s of keep) this.shots.set(s.id, s);
      }
    } catch {
      /* keep what we have */
    }
    this.notify();
    this.kick();
  }

  /**
   * A camera opened on this page. Only the shots of an open camera's event and
   * person are sent; the rest wait on the phone (review 2026-10-23, blocker 2).
   */
  register(ctx: UploadContext): () => void {
    this.contexts.push(ctx);
    for (const s of this.shots.values()) if (s.hold === 'context' && this.canSend(s)) s.hold = null;
    this.notify();
    this.kick();
    return () => {
      this.contexts = this.contexts.filter((c) => c !== ctx);
      this.notify();
    };
  }

  /** Is a camera for this shot's event and person open here? */
  canSend(shot: QueuedShot): boolean {
    // Nobody wrote down who took an adopted shot: it waits for "Send as me".
    if (shot.adopted && !shot.ownerTag) return false;
    return this.contexts.some(
      (c) =>
        c.lane === shot.lane &&
        c.eventId === shot.eventId &&
        // A camera page with no seal (no tag at all) is bound by the server's
        // own session checks; otherwise the tags must match.
        (!shot.ownerTag || !c.ownerTag || c.ownerTag === shot.ownerTag),
    );
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
      chip: chipState({
        shots,
        online,
        doneThisVisit: this.doneThisVisit,
        refused: this.refused,
        canSend: (s) => this.canSend(s),
      }),
    };
  }

  pending(): number {
    return this.shots.size;
  }

  /** For the lab and the diagnostic page: what the loop is doing right now. */
  debugState(): { sender: boolean; inFlight: string[]; pumping: boolean; preparing: boolean; netFailedAt: number } {
    return {
      sender: this.sender,
      inFlight: [...this.inFlight],
      pumping: this.pumping,
      preparing: this.preparing,
      netFailedAt: this.netFailedAt,
    };
  }

  private isOnline(): boolean {
    if (!this.deps.online()) return false;
    // A network failure reads as offline until something lands again (or the
    // browser says the link came back) — the browser's own flag says "online"
    // on a venue Wi-Fi that reaches nothing.
    return this.netFailedAt === 0;
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
   * no network. Where the phone refuses to store them (a private mode with no
   * IndexedDB), the bytes stay in this page's memory and still send while it is
   * open: the camera never refuses a shot over storage.
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
      ownerTag: input.ownerTag ?? null,
      adopted: input.adopted === true && !input.ownerTag,
    };
    const type = input.primary.type || (input.media === 'clip' ? 'video/mp4' : 'image/jpeg');
    const kept = this.memBlobs.size;
    if (input.media === 'photo') {
      await this.putBlob(shot, 'original', input.primary);
      shot.tiers.original = { contentType: type, size: input.primary.size, uploaded: false };
    } else {
      await this.putBlob(shot, 'clip_raw', input.primary);
      shot.tiers.clip_raw = { contentType: type, size: input.primary.size, uploaded: false };
      if (input.poster) await this.putBlob(shot, 'source', input.poster);
    }
    if (input.faceSource) await this.putBlob(shot, 'face', input.faceSource);
    // The phone refused the bytes: they live in this page only — and the chip
    // says so ("Keep this page open · not saved on the phone"), never "safe".
    if (this.memBlobs.size > kept) shot.memoryOnly = true;
    try {
      await this.deps.store.saveShot(shot);
    } catch {
      shot.memoryOnly = true;
    }
    this.shots.set(shot.id, shot);
    this.lastShotAtMs = nowMs;
    // A new shot is a reason to re-ask anything held for credits.
    for (const s of this.shots.values()) if (s.hold === 'credits') s.hold = null;
    this.notify();
    this.kick();
  }

  /**
   * "Send as me": the person holding a camera open on this page claims the
   * old-queue shots of THAT camera's event — their tag goes on, and they send.
   * Shots of an event with no camera open here stay held. Returns how many.
   */
  async confirmAdopted(): Promise<number> {
    let n = 0;
    for (const s of this.shots.values()) {
      if (!s.adopted || s.ownerTag) continue;
      const ctx = this.contexts.find((c) => c.lane === s.lane && c.eventId === s.eventId);
      if (!ctx) continue;
      s.ownerTag = ctx.ownerTag;
      s.adopted = false;
      // Its week starts now — the time it waited for the person is not "no signal".
      s.queuedAtMs = this.deps.now();
      n += 1;
      await this.deps.store.saveShot(s).catch(() => {});
    }
    if (n > 0) this.wake();
    return n;
  }

  /** Wake the loop (a trigger: shot, online, visible, open). Clears back-off. */
  wake(): void {
    const nowMs = this.deps.now();
    for (const s of this.shots.values()) {
      if (s.hold === 'credits' || s.hold === 'kept') s.hold = null;
      if (s.hold === 'context' && this.canSend(s)) s.hold = null;
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
        const nowMs = this.deps.now();
        const quietFor = nowMs - this.lastShotAtMs;
        const oldestWaiting = Math.min(
          ...[...this.shots.values()].filter((s) => !s.prepared).map((s) => s.queuedAtMs),
        );
        if (quietFor < PREPARE_QUIET_MS && nowMs - oldestWaiting < PREPARE_MAX_DEFER_MS) {
          if (!this.prepareTimer) {
            const wait = Math.min(PREPARE_QUIET_MS - quietFor, PREPARE_MAX_DEFER_MS - (nowMs - oldestWaiting));
            this.prepareTimer = this.deps.setTimer(() => {
              this.prepareTimer = null;
              void this.prepareNext();
            }, Math.max(20, wait + 20));
          }
          break;
        }
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
    const { prepare } = this.deps;
    try {
      if (shot.media === 'photo') {
        const original = await this.getBlob(shot.id, 'original');
        if (!original) return this.lose(shot, 'lost_on_phone');
        const pieces = await prepare.photoPieces(original);
        if (pieces) {
          for (const tier of ['thumb', 'tile', 'display'] as const) {
            await this.putBlob(shot, tier, pieces[tier]);
            shot.tiers[tier] = { contentType: pieces[tier].type, size: pieces[tier].size, uploaded: false };
          }
        }
      } else {
        const source = await this.getBlob(shot.id, 'source');
        if (source) {
          const poster = (await prepare.poster(source)) ?? source;
          await this.putBlob(shot, 'poster', poster);
          shot.tiers.poster = { contentType: poster.type || 'image/jpeg', size: poster.size, uploaded: false };
          await this.dropBlob(shot.id, 'source');
        }
        if (shot.lane === 'guest') {
          const raw = await this.getBlob(shot.id, 'clip_raw');
          const web = raw ? await prepare.clipWeb(raw) : null;
          if (web) {
            await this.putBlob(shot, 'clip_web', web);
            shot.tiers.clip_web = { contentType: 'video/mp4', size: web.size, uploaded: false };
          }
        }
      }
      if (shot.wantsFaceVectors) {
        const clean = await this.getBlob(shot.id, 'face');
        if (clean) {
          const fe = await prepare.faceVectors(clean);
          shot.faceVectors = fe.vectors;
          shot.subjectCenter = fe.subjectCenter;
        }
        await this.dropBlob(shot.id, 'face');
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
          canSend: (s) => this.canSend(s),
          // A PHOTO still being prepared has its thumbnail in a moment (~0.1 s
          // a shot) — hold the later phases for it. A clip is not waited for:
          // its web copy can take a minute to make, and nothing should stall
          // behind that.
          preparing: [...this.shots.values()].some((s) => !s.prepared && s.media === 'photo'),
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
      .filter((s) => s.prepared && s.hold !== 'context' && s.nextAttemptAtMs > nowMs)
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
      // A shot KEPT for a refusal (the window, put-away) or waiting for its own
      // camera is never aged out — "kept on this phone" means kept.
      if (s.hold === 'kept' || s.hold === 'context' || s.keptReason || s.adopted) continue;
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
    const blob = await this.getBlob(shot.id, tier);
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
    for (const t of tiers) await this.dropBlob(shot.id, t);
    this.emit({ type: 'settled', shot, phase });
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
      case 'kept':
        // 🔒 KEPT, never deleted (review 2026-10-23, blocker 1). Asked again on
        // every wake and every KEPT_RECHECK_MS — the host can reopen, the
        // server judges by the shutter's own time.
        shot.hold = 'kept';
        shot.keptReason = verdict.error;
        shot.lastError = verdict.error;
        shot.nextAttemptAtMs = this.deps.now() + KEPT_RECHECK_MS;
        this.emit({ type: 'kept', shot, code: verdict.error, body: answer.body });
        return this.persist(shot);
      case 'context':
        // This phone now speaks for another event or person: wait for this
        // shot's own camera to be open again. Never recorded elsewhere.
        shot.hold = 'context';
        shot.lastError = verdict.error;
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
      await this.dropBlob(shot.id, t);
    }
  }

  private async finish(shot: QueuedShot): Promise<void> {
    this.shots.delete(shot.id);
    this.doneThisVisit += 1;
    for (const p of ALL_PIECES) this.memBlobs.delete(`${shot.id}:${p}`);
    await this.deps.store.deleteShot(shot, ALL_PIECES).catch(() => {});
    this.emit({ type: 'done', shot });
    this.notify();
  }

  private async drop(shot: QueuedShot, code: string, body: Record<string, unknown> | null): Promise<void> {
    if (!this.shots.has(shot.id)) return;
    this.shots.delete(shot.id);
    this.refused = { count: (this.refused?.count ?? 0) + 1, reason: code };
    for (const p of ALL_PIECES) this.memBlobs.delete(`${shot.id}:${p}`);
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
