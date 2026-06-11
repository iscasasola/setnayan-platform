/**
 * apps/web/lib/camera-bridge/pairing-fsm.ts
 *
 * DslrPairing state machine (build plan C2) — owns the lifecycle
 * `disconnected → pairing → live → recording → fallback` for one phone ↔ one
 * DSLR pair, with:
 *
 *  - auto-retry of the primary bridge every `retryIntervalMs` (default 5 s),
 *  - fallback to the phone-internal bridge IMMEDIATELY on drop (well inside
 *    the locked "within 3 seconds" bar — the gesture shutter never stops),
 *  - gap-captures stamped `pairedCameraBrand: null` (0012 disconnect rule),
 *  - per-surface fallback semantics (build plan § 5b):
 *      papic     seamless swap; that's it.
 *      patiktok  a take in progress KEEPS RECORDING through the swap and gets
 *                a seam marker — never lose the take.
 *      panood    a live broadcast can't gap — the swap emits a continuity
 *                event so the publisher keeps RTMP alive (or shows a
 *                "technical difficulties" card).
 *  - the V1 1-phone:1-DSLR guard (second pairing on the same phone throws).
 *
 * Deterministic: all timing flows through the injectable `BridgeScheduler`,
 * so tests drive a virtual clock and production passes `realScheduler()`.
 */

import {
  BridgeSlotBusyError,
  type BridgeScheduler,
  type BridgeSurface,
  type CameraBridge,
  type CapturedFile,
  type Unsubscribe,
} from './types';

export type PairingState = 'disconnected' | 'pairing' | 'live' | 'recording' | 'fallback';

export interface TransitionEvent {
  atMs: number;
  from: PairingState;
  to: PairingState;
  reason:
    | 'start'
    | 'pair_success'
    | 'pair_failed'
    | 'primary_dropped'
    | 'primary_recovered'
    | 'take_started'
    | 'take_ended'
    | 'stopped';
}

/** Panood-only: emitted at the instant of a mid-broadcast swap. */
export interface ContinuityEvent {
  atMs: number;
  action: 'maintain-stream-continuity';
}

/** Patiktok-only: a mid-take source swap, recorded inside the take. */
export interface SeamMarker {
  atMs: number;
  fromBrand: string;
  toBrand: string;
}

export interface TakeSegment {
  /** Brand actually recording this segment ('mock'/'canon'/'internal'/…). */
  brand: string;
  startMs: number;
  endMs: number | null;
}

export interface CompletedTake {
  startMs: number;
  endMs: number;
  segments: TakeSegment[];
  seamMarkers: SeamMarker[];
}

export interface PairingControllerOptions {
  primary: CameraBridge;
  /** The phone-internal bridge — the always-available fallback target. */
  fallback: CameraBridge;
  surface: BridgeSurface;
  /** 1:1 guard key — one active pairing per phone in V1. */
  phoneId: string;
  scheduler: BridgeScheduler;
  /** Primary auto-retry cadence after a drop / failed pair. Default 5000. */
  retryIntervalMs?: number;
}

/** Module-level 1-phone:1-DSLR registry (V1 hard limit; multi-DSLR is V2). */
const activeSlots = new Map<string, DslrPairingController>();

/** Test hook — clear the 1:1 registry between cases. */
export function resetBridgeSlots(): void {
  activeSlots.clear();
}

export class DslrPairingController {
  private readonly primary: CameraBridge;
  private readonly fallback: CameraBridge;
  private readonly surface: BridgeSurface;
  private readonly phoneId: string;
  private readonly scheduler: BridgeScheduler;
  private readonly retryIntervalMs: number;

  private state: PairingState = 'disconnected';
  private transitions: TransitionEvent[] = [];
  private continuityEvents: ContinuityEvent[] = [];
  private listeners = new Set<(e: TransitionEvent) => void>();
  private unsubscribePrimary: Unsubscribe | null = null;
  private cancelRetry: Unsubscribe | null = null;
  private started = false;
  /** True while waiting out a deliberate stop (suppresses drop handling). */
  private stopping = false;

