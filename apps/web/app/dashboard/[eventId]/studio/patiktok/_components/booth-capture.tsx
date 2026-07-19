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
  Sparkles,
  Square,
  Tag,
  Video,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { matchPatiktokFace, recordPatiktokClip } from '../actions';
import { TagSheet, type BoothGuest, type BoothTable, type BoothTag } from './tag-sheet';

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
  guests,
  tables,
  faceEnabled,
}: {
  eventId: string;
  template: CaptureTemplate;
  guests: BoothGuest[];
  tables: BoothTable[];
  // True when the event has consented face enrollments (Papic on) — unlocks the
  // one-shot face pre-fill of the "Recording for:" tag. Phase B.
  faceEnabled: boolean;
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
  const [tag, setTag] = useState<BoothTag | null>(null);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [captured, setCaptured] = useState<CapturedClip[]>([]);
  // Face pre-fill (Phase B): a 0.50–0.60 "Looks like…?" candidate awaiting
  // confirm, and a busy flag while the on-device match runs.
  const [suggestion, setSuggestion] = useState<{ guestId: string; name: string } | null>(null);
  const [faceBusy, setFaceBusy] = useState(false);
  // One face attempt per guest (reset on next-guest / fresh camera) so we never
  // loop, and never re-detect after the operator has made a choice.
  const faceTriedRef = useRef(false);
  // True while the recording camera was suspended to free it for the tag
  // scanner — so we reopen it when the sheet closes (one camera at a time).
  const resumeCamRef = useRef(false);

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
      // 3) record the clip row (RLS-scoped insert), carrying the tag set
      // before recording (guest / table / free-text) — server validates the
      // guest_id / table_id belong to this event.
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
        performerLabel: tag?.label ?? null,
        guestId: tag?.kind === 'guest' ? tag.guestId : null,
        tableId: tag?.kind === 'table' ? tag.tableId : null,
        tagSource: tag?.source ?? null,
      });
      setCaptured((prev) => [...prev, { clipId, label: tag?.label ?? null }]);
      // reset for the next guest
      revokeRecorded();
      setRecordedUrl(null);
      blobRef.current = null;
      setTag(null);
      setSuggestion(null);
      faceTriedRef.current = false;
      setRetakeCount(0);
      setPhase('ready');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed.');
      setPhase('error');
    }
  }, [eventId, tag, revokeRecorded, template.slug]);

  // Free the recording camera the moment the tag scanner needs one (iOS runs a
  // single camera at a time); reopen it when the sheet closes.
  const handleScanActiveChange = useCallback(
    (active: boolean) => {
      if (active && streamRef.current) {
        stopStream();
        if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
        resumeCamRef.current = true;
      }
    },
    [stopStream],
  );

  const closeTagSheet = useCallback(() => {
    setTagSheetOpen(false);
    if (resumeCamRef.current) {
      resumeCamRef.current = false;
      void openCamera();
    }
  }, [openCamera]);

  // Grab the current live-preview frame as a canvas for on-device face embedding.
  const grabFrame = useCallback((): HTMLCanvasElement | null => {
    const video = liveVideoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }, []);

  // Phase B — one-shot face pre-fill. When the camera is ready, the event has
  // enrollments, and nothing's tagged yet, embed the live frame ON-DEVICE and
  // ask the server for the best match: auto-fill on a strong match (≤0.50),
  // surface a "Looks like…?" confirm on a medium one. Best-effort + silent —
  // a miss just leaves the tag empty (manual / QR still work).
  useEffect(() => {
    if (!faceEnabled || phase !== 'ready' || tag || faceTriedRef.current) return;
    faceTriedRef.current = true;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setFaceBusy(true);
        const canvas = grabFrame();
        if (!canvas) return;
        const { embedFaces } = await import('@/lib/face-embed');
        const { vectors } = await embedFaces(canvas);
        if (cancelled || vectors.length === 0) return;
        const result = await matchPatiktokFace({ eventId, faceVectors: vectors });
        if (cancelled || !result) return;
        if (result.kind === 'auto') {
          // Updater form: only fill if the operator hasn't tagged meanwhile.
          setTag((cur) =>
            cur ?? { kind: 'guest', guestId: result.guestId, label: result.name, source: 'auto_face' },
          );
        } else {
          setSuggestion({ guestId: result.guestId, name: result.name });
        }
      } catch {
        // best-effort — never disrupt the capture loop
      } finally {
        if (!cancelled) setFaceBusy(false);
      }
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [faceEnabled, phase, tag, eventId, grabFrame]);

  const cameraOpen = phase !== 'idle' && phase !== 'error';
  const retakesLeft = MAX_RETAKES - retakeCount;
  const canTag = phase === 'idle' || phase === 'ready' || phase === 'review';

  return (
    <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold tracking-tight">
          <Camera aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Booth capture
        </h2>
        {captured.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-2.5 py-1 text-[11px] font-medium text-success-900">
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

      {/* Recording for — set the tag BEFORE recording (editable at review) */}
      {canTag ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Recording for
          </span>
          {tag ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta/10 px-2.5 py-1 text-sm font-medium text-terracotta-800">
              {tag.kind === 'guest' && tag.source === 'auto_face' ? (
                <Sparkles aria-label="Auto-recognised" className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
              ) : null}
              {tag.label}
              <button
                type="button"
                onClick={() => setTag(null)}
                aria-label="Clear tag"
                className="-mr-0.5 rounded-full p-0.5 text-terracotta-700/70 hover:bg-terracotta/15 hover:text-terracotta-800"
              >
                <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </span>
          ) : faceBusy ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-ink/45">
              <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              Recognising…
            </span>
          ) : (
            <span className="text-sm text-ink/45">anyone (untagged)</span>
          )}
          <button
            type="button"
            onClick={() => setTagSheetOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-2.5 py-1 text-sm font-medium text-ink/70 transition-colors hover:border-terracotta/40 hover:text-terracotta-700"
          >
            <Tag aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            {tag ? 'Change' : 'Tag guest'}
          </button>
        </div>
      ) : null}

      {/* Face suggestion (Phase B · 0.50–0.60 match) — confirm or dismiss */}
      {canTag && !tag && suggestion ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-terracotta/30 bg-terracotta/5 px-3 py-2">
          <Sparkles aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
          <span className="text-sm text-ink/75">
            Looks like <strong className="font-semibold text-ink">{suggestion.name}</strong>?
          </span>
          <button
            type="button"
            onClick={() => {
              setTag({
                kind: 'guest',
                guestId: suggestion.guestId,
                label: suggestion.name,
                source: 'auto_face',
              });
              setSuggestion(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-terracotta px-2.5 py-1 text-sm font-medium text-cream transition-colors hover:bg-terracotta-700"
          >
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Tag
          </button>
          <button
            type="button"
            onClick={() => setSuggestion(null)}
            className="rounded-md px-2.5 py-1 text-sm font-medium text-ink/60 hover:bg-ink/5 hover:text-ink"
          >
            Not them
          </button>
        </div>
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
              className="inline-flex items-center justify-center gap-2 rounded-md bg-success-700 px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-success-800"
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

      {/* Continue-to-render link once at least one clip is captured */}
      {captured.length > 0 && phase !== 'recording' && phase !== 'countdown' ? (
        <Link
          href={`/dashboard/${eventId}/studio/patiktok/${template.slug}`}
          className="inline-flex items-center gap-2 rounded-md border border-terracotta/40 bg-terracotta/5 px-4 py-2 text-sm font-medium text-terracotta-700 hover:bg-terracotta/10"
        >
          <Film aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Continue to render ({captured.length} clip{captured.length === 1 ? '' : 's'} ready)
        </Link>
      ) : null}

      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
        Captured clips upload to your event gallery · the reel renders in your
        browser (no server)
        {faceEnabled ? ' · faces auto-recognised on-device (Papic)' : ''}
      </p>

      {tagSheetOpen ? (
        <TagSheet
          guests={guests}
          tables={tables}
          allowScan={phase !== 'review'}
          onApply={setTag}
          onClose={closeTagSheet}
          onScanActiveChange={handleScanActiveChange}
        />
      ) : null}
    </section>
  );
}
