/**
 * apps/web/lib/camera-bridge/mock-bridge.ts
 *
 * MockBridge — the CI/dev implementation of the `CameraBridge` protocol
 * (build plan C1). Emits canned 720p-shaped frames + fixture JPEG bytes so the
 * ENTIRE now-track (pairing FSM, surface adapters, Live View overlay, transit
 * handler) builds and tests with zero DSLR hardware and zero vendor approvals.
 *
 * Deterministic by design: no real timers (frame pacing is pull-driven),
 * injectable failure modes (connect failure, mid-session drop, capture
 * failure) so the FSM's retry/fallback paths are exercisable in unit tests.
 */

import {
  BridgeError,
  PAPIC_CLIP_DURATION_MS,
  type BridgeBrand,
  type BridgeStatus,
  type CameraBridge,
  type CameraCapabilities,
  type CameraSettings,
  type CapturedFile,
  type FocusPoint,
  type StatusListener,
  type Unsubscribe,
  type VideoFrame,
} from './types';

/**
 * Smallest valid JPEG (1×1 px) — enough for any consumer that sniffs magic
 * bytes or hands the buffer to an <img>/sharp. Fixture stills/clips/frames all
 * reuse it; real adapters replace it with vendor SDK output.
 */
const FIXTURE_JPEG = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
  0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
  0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
  0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
  0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
  0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
  0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
  0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
  0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
  0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
  0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
  0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
  0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
  0x00, 0x00, 0x3f, 0x00, 0xfb, 0xfe, 0x8a, 0xff, 0xd9,
]);

export interface MockBridgeOptions {
  brand?: BridgeBrand;
  model?: string;
  /** now() source so capture timestamps are test-controllable. */
  now?: () => number;
  /** Make the next N connect() calls reject (FSM retry tests). */
  failConnects?: number;
  /** Make every capture call reject (capture-error tests). */
  failCaptures?: boolean;
  livePreviewFps?: number;
}

export class MockBridge implements CameraBridge {
  readonly brand: BridgeBrand;
  model: string | null = null;
  capabilities: CameraCapabilities | null = null;
  status: BridgeStatus = 'disconnected';

  private readonly mockModel: string;
  private readonly now: () => number;
  private readonly fps: number;
  private failConnectsRemaining: number;
  private failCaptures: boolean;
  private listeners = new Set<StatusListener>();
  private frameSequence = 0;

  /** Test introspection counters. */
  connectAttempts = 0;
  stillCount = 0;
  clipCount = 0;

  constructor(opts: MockBridgeOptions = {}) {
    this.brand = opts.brand ?? 'mock';
    this.mockModel = opts.model ?? 'Mock EOS (CI)';
    this.now = opts.now ?? (() => Date.now());
    this.fps = opts.livePreviewFps ?? 24;
    this.failConnectsRemaining = opts.failConnects ?? 0;
    this.failCaptures = opts.failCaptures ?? false;
  }

  private setStatus(next: BridgeStatus): void {
    if (next === this.status) return;
    const previous = this.status;
    this.status = next;
    for (const l of [...this.listeners]) l(next, previous);
  }

  async connect(): Promise<void> {
    this.connectAttempts += 1;
    this.setStatus('pairing');
    if (this.failConnectsRemaining > 0) {
      this.failConnectsRemaining -= 1;
      this.setStatus('disconnected');
      throw new BridgeError('mock connect failure (injected)', 'connect_failed');
    }
    // Pair complete → capability download (0012 pairing flow).
    this.model = this.mockModel;
    this.capabilities = {
      maxStillWidthPx: 6000,
      maxStillHeightPx: 4000,
      supportsRaw: true,
      supportsFlash: true,
      livePreviewFps: this.fps,
      videoModes: ['1080p30', '4k24'],
    };
    this.setStatus('live');
  }

  async disconnect(): Promise<void> {
    this.setStatus('disconnected');
  }

  /** Simulate an unexpected WiFi drop (NOT a clean disconnect). */
  dropConnection(): void {
    this.setStatus('disconnected');
  }

  /** Let a previously failing mock accept the next connect (retry tests). */
  allowConnects(): void {
    this.failConnectsRemaining = 0;
  }

  /** Make every future connect() fail (drop-without-recovery tests). */
  blockConnects(): void {
    this.failConnectsRemaining = Number.MAX_SAFE_INTEGER;
  }

  /** Make exactly the next N connect() calls fail (retry-cadence tests). */
  failConnectsNext(n: number): void {
    this.failConnectsRemaining = n;
  }

  private assertConnected(): void {
    if (this.status === 'disconnected' || this.status === 'pairing') {
      throw new BridgeError('bridge is not connected', 'not_connected');
    }
  }

  async *livePreview(): AsyncIterable<VideoFrame> {
    // Pull-driven: yields as fast as the consumer iterates while connected.
    // No real timers — determinism over realism (real adapters pace by SDK).
    while (this.status === 'live' || this.status === 'recording') {
      this.frameSequence += 1;
      yield {
        jpegBytes: FIXTURE_JPEG,
        widthPx: 1280,
        heightPx: 720,
        timestampMs: this.now(),
        sequence: this.frameSequence,
      };
      // Cooperative yield so a drop mid-iteration is observable.
      await Promise.resolve();
    }
  }

  async triggerStill(opts?: { flash?: boolean }): Promise<CapturedFile> {
    this.assertConnected();
    if (this.failCaptures) throw new BridgeError('mock capture failure (injected)', 'capture_failed');
    void opts;
    this.stillCount += 1;
    return {
      kind: 'still',
      bytes: FIXTURE_JPEG,
      mimeType: 'image/jpeg',
      capturedAtMs: this.now(),
      pairedCameraBrand: this.brand,
      pairedCameraModel: this.model,
    };
  }

  async triggerClip(opts: { durationMs: number; light?: boolean }): Promise<CapturedFile> {
    this.assertConnected();
    if (!Number.isFinite(opts.durationMs) || opts.durationMs <= 0) {
      throw new BridgeError('clip duration must be a positive number of ms', 'invalid_argument');
    }
    if (opts.durationMs > PAPIC_CLIP_DURATION_MS) {
      throw new BridgeError(
        `clip duration ${opts.durationMs}ms exceeds the locked ${PAPIC_CLIP_DURATION_MS}ms Papic cap`,
        'invalid_argument',
      );
    }
    if (this.failCaptures) throw new BridgeError('mock capture failure (injected)', 'capture_failed');
    this.clipCount += 1;
    const previous = this.status;
    this.setStatus('recording');
    const file: CapturedFile = {
      kind: 'clip',
      bytes: FIXTURE_JPEG, // stand-in payload; real adapters return MP4 bytes
      mimeType: 'video/mp4',
      capturedAtMs: this.now(),
      durationMs: opts.durationMs,
      pairedCameraBrand: this.brand,
      pairedCameraModel: this.model,
    };
    // Clip "completes" immediately in mock-land; restore prior live state if
    // the bridge wasn't dropped mid-clip.
    if (this.status === 'recording') this.setStatus(previous === 'recording' ? 'live' : previous);
    return file;
  }

  async setFocusPoint(point: FocusPoint): Promise<void> {
    this.assertConnected();
    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      throw new BridgeError('focus point must be normalized 0..1', 'invalid_argument');
    }
  }

  async readSettings(): Promise<CameraSettings> {
    this.assertConnected();
    return {
      iso: 400,
      shutterSpeed: '1/200',
      aperture: 'f/2.8',
      whiteBalance: 'auto',
      batteryPercent: 82,
    };
  }

  onStatusChange(listener: StatusListener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