  // Stream-surface take state (independent of the pairing state so a take
  // survives a fallback swap).
  private takeActive = false;
  private takeStartMs = 0;
  private takeSegments: TakeSegment[] = [];
  private takeSeams: SeamMarker[] = [];
  /** Primary recovered mid-take → swap back only at take end (avoid a 2nd seam). */
  private pendingSwapBack = false;

  constructor(opts: PairingControllerOptions) {
    this.primary = opts.primary;
    this.fallback = opts.fallback;
    this.surface = opts.surface;
    this.phoneId = opts.phoneId;
    this.scheduler = opts.scheduler;
    this.retryIntervalMs = opts.retryIntervalMs ?? 5000;
  }

  // ── public surface ────────────────────────────────────────────────────────

  getState(): PairingState {
    return this.state;
  }

  getTransitions(): readonly TransitionEvent[] {
    return this.transitions;
  }

  getContinuityEvents(): readonly ContinuityEvent[] {
    return this.continuityEvents;
  }

  onTransition(cb: (e: TransitionEvent) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** The bridge captures route through right now. */
  activeBridge(): CameraBridge {
    return this.primaryIsLive() ? this.primary : this.fallback;
  }

  /**
   * Begin the pairing session. Throws `BridgeSlotBusyError` if this phone
   * already holds an active pairing (V1 1:1 guard). A failed first pair does
   * NOT throw — the controller stays in `pairing` and auto-retries, with the
   * fallback bridge serving captures meanwhile (the shutter never blocks).
   */
  async start(): Promise<void> {
    const holder = activeSlots.get(this.phoneId);
    if (holder && holder !== this) throw new BridgeSlotBusyError(this.phoneId);
    activeSlots.set(this.phoneId, this);
    this.started = true;
    this.stopping = false;

    // The phone-internal fallback is the always-available base camera — bring
    // it up first so the gesture shutter can fire from second zero, even while
    // the DSLR pair is still limping (captures stamped null until live).
    await this.fallback.connect().catch(() => undefined);

    this.unsubscribePrimary = this.primary.onStatusChange((status, previous) => {
      if (status === 'disconnected' && previous !== 'pairing' && !this.stopping) {
        this.handlePrimaryDrop();
      }
    });

    this.transition('pairing', 'start');
    await this.tryPair('pair_success');
  }

  /** End the session: release the slot, cancel retries, disconnect cleanly. */
  async stop(): Promise<void> {
    this.stopping = true;
    this.cancelRetryTimer();
    this.unsubscribePrimary?.();
    this.unsubscribePrimary = null;
    if (this.takeActive) this.endTake();
    await this.primary.disconnect().catch(() => undefined);
    if (activeSlots.get(this.phoneId) === this) activeSlots.delete(this.phoneId);
    this.started = false;
    this.transition('disconnected', 'stopped');
  }

  /**
   * Fire a still through the active bridge. Captures served by the fallback
   * (mid-gap or while pairing) are stamped `pairedCameraBrand: null` per the
   * 0012 disconnect rule — they are phone-sensor gap-captures, not DSLR shots.
   */
  async captureStill(opts?: { flash?: boolean }): Promise<CapturedFile> {
    const viaPrimary = this.primaryIsLive();
    const file = await this.activeBridge().triggerStill(opts);
    return viaPrimary ? file : { ...file, pairedCameraBrand: null, pairedCameraModel: null };
  }

  /** Fire a fixed-duration clip (Papic file path) — same gap-stamping rule. */
  async captureClip(opts: { durationMs: number; light?: boolean }): Promise<CapturedFile> {
    const viaPrimary = this.primaryIsLive();
    const file = await this.activeBridge().triggerClip(opts);
    return viaPrimary ? file : { ...file, pairedCameraBrand: null, pairedCameraModel: null };
  }

  /**
   * Stream surfaces (patiktok / panood): begin a take fed by the active
   * bridge's `livePreview()` stream. The take's segment list records which
   * source actually fed each span.
   */
  beginTake(): void {
    if (this.surface === 'papic') {
      throw new Error('beginTake() is a stream-surface API; papic uses captureStill/captureClip');
    }
    if (this.takeActive) throw new Error('a take is already in progress');
    this.takeActive = true;
    this.takeStartMs = this.scheduler.now();
    this.takeSegments = [
      { brand: this.activeBridge().brand, startMs: this.takeStartMs, endMs: null },
    ];
    this.takeSeams = [];
    if (this.primaryIsLive()) this.transition('recording', 'take_started');
  }

  /** End the take and get its source-accurate segment map. */
  endTake(): CompletedTake {
    if (!this.takeActive) throw new Error('no take in progress');
    const endMs = this.scheduler.now();
    const open = this.takeSegments[this.takeSegments.length - 1];
    if (open && open.endMs === null) open.endMs = endMs;
    const take: CompletedTake = {
      startMs: this.takeStartMs,
      endMs,
      segments: this.takeSegments,
      seamMarkers: this.takeSeams,
    };
    this.takeActive = false;
    if (this.state === 'recording') this.transition('live', 'take_ended');
    if (this.pendingSwapBack) {
      this.pendingSwapBack = false;
      if (this.primaryIsLive()) this.transition('live', 'primary_recovered');
    }
    return take;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private primaryIsLive(): boolean {
    return this.primary.status === 'live' || this.primary.status === 'recording';
  }

  private transition(to: PairingState, reason: TransitionEvent['reason']): void {
    if (to === this.state) return;
    const e: TransitionEvent = { atMs: this.scheduler.now(), from: this.state, to, reason };
    this.state = to;
    this.transitions.push(e);
    for (const l of [...this.listeners]) l(e);
  }

  private async tryPair(successReason: 'pair_success' | 'primary_recovered'): Promise<void> {
    try {
      await this.primary.connect();
      this.cancelRetryTimer();
      if (!this.started || this.stopping) return;
      if (this.takeActive) {
        // Mid-take recovery: don't introduce a second seam — swap back when
        // the take ends.
        this.pendingSwapBack = true;
        return;
      }
      this.transition('live', successReason);
    } catch {
      if (!this.started || this.stopping) return;
      if (this.state === 'pairing') this.transition('pairing', 'pair_failed');
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    this.cancelRetryTimer();
    this.cancelRetry = this.scheduler.schedule(() => {
      this.cancelRetry = null;
      void this.tryPair(this.state === 'pairing' ? 'pair_success' : 'primary_recovered');
    }, this.retryIntervalMs);
  }

  private cancelRetryTimer(): void {
    this.cancelRetry?.();
    this.cancelRetry = null;
  }

  private handlePrimaryDrop(): void {
    if (!this.started) return;
    const atMs = this.scheduler.now();

    // The swap to the phone-internal bridge is IMMEDIATE on every surface —
    // activeBridge() already routes to the fallback the moment the primary is
    // down, so the gesture shutter keeps firing with zero gap (well inside
    // the locked 3-second bar). The per-surface differences are about what
    // ELSE must happen:
    if (this.surface === 'panood') {
      // A live broadcast cannot gap silently — surface the continuity demand.
      this.continuityEvents.push({ atMs, action: 'maintain-stream-continuity' });
    }
    if (this.takeActive) {
      // Patiktok rule: never lose the take. Close the primary-fed segment,
      // open a fallback-fed one, and record the seam.
      const open = this.takeSegments[this.takeSegments.length - 1];
      if (open && open.endMs === null) open.endMs = atMs;
      this.takeSeams.push({
        atMs,
        fromBrand: open?.brand ?? this.primary.brand,
        toBrand: this.fallback.brand,
      });
      this.takeSegments.push({ brand: this.fallback.brand, startMs: atMs, endMs: null });
    }

    this.transition('fallback', 'primary_dropped');

    // Reconnect policy: one immediate attempt, then the 5 s cadence.
    void this.tryPair('primary_recovered');
  }
}
