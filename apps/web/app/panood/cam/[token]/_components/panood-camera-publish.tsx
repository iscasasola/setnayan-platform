'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Video, VideoOff, CircleAlert, Wifi } from 'lucide-react';
import {
  publishPanoodCamera,
  type CameraPublisher,
  type PeerConnectionState,
} from '@/lib/panood-webrtc';

// Panood · camera-operator local preview (PR5 — join + local preview only).
//
// The operator has CLAIMED the camera (POST → panood_claim_camera RPC). This
// view opens the REAR camera with getUserMedia (facingMode: environment, same
// posture as the Papic seat-capture surface) and shows a LOCAL self-preview so
// the operator can frame the shot — plus an honest status line.
//
// ⚠ NO fake streaming. The actual WebRTC publish to the multicam controller
// arrives with the media core (the engine) in a later PR; this view is the join
// + local preview ONLY, and says so plainly. We deliberately do not claim the
// feed is reaching the controller — the status reads "the operator will bring
// you live", which is the truthful day-of reality (the couple's controller goes
// live per-camera).

type Props = {
  cameraIndex: number;
  label: string | null;
  eventId: string;
  streamingEnabled: boolean;
};

export function PanoodCameraPublish({ cameraIndex, label, eventId, streamingEnabled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const publisherRef = useRef<CameraPublisher | null>(null);
  const [state, setState] = useState<'starting' | 'live' | 'denied' | 'error'>(
    'starting',
  );
  const [link, setLink] = useState<PeerConnectionState | null>(null);

  const stop = useCallback(() => {
    publisherRef.current?.close();
    publisherRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setState('starting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('error');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        // Rear camera (corpus: Papic/Panood capture is rear-only). `ideal` so a
        // single-camera device still gets a stream instead of an OverconstrainedError.
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setState('live');
      // Real streaming (owner-gated): publish this camera to the couple's control
      // room over WebRTC — P2P, STUN-only, nothing stored. When the flag is OFF
      // this is skipped and the view stays local-preview-only (the honest default).
      if (streamingEnabled) {
        publisherRef.current?.close();
        publisherRef.current = publishPanoodCamera({
          eventId,
          slot: `cam${cameraIndex}`,
          stream,
          onState: setLink,
        });
      }
    } catch (err) {
      const name = (err as { name?: string } | null)?.name;
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error');
    }
  }, [streamingEnabled, eventId, cameraIndex]);

  useEffect(() => {
    void start();
    return () => stop();
  }, [start, stop]);

  const camLabel = label?.trim() || `Camera ${cameraIndex}`;

  return (
    <main className="flex min-h-screen flex-col bg-ink text-cream">
      {/* Honest header — who you are, what's happening. */}
      <header className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cream/55">
            Panood · live camera
          </p>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight">{camLabel}</h1>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            state === 'live'
              ? 'bg-emerald-500/15 text-emerald-300'
              : 'bg-cream/10 text-cream/60'
          }`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${
              state === 'live' ? 'animate-pulse bg-emerald-400' : 'bg-cream/40'
            }`}
          />
          {state === 'live' ? 'Connected' : state === 'starting' ? 'Starting…' : 'No camera'}
        </span>
      </header>

      {/* Local preview surface. */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 h-full w-full object-cover"
        />

        {state === 'starting' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-cream/70">
            <Video aria-hidden className="h-8 w-8 animate-pulse" strokeWidth={1.5} />
            <p className="text-sm">Opening your camera…</p>
          </div>
        ) : null}

        {state === 'denied' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <VideoOff aria-hidden className="h-8 w-8 text-terracotta" strokeWidth={1.5} />
            <p className="text-sm font-medium">Camera access is blocked</p>
            <p className="max-w-xs text-xs text-cream/60">
              Allow camera access in your browser settings, then tap retry.
            </p>
            <button
              type="button"
              onClick={() => void start()}
              className="mt-1 inline-flex items-center gap-2 rounded-md bg-cream px-4 py-2 text-sm font-medium text-ink"
            >
              <Video aria-hidden className="h-4 w-4" strokeWidth={2} />
              Retry camera
            </button>
          </div>
        ) : null}

        {state === 'error' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <CircleAlert aria-hidden className="h-8 w-8 text-terracotta" strokeWidth={1.5} />
            <p className="text-sm font-medium">Couldn&rsquo;t open the camera</p>
            <p className="max-w-xs text-xs text-cream/60">
              This device may not have a usable camera, or another app is using it.
            </p>
            <button
              type="button"
              onClick={() => void start()}
              className="mt-1 inline-flex items-center gap-2 rounded-md bg-cream px-4 py-2 text-sm font-medium text-ink"
            >
              <Video aria-hidden className="h-4 w-4" strokeWidth={2} />
              Try again
            </button>
          </div>
        ) : null}
      </div>

      {/* The truthful status — join + local preview only; the controller brings
          this feed live. NO claim that bytes are streaming yet. */}
      <footer className="px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
        <div className="flex items-start gap-2.5 rounded-xl border border-cream/10 bg-cream/[0.04] px-3.5 py-3">
          <Wifi aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-cream/55" strokeWidth={1.75} />
          <p className="text-xs leading-relaxed text-cream/70">
            You&rsquo;re <span className="font-medium text-cream">{camLabel}</span> ·{' '}
            {streamingEnabled
              ? link === 'connected'
                ? "live to the controller — the operator picks when you're on screen."
                : link === 'failed'
                  ? "couldn't reach the controller on this network — try the same Wi-Fi as the operator."
                  : 'connecting to the controller…'
              : 'connected · the operator will bring you live from the controller.'}{' '}
            Keep this screen open and your camera pointed where you want.
          </p>
        </div>
      </footer>
    </main>
  );
}
