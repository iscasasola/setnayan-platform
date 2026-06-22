'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Video,
  Loader2,
  Check,
  CircleAlert,
  Square,
  RotateCcw,
} from 'lucide-react';

// Pabati · guest video-greeting recorder (client)
//
// Mirrors the Papic guest-capture surface (app/papic/guest/_components/
// papic-guest-capture.tsx) but swaps photo → VIDEO: getUserMedia({video,audio})
// → MediaRecorder → a HARD client-side stop at 5000ms (the corpus 5-second cap,
// mirrored server-side in the route + RPC). On stop it produces the clip Blob
// AND a poster frame (the first frame drawn to a <canvas> → JPEG) — the poster
// is the NSFW-screen proxy the route expects (nsfwjs is image-only; the clip
// itself is never classified). It then POSTs FormData to /api/pabati/clip with
// { file, poster, duration_ms }, which validates the guest-session cookie,
// re-clamps the duration, PUTs to R2, and records through the quota-enforcing
// pabati_record_clip RPC. The client never owns the cap — it reflects the
// `remaining` the server returns.
//
// 300-clip per-EVENT cap (not per-guest): the response's quota fields drive the
// "N greetings left" display; an exhausted/not-owned response shows a friendly
// state.

const MAX_CLIP_MS = 5000; // 5-SECOND HARD CAP — corpus lock, mirrored server-side.

type Props = {
  guestName: string;
  eventName: string;
  initialRemaining: number;
  total: number;
};

