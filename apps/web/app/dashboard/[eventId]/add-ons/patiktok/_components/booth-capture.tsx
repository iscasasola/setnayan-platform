'use client';

// Iteration 0017 PR2 — Patiktok booth capture (web).
//
// Replaces the disabled "Start Recording" button with the real client-side
// capture flow the booth-page TODO anticipated: getUserMedia → countdown →
// MediaRecorder → review / retake (max 3) → upload direct-to-R2 via the
// presigned PUT from /api/patiktok/upload → record a patiktok_source_clips row.
//
// This is the INPUT half of the pipeline. PR3 (the WebCodecs renderer) stitches
// the clips this captures into the 9:16 reel. Face-lock + multi-performer
// detection stay deferred (phase 5.1) — this lands a working capture loop.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  Film,
  Loader2,
  RotateCcw,
  Square,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { recordPatiktokClip } from '../actions';

type CaptureTemplate = {
  slug: string;
  name: string;
  defaultDurationSec: number;
};

type Phase =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'countdown'
  | 'recording'
  | 'review'
  | 'uploading'
  | 'error';

type CapturedClip = { clipId: string; label: string | null };

const MAX_RETAKES = 3;
const HARD_DURATION_CAP_SEC = 30;

/** Base MIME the presign route + R2 accept, stripped of any `;codecs=…`. */
function normalizeMime(blobType: string): 'video/mp4' | 'video/webm' | 'video/quicktime' {
  if (blobType.startsWith('video/mp4')) return 'video/mp4';
  if (blobType.startsWith('video/quicktime')) return 'video/quicktime';
  return 'video/webm';
}

/** Pick the best MediaRecorder mimeType this browser supports (Safari → mp4). */
function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

