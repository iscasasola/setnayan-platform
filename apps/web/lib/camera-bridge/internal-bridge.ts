/**
 * apps/web/lib/camera-bridge/internal-bridge.ts
 *
 * InternalCameraBridge — the phone's OWN camera (getUserMedia) implementing
 * the shared `CameraBridge` protocol. Build-plan role: the first-class 5th
 * implementation — it IS the disconnect-fallback target of the pairing FSM,
 * and it lets the full pipeline + UI run with zero DSLR hardware.
 *
 * Browser-only at RUNTIME (navigator.mediaDevices); import-safe anywhere
 * (nothing touches the DOM at module scope). The web seat surface binds the
 * raw MediaStream straight to a <video> for the viewfinder (the idiomatic
 * path — no JPEG round-trip); `livePreview()` exists for protocol parity and
 * canvas-based consumers.
 *
 * The native true-native binary (N1) replaces this with CameraX/AVFoundation;
 * the protocol stays identical — that's the point of the two-sided plug.
 */

import {
  BridgeError,
  PAPIC_CLIP_DURATION_MS,
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

export class InternalCameraBridge implements CameraBridge {
  readonly brand = 'internal' as const;
  model: string | null = null;
  capabilities: CameraCapabilities | null = null;
  status: BridgeStatus = 'disconnected';

  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private listeners = new Set<StatusListener>();
  private frameSequence = 0;

  private setStatus(next: BridgeStatus): void {
    if (next === this.status) return;
    const previous = this.status;
    this.status = next;
    for (const l of [...this.listeners]) l(next, previous);
  }

  /** The raw stream — the viewfinder <video> binds this directly. */
  getMediaStream(): MediaStream | null {
    return this.stream;
  }

  async connect(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new BridgeError('camera not available in this environment', 'connect_failed');
    }
    this.setStatus('pairing');
    try {
      // Rear camera only — the 0012 capture lock (front camera disabled).
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
    } catch {
      this.setStatus('disconnected');
      throw new BridgeError('camera permission denied or unavailable', 'connect_failed');
    }

    // Hidden <video> so still-grabs can drawImage() from a playing source.
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = this.stream;
    await video.play().catch(() => undefined);
    this.video = video;

    const track = this.stream.getVideoTracks()[0];
    const settings = track?.getSettings?.() ?? {};
    this.model = track?.label || 'Phone camera';
    this.capabilities = {
      maxStillWidthPx: settings.width ?? 1920,
      maxStillHeightPx: settings.height ?? 1080,
      supportsRaw: false,
      supportsFlash: false,
      livePreviewFps: settings.frameRate ?? 30,
      videoModes: ['webm'],
    };
    this.setStatus('live');
  }

  async disconnect(): Promise<void> {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video = null;
    this.setStatus('disconnected');
  }

  private grabFrame(quality: number): Promise<Blob | null> {
    const video = this.video;
    if (!video || !video.videoWidth) return Promise.resolve(null);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  }

  async *livePreview(): AsyncIterable<VideoFrame> {
    // ~10 fps canvas pull — protocol parity; the seat UI binds the stream
    // directly instead (cheaper + smoother).
    while (this.status === 'live' || this.status === 'recording') {
      const blob = await this.grabFrame(0.6);
      if (!blob) break;
      this.frameSequence += 1;
      yield {
        jpegBytes: new Uint8Array(await blob.arrayBuffer()),
        widthPx: this.video?.videoWidth ?? 0,
        heightPx: this.video?.videoHeight ?? 0,
        timestampMs: Date.now(),
        sequence: this.frameSequence,
      };
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  async triggerStill(_opts?: { flash?: boolean }): Promise<CapturedFile> {
    if (this.status === 'disconnected' || this.status === 'pairing') {
      throw new BridgeError('bridge is not connected', 'not_connected');
    }
    const blob = await this.grabFrame(0.9);
    if (!blob) throw new BridgeError('could not grab a frame', 'capture_failed');
    return {
      kind: 'still',
      bytes: new Uint8Array(await blob.arrayBuffer()),
      mimeType: 'image/jpeg',
      capturedAtMs: Date.now(),
      pairedCameraBrand: this.brand,
      pairedCameraModel: this.model,
    };
  }

  async triggerClip(opts: { durationMs: number; light?: boolean }): Promise<CapturedFile> {
    if (this.status === 'disconnected' || this.status === 'pairing') {
      throw new BridgeError('bridge is not connected', 'not_connected');
    }
    if (!Number.isFinite(opts.durationMs) || opts.durationMs <= 0) {
      throw new BridgeError('clip duration must be a positive number of ms', 'invalid_argument');
    }
    if (opts.durationMs > PAPIC_CLIP_DURATION_MS) {
      throw new BridgeError(
        `clip duration ${opts.durationMs}ms exceeds the locked ${PAPIC_CLIP_DURATION_MS}ms Papic cap`,
        'invalid_argument',
      );
    }
    if (!this.stream || typeof MediaRecorder === 'undefined') {
      throw new BridgeError('clip recording unavailable', 'capture_failed');
    }

    const recorder = new MediaRecorder(this.stream);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    this.setStatus('recording');
    const done = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
      recorder.onerror = () => reject(new BridgeError('clip recording failed', 'capture_failed'));
    });
    recorder.start();
    await new Promise((r) => setTimeout(r, opts.durationMs));
    recorder.stop();
    const blob = await done;
    if (this.status === 'recording') this.setStatus('live');

    return {
      kind: 'clip',
      bytes: new Uint8Array(await blob.arrayBuffer()),
      mimeType: blob.type || 'video/webm',
      capturedAtMs: Date.now(),
      durationMs: opts.durationMs,
      pairedCameraBrand: this.brand,
      pairedCameraModel: this.model,
    };
  }

  async setFocusPoint(point: FocusPoint): Promise<void> {
    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      throw new BridgeError('focus point must be normalized 0..1', 'invalid_argument');
    }
    // Phone autofocus — tap-to-focus is a native (N1) capability.
  }

  async readSettings(): Promise<CameraSettings> {
    return { iso: null, shutterSpeed: null, aperture: null, whiteBalance: 'auto', batteryPercent: null };
  }

  onStatusChange(listener: StatusListener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