export function PabatiPrompt({
  guestName,
  eventName,
  initialRemaining,
  total,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const posterBlobRef = useRef<Blob | null>(null);

  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'uploading' | 'saved'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [saveError, setSaveError] = useState<string | null>(null);

  const exhausted = remaining <= 0;
  const isRecording = phase === 'recording';
  const isUploading = phase === 'uploading';

  // ── Camera + mic stream ──────────────────────────────────────────────────
  useEffect(() => {
    if (exhausted) return;
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'user' } },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true; // never echo the guest's own mic
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
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [exhausted]);

  // Draw the current frame to a hidden canvas → JPEG poster (the NSFW proxy).
  const grabPoster = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    );
  }, []);

  const upload = useCallback(
    async (clip: Blob, durationMs: number) => {
      setPhase('uploading');
      setSaveError(null);
      try {
        const form = new FormData();
        form.append('file', clip, `pabati-${Date.now()}.mp4`);
        if (posterBlobRef.current) {
          form.append('poster', posterBlobRef.current, `pabati-${Date.now()}.jpg`);
        }
        form.append('duration_ms', String(Math.min(durationMs, MAX_CLIP_MS)));

        const res = await fetch('/api/pabati/clip', { method: 'POST', body: form });
        const json = (await res.json().catch(() => ({}))) as {
          status?: string;
          remaining?: number;
          error?: string;
        };

        if (res.status === 409 || json.status === 'quota_exhausted') {
          setRemaining(0);
          setPhase('idle');
          return;
        }
        if (json.status === 'not_owned') {
          setRemaining(0);
          setSaveError(null);
          setPhase('idle');
          return;
        }
        if (!res.ok || json.status !== 'ok') {
          throw new Error(json.error ?? 'record');
        }

        setRemaining(
          typeof json.remaining === 'number' ? json.remaining : (r) => Math.max(0, r - 1),
        );
        setPhase('saved');
        setTimeout(() => setPhase((p) => (p === 'saved' ? 'idle' : p)), 1800);
      } catch {
        setSaveError("That greeting didn't send — check your signal and try again.");
        setPhase('idle');
      }
    },
    [],
  );

  const stopRecording = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!ready || exhausted || isRecording || isUploading) return;
    const stream = streamRef.current;
    if (!stream) return;

    // Grab the poster frame up front (the first frame) for the NSFW screen.
    posterBlobRef.current = await grabPoster();

    chunksRef.current = [];
    // Prefer mp4; fall back to whatever the browser supports (Chrome → webm).
    // The server stores the bytes as-is; the poster is the moderation proxy.
    let mimeType = '';
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
      if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4';
      else if (MediaRecorder.isTypeSupported('video/webm')) mimeType = 'video/webm';
    }
    let rec: MediaRecorder;
    try {
      rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      setSaveError('Recording isn’t supported on this browser — try another phone.');
      return;
    }
    recorderRef.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const durationMs = Math.min(Date.now() - startedAtRef.current, MAX_CLIP_MS);
      const type = rec.mimeType || mimeType || 'video/mp4';
      const clip = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      if (clip.size === 0) {
        setSaveError('That recording came back empty — try again.');
        setPhase('idle');
        return;
      }
      void upload(clip, durationMs);
    };

    startedAtRef.current = Date.now();
    setElapsed(0);
    setSaveError(null);
    setPhase('recording');
    try {
      rec.start();
    } catch {
      setSaveError('Couldn’t start recording — try again.');
      setPhase('idle');
      return;
    }

    // HARD 5-second stop — the corpus cap, enforced client-side (the route + RPC
    // clamp too as defense in depth).
    stopTimerRef.current = setTimeout(stopRecording, MAX_CLIP_MS);
    tickRef.current = setInterval(() => {
      setElapsed(Math.min(MAX_CLIP_MS, Date.now() - startedAtRef.current));
    }, 100);
  }, [ready, exhausted, isRecording, isUploading, grabPoster, upload, stopRecording]);

  // ── Empty / error states ───────────────────────────────────────────────────
  if (exhausted) {
    return (
      <section
        aria-label="Video guestbook"
        className="rounded-2xl border border-ink/10 bg-cream p-5 text-center shadow-sm sm:p-6"
      >
        <Video aria-hidden className="mx-auto h-6 w-6 text-mulberry" strokeWidth={1.75} />
        <h3 className="mt-2 text-base font-semibold tracking-tight text-ink">
          That&rsquo;s a wrap on greetings!
        </h3>
        <p className="mt-1 text-sm text-ink/65">
          All {total} video greetings for {eventName} are in. The couple will
          treasure every one.
        </p>
      </section>
    );
  }

  if (camError) {
    return (
      <section
        aria-label="Video guestbook"
        className="rounded-2xl border border-ink/10 bg-cream p-5 text-center shadow-sm sm:p-6"
      >
        <CircleAlert aria-hidden className="mx-auto h-6 w-6 text-terracotta" strokeWidth={1.75} />
        <h3 className="mt-2 text-base font-semibold tracking-tight text-ink">
          We need your camera &amp; mic
        </h3>
        <p className="mt-1 text-sm text-ink/65">
          Allow camera and microphone access for Setnayan in your browser, then
          reload this page to record your greeting.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600"
        >
          Reload &amp; try again
        </button>
      </section>
    );
  }

  const pct = Math.round((elapsed / MAX_CLIP_MS) * 100);

  return (
    <section
      aria-label="Video guestbook"
      className="overflow-hidden rounded-2xl border border-mulberry/20 bg-ink text-cream shadow-sm"
    >
      <header className="flex items-center justify-between px-4 py-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-cream/90">
          <Video aria-hidden className="h-4 w-4 text-cream" strokeWidth={2} />
          Leave the couple a video greeting
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 text-xs font-medium text-cream">
          {remaining} left
        </span>
      </header>

      <div className="relative aspect-[3/4] w-full overflow-hidden bg-ink sm:aspect-video">
        {/* Mirror the preview so the guest sees themselves naturally (selfie). */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full -scale-x-100 object-cover"
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/80">
            <Loader2 aria-hidden className="h-6 w-6 animate-spin text-cream/70" strokeWidth={2} />
          </div>
        )}
        {isRecording && (
          <>
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-terracotta/90 px-2.5 py-1 text-xs font-semibold text-cream">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cream" />
              REC
            </span>
            {/* 5-second countdown ring as a bottom progress bar. */}
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-cream/20">
              <div
                className="h-full bg-terracotta transition-[width] duration-100 ease-linear"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        )}
        {phase === 'saved' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/85 px-6 text-center">
            <Check aria-hidden className="h-8 w-8 text-cream" strokeWidth={2} />
            <p className="text-base font-semibold text-cream">Sent — salamat, {guestName}!</p>
            <p className="text-sm text-cream/70">Your greeting is on its way to the couple.</p>
          </div>
        )}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/75">
            <span className="inline-flex items-center gap-2 rounded-full bg-ink/70 px-4 py-2 text-sm font-medium text-cream">
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} /> Sending…
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 pb-5 pt-4">
        {saveError && <p className="text-center text-sm text-cream/85">{saveError}</p>}
        <div className="flex items-center justify-center">
          {isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              aria-label="Stop recording"
              className="flex items-center justify-center rounded-full border-4 border-cream/80 bg-terracotta/30 transition active:scale-95"
              style={{ height: '4.5rem', width: '4.5rem' }}
            >
              <Square aria-hidden className="h-6 w-6 text-cream" strokeWidth={2.5} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startRecording()}
              disabled={!ready || isUploading}
              aria-label="Record a 5-second greeting"
              className="flex items-center justify-center rounded-full border-4 border-cream/80 bg-cream/10 transition active:scale-95 disabled:opacity-40"
              style={{ height: '4.5rem', width: '4.5rem' }}
            >
              {isUploading ? (
                <Loader2 aria-hidden className="h-7 w-7 animate-spin text-cream" strokeWidth={2} />
              ) : phase === 'saved' ? (
                <RotateCcw aria-hidden className="h-7 w-7 text-cream" strokeWidth={1.75} />
              ) : (
                <Video aria-hidden className="h-7 w-7 text-cream" strokeWidth={1.75} />
              )}
            </button>
          )}
        </div>
        <p className="text-center text-sm text-cream/65">
          {isRecording
            ? `Recording… ${Math.ceil((MAX_CLIP_MS - elapsed) / 1000)}s left`
            : phase === 'saved'
              ? 'Record another? Tap to start again.'
              : 'Tap to record up to 5 seconds. Smile!'}
        </p>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </section>
  );
}