export function BoothCapture({
  eventId,
  template,
}: {
  eventId: string;
  template: CaptureTemplate;
}) {
  const targetSec = Math.min(
    Math.max(1, template.defaultDurationSec || 10),
    HARD_DURATION_CAP_SEC,
  );

  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdownN, setCountdownN] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [retakeCount, setRetakeCount] = useState(0);
  const [performerLabel, setPerformerLabel] = useState('');
  const [captured, setCaptured] = useState<CapturedClip[]>([]);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const reviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const metaRef = useRef<{ durationSec: number; width: number; height: number }>({
    durationSec: 0,
    width: 0,
    height: 0,
  });
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    stopTimerRef.current = null;
    tickTimerRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const revokeRecorded = useCallback(() => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
  }, [recordedUrl]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      clearTimers();
      stopStream();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCamera = useCallback(async () => {
    setErrorMsg(null);
    setPhase('requesting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support camera capture.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
        audio: true,
      });
      streamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play().catch(() => {});
      }
      setPhase('ready');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Could not access the camera. Check the booth device permissions.',
      );
      setPhase('error');
    }
  }, []);

  const beginRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = pickRecorderMime();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      setErrorMsg('This browser cannot record video (MediaRecorder failed).');
      setPhase('error');
      return;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      clearTimers();
      const type = recorder.mimeType || mimeType || 'video/webm';
      const blob = new Blob(chunksRef.current, { type });
      blobRef.current = blob;
      const settings = stream.getVideoTracks()[0]?.getSettings() ?? {};
      metaRef.current = {
        durationSec: Math.max(1, Math.round((elapsedRef.current || targetSec) * 100) / 100),
        width: settings.width ?? 0,
        height: settings.height ?? 0,
      };
      revokeRecorded();
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
      setPhase('review');
    };

    recorderRef.current = recorder;
    elapsedRef.current = 0;
    setElapsed(0);
    recorder.start();
    setPhase('recording');

    const startedAt = Date.now();
    tickTimerRef.current = setInterval(() => {
      const secs = (Date.now() - startedAt) / 1000;
      elapsedRef.current = secs;
      setElapsed(secs);
    }, 100);
    stopTimerRef.current = setTimeout(() => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    }, targetSec * 1000);
  }, [clearTimers, revokeRecorded, targetSec]);

  const startCountdown = useCallback(() => {
    setErrorMsg(null);
    setPhase('countdown');
    let n = 3;
    setCountdownN(n);
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        beginRecording();
      } else {
        setCountdownN(n);
      }
    }, 1000);
  }, [beginRecording]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, []);

  const retake = useCallback(() => {
    revokeRecorded();
    setRecordedUrl(null);
    blobRef.current = null;
    setRetakeCount((c) => c + 1);
    setPhase('ready');
  }, [revokeRecorded]);

  const acceptClip = useCallback(async () => {
    const blob = blobRef.current;
    if (!blob) return;
    setErrorMsg(null);
    setPhase('uploading');
    try {
      const contentType = normalizeMime(blob.type);
      // 1) presign
      const presignRes = await fetch('/api/patiktok/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventId,
          kind: 'clip',
          contentType,
          sizeBytes: blob.size,
        }),
      });
      if (!presignRes.ok) {
        const body = (await presignRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `upload presign failed (${presignRes.status})`);
      }
      const { uploadUrl, bucket, key } = (await presignRes.json()) as {
        uploadUrl: string;
        bucket: string;
        key: string;
      };
      // 2) PUT direct to R2 (Content-Type must match what was signed)
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': contentType },
        body: blob,
      });
      if (!putRes.ok) {
        throw new Error(`clip upload to storage failed (${putRes.status})`);
      }
      // 3) record the clip row (RLS-scoped insert)
      const { clipId } = await recordPatiktokClip({
        eventId,
        templateSlug: template.slug,
        r2Bucket: bucket,
        r2Key: key,
        mimeType: contentType,
        durationSec: metaRef.current.durationSec,
        width: metaRef.current.width || null,
        height: metaRef.current.height || null,
        sizeBytes: blob.size,
        performerLabel: performerLabel,
      });
      setCaptured((prev) => [
        ...prev,
        { clipId, label: performerLabel.trim() || null },
      ]);
      // reset for the next guest
      revokeRecorded();
      setRecordedUrl(null);
      blobRef.current = null;
      setPerformerLabel('');
      setRetakeCount(0);
      setPhase('ready');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed.');
      setPhase('error');
    }
  }, [eventId, performerLabel, revokeRecorded, template.slug]);

  const cameraOpen = phase !== 'idle' && phase !== 'error';
  const retakesLeft = MAX_RETAKES - retakeCount;

  return (
    <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold tracking-tight">
          <Camera aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Booth capture
        </h2>
        {captured.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-900">
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {captured.length} clip{captured.length === 1 ? '' : 's'} this session
          </span>
        ) : null}
      </div>

      <p className="text-sm text-ink/65">
        Records with the <strong>{template.name}</strong> template · target{' '}
        {targetSec}s · guest steps in → countdown → record → review → keep or
        retake (max {MAX_RETAKES}).
      </p>

      {/* Stage */}
      {cameraOpen ? (
        <div className="relative mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-xl bg-ink">
          {/* Live preview — hidden during review so the recorded clip shows */}
          <video
            ref={liveVideoRef}
            className={`h-full w-full object-cover ${phase === 'review' ? 'hidden' : ''}`}
            muted
            playsInline
            autoPlay
          />
          {phase === 'review' && recordedUrl ? (
            <video
              ref={reviewVideoRef}
              className="h-full w-full object-cover"
              src={recordedUrl}
              controls
              playsInline
            />
          ) : null}

          {/* Countdown overlay */}
          {phase === 'countdown' ? (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/40">
              <span className="text-7xl font-bold text-cream tabular-nums drop-shadow">
                {countdownN}
              </span>
            </div>
          ) : null}

          {/* Recording badge + elapsed */}
          {phase === 'recording' ? (
            <div className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-[11px] font-medium text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              REC {elapsed.toFixed(1)}s / {targetSec}s
            </div>
          ) : null}

          {phase === 'uploading' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/50 text-cream">
              <Loader2 aria-hidden className="h-6 w-6 animate-spin" strokeWidth={2} />
              <span className="text-xs">Uploading…</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Error */}
      {phase === 'error' && errorMsg ? (
        <p
          role="alert"
          className="inline-flex items-start gap-2 rounded-xl border border-red-300/70 bg-red-50 px-3 py-2 text-sm text-red-900"
        >
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          {errorMsg}
        </p>
      ) : null}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {phase === 'idle' ? (
          <button
            type="button"
            onClick={openCamera}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-terracotta px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-terracotta-700"
          >
            <Camera aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Open camera
          </button>
        ) : null}

        {phase === 'requesting' ? (
          <span className="inline-flex items-center gap-2 text-sm text-ink/60">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
            Requesting camera…
          </span>
        ) : null}

        {phase === 'ready' ? (
          <button
            type="button"
            onClick={startCountdown}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-terracotta px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-terracotta-700"
          >
            <Video aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {captured.length > 0 ? 'Record next guest' : 'Start recording'}
          </button>
        ) : null}

        {phase === 'recording' ? (
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-ink/85"
          >
            <Square aria-hidden className="h-4 w-4 fill-current" strokeWidth={1.75} />
            Stop
          </button>
        ) : null}

        {phase === 'review' ? (
          <>
            <button
              type="button"
              onClick={acceptClip}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-emerald-800"
            >
              <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
              Keep this clip
            </button>
            <button
              type="button"
              onClick={retake}
              disabled={retakesLeft <= 0}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2.5 text-sm font-medium text-ink/70 transition-colors hover:border-terracotta/40 hover:text-terracotta-700 disabled:opacity-50"
            >
              <RotateCcw aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Retake{retakesLeft < MAX_RETAKES ? ` (${retakesLeft} left)` : ''}
            </button>
          </>
        ) : null}

        {phase === 'error' ? (
          <button
            type="button"
            onClick={openCamera}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-terracotta px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-terracotta-700"
          >
            <Camera aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Retry camera
          </button>
        ) : null}
      </div>

      {/* Performer label (shown while reviewing — optional) */}
      {phase === 'review' ? (
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Guest name (optional)
          </span>
          <input
            type="text"
            value={performerLabel}
            onChange={(e) => setPerformerLabel(e.target.value)}
            placeholder="e.g. Tita Baby's table"
            maxLength={80}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-terracotta/50"
          />
        </label>
      ) : null}

      {/* Continue-to-render link once at least one clip is captured */}
      {captured.length > 0 && phase !== 'recording' && phase !== 'countdown' ? (
        <Link
          href={`/dashboard/${eventId}/add-ons/patiktok/${template.slug}`}
          className="inline-flex items-center gap-2 rounded-md border border-terracotta/40 bg-terracotta/5 px-4 py-2 text-sm font-medium text-terracotta-700 hover:bg-terracotta/10"
        >
          <Film aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Continue to render ({captured.length} clip{captured.length === 1 ? '' : 's'} ready)
        </Link>
      ) : null}

      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
        Captured clips upload to your event gallery · the reel renders in your
        browser (no server) · face-lock + multi-performer · TODO(0017-phase5.1)
      </p>
    </section>
  );
}
