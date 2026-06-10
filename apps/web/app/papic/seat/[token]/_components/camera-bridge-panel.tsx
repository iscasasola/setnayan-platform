'use client';

/**
 * Camera Bridge panel — U1 of the Camera Bridge build plan (mock-driven M1).
 *
 * Dark-launched on the seat capture page (renders only when the page passes
 * `bridgeEnabled`): "Pair a camera" → brand picker (Demo DSLR now; Canon
 * arrives with the native binary + CCAPI) → pairing progress → live-view
 * canvas → Still / 5s-Clip shutters → delivery through the S0 Papic sink
 * (presign → R2 PUT → recordSeatCapture) with the camera_bridge offline
 * queue as the weak-WiFi fallback → "Simulate WiFi drop" exercises the
 * pairing FSM: instant fallback to the phone camera (gap-captures stamped
 * null), 5s auto-retry, banner + recovery. The whole panel runs on the
 * shipped lib/camera-bridge core — zero DSLR hardware.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CircleAlert, Link2, Loader2, Unplug, Video, Zap } from 'lucide-react';
import { recordSeatCapture } from '@/app/papic/actions';
import { MockBridge } from '@/lib/camera-bridge/mock-bridge';
import { InternalCameraBridge } from '@/lib/camera-bridge/internal-bridge';
import {
  DslrPairingController,
  type PairingState,
} from '@/lib/camera-bridge/pairing-fsm';
import {
  PAPIC_CLIP_DURATION_MS,
  realScheduler,
  type CapturedFile,
} from '@/lib/camera-bridge/types';
import {
  deliverCapture,
  makeBrowserSinkDeps,
  type PapicSinkDeps,
} from '@/lib/camera-bridge/papic-sink';
import { enqueueOfflineItem } from '@/lib/offline/db';

type Props = {
  token: string;
  seatIndex: number;
  eventId: string;
};

type Delivered = { kind: 'still' | 'clip'; at: number; via: 'dslr' | 'phone' | 'queued' };

export function CameraBridgePanel({ token, seatIndex, eventId }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PairingState>('disconnected');
  const [busy, setBusy] = useState(false);
  const [delivered, setDelivered] = useState<Delivered[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [galleryCount, setGalleryCount] = useState<number | null>(null);

  const controllerRef = useRef<DslrPairingController | null>(null);
  const mockRef = useRef<MockBridge | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sinkDepsRef = useRef<PapicSinkDeps | null>(null);

  // Sink deps once: the server action + the camera_bridge offline queue.
  if (!sinkDepsRef.current) {
    sinkDepsRef.current = makeBrowserSinkDeps({
      record: (r2Ref, kind) => recordSeatCapture(token, r2Ref, kind),
      enqueueOffline: async (file: CapturedFile) => {
        try {
          await enqueueOfflineItem('camera_bridge', {
            event_id: eventId,
            payload: {
              seat_token: token,
              seat_index: seatIndex,
              kind: file.kind === 'clip' ? 'clip' : 'photo',
              content_type: file.mimeType,
              captured_at_ms: file.capturedAtMs,
              duration_ms: file.durationMs,
              // Blob rides IndexedDB's structured clone; the O1 handler drains it.
              bytes: new Blob([new Uint8Array(file.bytes)], { type: file.mimeType }),
            },
          });
          return true;
        } catch {
          return false;
        }
      },
    });
  }

  const pair = useCallback(async () => {
    if (controllerRef.current) return;
    setLastError(null);
    const primary = new MockBridge({ brand: 'mock', model: 'Demo DSLR (no hardware)' });
    const fallback = new InternalCameraBridge();
    const controller = new DslrPairingController({
      primary,
      fallback,
      surface: 'papic',
      phoneId: token, // 1 phone : 1 DSLR per seat session (V1 lock)
      scheduler: realScheduler(),
    });
    controller.onTransition((e) => setState(e.to));
    mockRef.current = primary;
    controllerRef.current = controller;
    try {
      await controller.start();
    } catch (err) {
      setLastError((err as Error).message);
      controllerRef.current = null;
      mockRef.current = null;
      return;
    }
    setOpen(true);
  }, [token]);

  const unpair = useCallback(async () => {
    await controllerRef.current?.stop();
    controllerRef.current = null;
    mockRef.current = null;
    setOpen(false);
    setState('disconnected');
  }, []);

  // Live-view: paint mock frames onto the canvas while paired to the demo
  // DSLR; during fallback the phone keeps shooting but the preview shows the
  // reconnect chrome instead (the real seat viewfinder stays available below).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      const controller = controllerRef.current;
      const canvas = canvasRef.current;
      if (!controller || !canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const bridge = controller.activeBridge();
      if (bridge.brand !== 'mock') return;
      let lastPaint = 0;
      for await (const frame of bridge.livePreview()) {
        if (cancelled) break;
        // Demo frames are fixture JPEGs — render stylized chrome at ~12fps.
        const now = performance.now();
        if (now - lastPaint < 80) {
          await new Promise((r) => setTimeout(r, 80 - (now - lastPaint)));
        }
        lastPaint = performance.now();
        const w = canvas.width;
        const h = canvas.height;
        ctx.fillStyle = '#101014';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.strokeRect(w * 0.08, h * 0.1, w * 0.84, h * 0.8);
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = '12px monospace';
        ctx.fillText('DEMO DSLR · LIVE VIEW', w * 0.08 + 8, h * 0.1 + 18);
        ctx.fillText(`frame #${frame.sequence}`, w * 0.08 + 8, h * 0.9 - 10);
        const t = (frame.sequence % 60) / 60;
        ctx.fillStyle = 'rgba(197,160,89,0.85)';
        ctx.beginPath();
        ctx.arc(w * (0.2 + 0.6 * t), h * 0.5, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, state]);

  const fire = useCallback(
    async (kind: 'still' | 'clip') => {
      const controller = controllerRef.current;
      const deps = sinkDepsRef.current;
      if (!controller || !deps || busy) return;
      setBusy(true);
      setLastError(null);
      try {
        const file =
          kind === 'still'
            ? await controller.captureStill()
            : await controller.captureClip({ durationMs: PAPIC_CLIP_DURATION_MS });
        const via: Delivered['via'] = file.pairedCameraBrand ? 'dslr' : 'phone';
        const result = await deliverCapture(deps, file, { seatIndex });
        if (result.ok) {
          setGalleryCount(result.count);
          const entry: Delivered = { kind, at: Date.now(), via };
          setDelivered((d) => [entry, ...d].slice(0, 8));
        } else if (result.queued) {
          const entry: Delivered = { kind, at: Date.now(), via: 'queued' };
          setDelivered((d) => [entry, ...d].slice(0, 8));
        } else {
          setLastError(result.error);
        }
      } catch (err) {
        setLastError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [busy, seatIndex],
  );

  const simulateDrop = useCallback(() => {
    mockRef.current?.blockConnects();
    mockRef.current?.dropConnection();
  }, []);

  const simulateRecover = useCallback(() => {
    mockRef.current?.allowConnects();
  }, []);

  useEffect(() => () => void controllerRef.current?.stop(), []);

  if (!open) {
    return (
      <div className="border-t border-cream/10 bg-ink px-4 py-3">
        <button
          type="button"
          onClick={pair}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-cream/20 px-4 py-2.5 text-sm font-medium text-cream/90 hover:bg-cream/10"
        >
          <Link2 aria-hidden className="h-4 w-4" strokeWidth={2} />
          Pair a camera <span className="text-cream/50">· demo DSLR (no hardware)</span>
        </button>
        {lastError ? <p className="mt-2 text-xs text-terracotta">{lastError}</p> : null}
      </div>
    );
  }

  const onFallback = state === 'fallback' || state === 'pairing';

  return (
    <div className="border-t border-cream/10 bg-ink px-4 py-3 text-cream">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cream/70">
          Camera Bridge · {state}
        </p>
        <button
          type="button"
          onClick={unpair}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-cream/60 hover:bg-cream/10"
        >
          <Unplug aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Unpair
        </button>
      </div>

      {onFallback ? (
        <div
          role="status"
          className="mt-2 flex items-center gap-2 rounded-md border border-terracotta/40 bg-terracotta/15 px-3 py-2 text-xs"
        >
          <CircleAlert aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
          <span>
            Camera disconnected — switched to your phone camera. Reconnecting every 5s…
          </span>
          <button
            type="button"
            onClick={simulateRecover}
            className="ml-auto rounded bg-cream/10 px-2 py-1 text-[11px] hover:bg-cream/20"
          >
            Restore camera
          </button>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          width={640}
          height={200}
          className="mt-2 w-full rounded-md border border-cream/15"
          aria-label="Paired camera live view (demo)"
        />
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => fire('still')}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <Camera aria-hidden className="h-4 w-4" strokeWidth={2} />
          )}
          Still
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => fire('clip')}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-cream/20 px-4 py-2.5 text-sm font-medium text-cream/90 hover:bg-cream/10 disabled:opacity-60"
        >
          <Video aria-hidden className="h-4 w-4" strokeWidth={2} />
          5s clip
        </button>
        <button
          type="button"
          onClick={simulateDrop}
          title="Simulate a WiFi drop (demo)"
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-cream/15 px-3 py-2.5 text-xs text-cream/60 hover:bg-cream/10"
        >
          <Zap aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Drop
        </button>
      </div>

      {delivered.length > 0 ? (
        <p className="mt-2 text-xs text-cream/60">
          {galleryCount !== null ? `${galleryCount} in the gallery · ` : ''}
          last:{' '}
          {delivered
            .slice(0, 3)
            .map((d) => `${d.kind} (${d.via === 'queued' ? 'queued offline' : d.via})`)
            .join(' · ')}
        </p>
      ) : null}
      {lastError ? <p className="mt-2 text-xs text-terracotta">{lastError}</p> : null}
    </div>
  );
}
