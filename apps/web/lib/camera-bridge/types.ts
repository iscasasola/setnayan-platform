/**
 * apps/web/lib/camera-bridge/types.ts
 *
 * Camera Bridge — the brand-agnostic phone-as-bridge core protocol (C1 of the
 * Camera Bridge build plan, corpus `0012_papic/Camera_Bridge_Build_Plan_2026-06-11.md`).
 *
 * TypeScript mirror (1:1) of the Swift `CameraBridge` protocol locked in
 * `0012_papic_sdk_notes.md` § "The interface is" — the contract every brand
 * adapter implements and every surface sink consumes:
 *
 *   SOURCE side (brands)            CORE                SINK side (surfaces)
 *   CanonBridge (CCAPI) ──┐                          ┌─ Papic    (files → gallery)
 *   InternalBridge ───────┼─► CameraBridge + FSM ───┼─ Patiktok (stream → record)
 *   MockBridge (CI/dev) ──┘                          └─ Panood   (stream → publish)
 *
 * Load-bearing dispatch invariant (build plan § 2): file-producing methods
 * (`triggerStill` / `triggerClip`) feed the PAPIC sink; the `livePreview()`
 * stream feeds the PANOOD and PATIKTOK sinks. A new brand implements ONLY this
 * interface; a new surface implements only a sink. Neither axis may silently
 * become multiplicative.
 *
 * Transport is WiFi-SDK only in V1 (USB tether is V2; BLE cannot carry
 * image/video at all — the shipped BLE manifest perms were drift, corrected in
 * the same PR that adds this module).
 */

/**
 * Brands. `canon` is the only V1 vendor lane (CCAPI is the sole genuine
 * mobile-WiFi capture API — build plan § 1). `internal` is the phone's own
 * camera (the disconnect-fallback target and a first-class 5th implementation);
 * `mock` exists for CI/dev so the entire chain runs with zero hardware.
 * `nikon` / `sony` / `fujifilm` are reserved: Sony + Nikon have no mobile
 * capture SDK (capability gap, V2-only via a venue sidecar); Fujifilm is
 * Android-USB-only with a warranty-voiding EULA (conditional, owner-gated).
 */
export type BridgeBrand = 'canon' | 'nikon' | 'sony' | 'fujifilm' | 'internal' | 'mock';

/** Mirror of the Swift `BridgeStatus`: disconnected | pairing | live | recording. */
export type BridgeStatus = 'disconnected' | 'pairing' | 'live' | 'recording';

/**
 * Papic product lock (0012 § "Gesture shutter"): every clip is EXACTLY 5
 * seconds — not "up to". The core rejects any `triggerClip` beyond this so no
 * brand adapter can drift past the cap. (Patiktok/Panood takes are NOT clips —
 * they consume the `livePreview()` stream, never `triggerClip`.)
 */
export const PAPIC_CLIP_DURATION_MS = 5000;

/** One live-view frame. CCAPI live view is a JPEG pull (~720p), not H.264. */
export interface VideoFrame {
  jpegBytes: Uint8Array;
  widthPx: number;
  heightPx: number;
  /** Bridge-clock capture timestamp (ms). */
  timestampMs: number;
  /** Monotonic frame counter from connect(). */
  sequence: number;
}

/** A file the DSLR produced and transferred to the phone over WiFi. */
export interface CapturedFile {
  kind: 'still' | 'clip';
  bytes: Uint8Array;
  mimeType: string;
  /** Bridge-clock capture timestamp (ms since epoch). */
  capturedAtMs: number;
  /** Clip length; stills omit it. */
  durationMs?: number;
  /**
   * Brand stamped on the capture for `papic_photos.paired_camera_brand`.
   * NULL when the file came from the fallback phone sensor mid-gap (the FSM
   * stamps gap-captures `pairedCameraBrand: null` — 0012 disconnect rule).
   */
  pairedCameraBrand: BridgeBrand | null;
  pairedCameraModel: string | null;
}

/** Capability download at pair time (0012 pairing flow step: "capability download"). */
export interface CameraCapabilities {
  maxStillWidthPx: number;
  maxStillHeightPx: number;
  supportsRaw: boolean;
  supportsFlash: boolean;
  /** Sustained live-view frame rate the body can deliver over WiFi. */
  livePreviewFps: number;
  videoModes: string[];
}

