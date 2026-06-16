'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Check, CircleAlert, ImageIcon } from 'lucide-react';
import { recordSeatCapture } from '@/app/papic/actions';

// Papic · paparazzo capture (client)
//
// The working web-capture slice for a claimed seat. Rear camera (getUserMedia
// facingMode: environment) → freeze the frame to a canvas → JPEG → presign via
// /api/upload (media bucket) → PUT the bytes to R2 → record the papic_photos
// row through the recordSeatCapture server action (RLS lets the claimer insert
// on their own seat). Photos only — 5-second clips are a documented follow-up
// once the media bucket's MIME allow-list includes video. Mobile-first: the
// friend is on a phone, so the stage is full-bleed with a thumb-reachable
// shutter.

type Props = {
  token: string;
  seatIndex: number;
  initialCount: number;
  /** Free-sampler seat → captures land under their own R2 prefix so an R2
   *  object-lifecycle rule can expire ONLY sampler bytes (paid stays forever). */
  isFreeSampler?: boolean;
};

export function PapicSeatCapture({ token, seatIndex, initialCount, isFreeSampler = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        setCamError(true);
      }
    }
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = useCallback(async () => {
    if (busy || !ready) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    setBusy(true);
    setSaveError(null);

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setBusy(false);
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    );
    if (!blob) {
      setBusy(false);
      setSaveError('Could not grab that frame — try again.');
      return;
    }

    try {
      const presignRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket: 'media',
          pathPrefix: isFreeSampler
            ? `papic-sampler/seat-${seatIndex}`
            : `papic/seat-${seatIndex}`,
          filename: `papic-${Date.now()}.jpg`,
          contentType: 'image/jpeg',
          sizeBytes: blob.size,
        }),
      });
      if (!presignRes.ok) throw new Error('presign');
      const { uploadUrl, r2Ref } = (await presignRes.json()) as {
        uploadUrl?: string;
        r2Ref?: string;
      };
      if (!uploadUrl || !r2Ref) throw new Error('presign');

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      });
      if (!putRes.ok) throw new Error('put');

      const result = await recordSeatCapture(token, r2Ref);
      if (!result.ok) throw new Error(result.error);

      setCount(result.count);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 900);
    } catch {
      setSaveError("That shot didn't save — check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, ready, seatIndex, token, isFreeSampler]);

  if (camError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-12 text-ink">
        <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-7 text-center shadow-sm">
          <CircleAlert aria-hidden className="mx-auto h-7 w-7 text-terracotta" strokeWidth={1.75} />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">We need your camera</h1>
          <p className="mt-2 text-sm text-ink/65">
            Allow camera access for Setnayan in your browser, then reload this
            page to start shooting.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center justify-center rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600"
          >
            Reload &amp; try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-ink text-cream">
      <header className="flex items-center justify-between px-4 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cream/70">
          Papic · seat {seatIndex}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 text-xs font-medium text-cream">
          <ImageIcon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {count} {count === 1 ? 'shot' : 'shots'}
        </span>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/80">
            <Loader2 aria-hidden className="h-6 w-6 animate-spin text-cream/70" strokeWidth={2} />
          </div>
        )}
        {justSaved && (
          <div className="absolute inset-0 flex items-center justify-center bg-cream/15">
            <span className="inline-flex items-center gap-2 rounded-full bg-ink/70 px-4 py-2 text-sm font-medium text-cream">
              <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} /> Saved
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 pb-8 pt-4">
        {saveError && (
          <p className="text-center text-xs text-cream/80">{saveError}</p>
        )}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={capture}
            disabled={busy || !ready}
            aria-label="Take a photo"
            className="flex items-center justify-center rounded-full border-4 border-cream/80 bg-cream/10 transition active:scale-95 disabled:opacity-50"
            style={{ height: '4.5rem', width: '4.5rem' }}
          >
            {busy ? (
              <Loader2 aria-hidden className="h-7 w-7 animate-spin text-cream" strokeWidth={2} />
            ) : (
              <Camera aria-hidden className="h-7 w-7 text-cream" strokeWidth={1.75} />
            )}
          </button>
        </div>
        <p className="text-center text-xs text-cream/60">
          Every photo lands in the couple&rsquo;s gallery in real time.
        </p>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