/** Mirror of the Swift `CameraSettings` read surface. */
export interface CameraSettings {
  iso: number | null;
  shutterSpeed: string | null;
  aperture: string | null;
  whiteBalance: string | null;
  batteryPercent: number | null;
}

/** Normalized focus point (0..1 × 0..1) — the web mirror of CGPoint. */
export interface FocusPoint {
  x: number;
  y: number;
}

export type StatusListener = (status: BridgeStatus, previous: BridgeStatus) => void;
export type Unsubscribe = () => void;

/**
 * The shared bridge contract — the TS mirror of the locked Swift protocol.
 * One implementation per brand + `internal` + `mock`. All methods may throw
 * `BridgeError` subclasses; the pairing FSM owns retry/fallback policy, so
 * implementations should fail fast rather than retry internally.
 */
export interface CameraBridge {
  readonly brand: BridgeBrand;
  /** Body model, e.g. "EOS R6 Mark II" — null until capability download. */
  readonly model: string | null;
  /** Null until pair completes (capability download). */
  readonly capabilities: CameraCapabilities | null;
  readonly status: BridgeStatus;

  connect(): Promise<void>;
  disconnect(): Promise<void>;

  /**
   * Live viewfinder stream. Terminates when the bridge disconnects. Consumed
   * by the Panood (publish) and Patiktok (record) sinks and the Live View
   * overlay; Papic uses it only as a framing aid.
   */
  livePreview(): AsyncIterable<VideoFrame>;

  /** Fire a still. Gesture map: Tap = still · Drag-up = still + flash. */
  triggerStill(opts?: { flash?: boolean }): Promise<CapturedFile>;

  /**
   * Fire a fixed-duration clip (Papic file path). `durationMs` must not exceed
   * PAPIC_CLIP_DURATION_MS — implementations MUST reject beyond-cap requests.
   * Gesture map: Drag-right = 5 s clip · chord = 5 s clip with light.
   */
  triggerClip(opts: { durationMs: number; light?: boolean }): Promise<CapturedFile>;

  setFocusPoint(point: FocusPoint): Promise<void>;
  readSettings(): Promise<CameraSettings>;

  /**
   * Status-change subscription. Not part of the Swift surface (Swift observes
   * `status` via the runtime); explicit here so the pairing FSM can react to
   * unexpected drops without polling.
   */
  onStatusChange(listener: StatusListener): Unsubscribe;
}

/** Base class for every bridge failure. */
export class BridgeError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'connect_failed'
      | 'not_connected'
      | 'capture_failed'
      | 'invalid_argument'
      | 'slot_busy',
  ) {
    super(message);
    this.name = 'BridgeError';
  }
}

/** Thrown by the 1-phone:1-DSLR guard (V1 hard limit — multi-DSLR is V2). */
export class BridgeSlotBusyError extends BridgeError {
  constructor(phoneId: string) {
    super(`Phone ${phoneId} already has an active DSLR pairing (V1 is 1 phone : 1 DSLR)`, 'slot_busy');
    this.name = 'BridgeSlotBusyError';
  }
}

/**
 * The three capture surfaces the bridge feeds. Determines disconnect-fallback
 * semantics (build plan § 5b):
 *  - papic:    seamless swap to the phone sensor; gap-captures stamped
 *              `pairedCameraBrand: null`.
 *  - patiktok: a take in progress when the DSLR drops KEEPS RECORDING on the
 *              phone sensor with a seam marker — never lose the take.
 *  - panood:   a live broadcast cannot gap; switch is IMMEDIATE (no 3 s grace)
 *              and the continuity event is surfaced so the publisher can keep
 *              the RTMP stream alive or show a "technical difficulties" card.
 */
export type BridgeSurface = 'papic' | 'patiktok' | 'panood';

/**
 * Injectable clock/scheduler so the pairing FSM is deterministic under test
 * (virtual time) and trivial in production (setTimeout).
 */
export interface BridgeScheduler {
  now(): number;
  schedule(fn: () => void, delayMs: number): Unsubscribe;
}

/** Production scheduler — thin setTimeout wrapper. */
export function realScheduler(): BridgeScheduler {
  return {
    now: () => Date.now(),
    schedule: (fn, delayMs) => {
      const id = setTimeout(fn, delayMs);
      return () => clearTimeout(id);
    },
  };
}
