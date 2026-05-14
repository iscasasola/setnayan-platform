'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  Mic,
  RotateCcw,
  Sparkles,
  Square,
} from 'lucide-react';
import { transcribeAudio } from '../actions';

/**
 * Voice input for the AI Catalog Generator.
 *
 * Flow:
 *   1. Vendor clicks the mic button → browser prompts for microphone
 *      permission via `getUserMedia`.
 *   2. We start a `MediaRecorder` capturing webm/opus (or whatever
 *      `pickSupportedMimeType` returns — Safari falls back to mp4-aac).
 *   3. On stop (vendor click OR 60s hard cap), we collect chunks into a
 *      Blob and POST it to `/api/upload` for a presigned R2 PUT.
 *   4. The R2 PUT runs; on success we hand the resulting `r2://` ref to
 *      the `transcribeAudio` server action, which forwards the audio to
 *      Whisper and returns the transcript.
 *   5. The transcript appears in an editable textarea. Vendor confirms /
 *      edits, then clicks "Generate catalog from voice" — that fires the
 *      parent's `onSubmit` handler with the final text.
 *
 * Browser support:
 *   • Chromium / Firefox: webm + opus. Reliable.
 *   • Safari 14+: emits mp4-aac. Works once we whitelist the MIME on the
 *     server (see /api/upload).
 *   • Old browsers: we detect `MediaRecorder` upfront and show a graceful
 *     "Voice input requires Chrome, Safari, or Edge" message.
 */

type Props = {
  vendorProfileId: string;
  /** Disabled while the parent is publishing or generating. */
  disabled?: boolean;
  /**
   * Called when the vendor clicks "Generate catalog from voice". Receives
   * the (possibly edited) transcript string. Parent owns the Claude call.
   */
  onSubmit: (transcript: string) => void;
};

type RecorderState =
  | { kind: 'idle' }
  | { kind: 'recording'; startedAt: number; elapsedMs: number }
  | { kind: 'uploading'; progress: number }
  | { kind: 'transcribing' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

const MAX_RECORDING_MS = 60_000;
const TICK_INTERVAL_MS = 100;

/**
 * Best-supported MIME type for our R2 upload + Whisper pipeline. Browsers
 * differ wildly — Chrome wants opus-in-webm, Safari only knows mp4-aac.
 * We pick the first one the runtime says it supports.
 */
function pickSupportedMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/mpeg',
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}

/**
 * Strip codec params + map MIME to a file extension the upload route and
 * Whisper both understand. E.g. `audio/webm;codecs=opus` → `webm`.
 */
function extensionFor(mime: string): string {
  const base = mime.split(';')[0]?.trim() ?? mime;
  if (base === 'audio/webm') return 'webm';
  if (base === 'audio/ogg') return 'ogg';
  if (base === 'audio/mp4') return 'm4a';
  if (base === 'audio/mpeg') return 'mp3';
  return 'webm';
}

/**
 * Detects browsers that won't be able to record audio. Runs once on mount
 * and locks the UI into a "use a different browser" panel rather than
 * letting the vendor click a mic button that will silently no-op.
 */
function unsupportedReason(): string | null {
  if (typeof window === 'undefined') return null; // SSR — defer to client.
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    return 'Voice input requires Chrome, Safari, or Edge.';
  }
  if (typeof MediaRecorder === 'undefined') {
    return 'Voice input requires Chrome, Safari, or Edge.';
  }
  if (pickSupportedMimeType() === null) {
    return 'This browser does not support audio recording in a compatible format.';
  }
  return null;
}

export function VoiceInput({ vendorProfileId, disabled, onSubmit }: Props) {
  const [state, setState] = useState<RecorderState>({ kind: 'idle' });
  const [transcript, setTranscript] = useState('');
  const [browserError, setBrowserError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  // Tracks recording state for stopRecording() so it doesn't double-fire
  // when the MAX_RECORDING_MS timeout and the user click race each other.
  const isStoppingRef = useRef(false);

  // Detect browser support on mount — SSR returns null from
  // `unsupportedReason`, so we re-check client-side.
  useEffect(() => {
    setBrowserError(unsupportedReason());
  }, []);

  // Cleanup on unmount: stop recorder, kill stream tracks, clear timers.
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (tickRef.current) clearInterval(tickRef.current);
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* swallow — we're tearing down */
        }
      }
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
      }
    };
  }, []);

  const clearTimers = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
  }, []);

  const teardownStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  /**
   * Full pipeline once recording stops:
   *   1. Wrap chunks into a Blob (we know the MIME from the recorder).
   *   2. POST /api/upload for a presigned PUT URL.
   *   3. PUT the bytes to R2 (no progress bar — recordings are tiny).
   *   4. Call `transcribeAudio` server action with the resulting r2Ref.
   *   5. Push the transcript into state for the editable textarea.
   */
  const uploadAndTranscribe = useCallback(
    async (blob: Blob, mime: string) => {
      if (!isMountedRef.current) return;
      setState({ kind: 'uploading', progress: 0 });

      const extension = extensionFor(mime);
      // Random suffix prevents same-second uploads from colliding before
      // the server-side UUID step (defense in depth — the upload route
      // pins a UUID into the object key regardless).
      const filename = `voice-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${extension}`;

      // --- Step 1+2: presign + upload --------------------------------------
      let presign: { uploadUrl: string; r2Ref: string };
      try {
        const presignRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bucket: 'thread-files',
            pathPrefix: `vendors/${vendorProfileId}/voice-input`,
            filename,
            contentType: mime,
            sizeBytes: blob.size,
          }),
        });
        const data = (await presignRes.json()) as
          | { uploadUrl: string; r2Ref: string }
          | { error: string };
        if (!presignRes.ok || 'error' in data) {
          const msg =
            'error' in data ? data.error : `Upload setup failed (${presignRes.status})`;
          if (isMountedRef.current) setState({ kind: 'error', message: msg });
          return;
        }
        presign = data;
      } catch (e) {
        if (isMountedRef.current) {
          setState({
            kind: 'error',
            message:
              e instanceof Error
                ? `Could not reach upload service: ${e.message}`
                : 'Could not reach upload service.',
          });
        }
        return;
      }

      // PUT the Blob. Tiny payloads (≤ 5 MB) — we skip the XHR-progress
      // dance the FileUpload widget uses because a determinate bar adds
      // little value for 1–2 second uploads.
      try {
        const putRes = await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': mime },
          body: blob,
        });
        if (!putRes.ok) {
          if (isMountedRef.current) {
            setState({
              kind: 'error',
              message: `R2 rejected the upload (status ${putRes.status}). Please try again.`,
            });
          }
          return;
        }
      } catch (e) {
        if (isMountedRef.current) {
          setState({
            kind: 'error',
            message:
              e instanceof Error
                ? `Upload failed: ${e.message}`
                : 'Upload failed.',
          });
        }
        return;
      }

      if (!isMountedRef.current) return;

      // --- Step 4: transcribe ----------------------------------------------
      setState({ kind: 'transcribing' });
      try {
        const result = await transcribeAudio(presign.r2Ref);
        if (!isMountedRef.current) return;
        if (!result.ok) {
          setState({ kind: 'error', message: result.error });
          return;
        }
        setTranscript(result.transcript);
        setState({ kind: 'ready' });
      } catch (e) {
        if (isMountedRef.current) {
          setState({
            kind: 'error',
            message:
              e instanceof Error
                ? `Transcription failed: ${e.message}`
                : 'Transcription failed.',
          });
        }
      }
    },
    [vendorProfileId],
  );

  const stopRecording = useCallback(() => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    clearTimers();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // If `.stop()` throws (rare — usually means the recorder is already
        // inactive), fall back to manually firing the upload pipeline with
        // whatever we've collected so far.
        const mime = mediaRecorderRef.current.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mime });
        teardownStream();
        chunksRef.current = [];
        if (blob.size > 0) void uploadAndTranscribe(blob, mime);
        else {
          setState({
            kind: 'error',
            message: `Could not finalize recording: ${(e as Error).message}`,
          });
        }
      }
    }
    // The recorder's `stop` event handler (set in startRecording) is what
    // actually calls `uploadAndTranscribe` in the common case.
  }, [clearTimers, teardownStream, uploadAndTranscribe]);

  const startRecording = useCallback(async () => {
    if (browserError !== null || disabled) return;
    setState({ kind: 'idle' });

    const mime = pickSupportedMimeType();
    if (!mime) {
      setState({
        kind: 'error',
        message:
          'This browser does not support audio recording in a compatible format.',
      });
      return;
    }

    // Request microphone access. Browser handles the native permission
    // prompt; if the user denies we land in the catch block.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      // DOMException with name NotAllowedError means user denied; surface
      // a more actionable message than the raw browser text.
      const name = (e as DOMException | Error & { name?: string }).name ?? '';
      let message = 'Could not access microphone.';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        message =
          'Microphone permission was blocked. Allow microphone access in your browser settings and try again.';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        message = 'No microphone was found on this device.';
      }
      setState({ kind: 'error', message });
      return;
    }

    if (!isMountedRef.current) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch (e) {
      for (const track of stream.getTracks()) track.stop();
      setState({
        kind: 'error',
        message: `Could not initialize recorder: ${(e as Error).message}`,
      });
      return;
    }

    streamRef.current = stream;
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];
    isStoppingRef.current = false;

    recorder.addEventListener('dataavailable', (evt: BlobEvent) => {
      if (evt.data && evt.data.size > 0) chunksRef.current.push(evt.data);
    });

    recorder.addEventListener('stop', () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];
      teardownStream();
      if (blob.size === 0) {
        if (isMountedRef.current) {
          setState({
            kind: 'error',
            message: 'Recording was empty. Please try again.',
          });
        }
        return;
      }
      void uploadAndTranscribe(blob, mime);
    });

    recorder.addEventListener('error', () => {
      teardownStream();
      if (isMountedRef.current) {
        setState({
          kind: 'error',
          message: 'Recording failed mid-capture. Please try again.',
        });
      }
    });

    startTimeRef.current = Date.now();
    setState({ kind: 'recording', startedAt: startTimeRef.current, elapsedMs: 0 });

    // 100ms timeslice — emits dataavailable events incrementally so a
    // sudden tab close still leaves us with most of the audio. Whisper
    // happily ingests multi-chunk webm.
    recorder.start(100);

    // UI tick for the elapsed-time readout.
    tickRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;
      setState((curr) =>
        curr.kind === 'recording' ? { ...curr, elapsedMs: elapsed } : curr,
      );
    }, TICK_INTERVAL_MS);

    // Hard cap — even if the vendor walks away from the mic, we stop
    // after 60s so we don't blow past the upload-route size cap (5MB
    // worth of opus is roughly 5 minutes; 60s leaves plenty of safety
    // margin but UX-wise short bursts are the right pattern).
    stopTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) stopRecording();
    }, MAX_RECORDING_MS);
  }, [browserError, disabled, stopRecording, teardownStream, uploadAndTranscribe]);

  /** Reset everything to "ready to record" — clears the transcript too. */
  const handleReset = useCallback(() => {
    clearTimers();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    teardownStream();
    chunksRef.current = [];
    isStoppingRef.current = false;
    setTranscript('');
    setState({ kind: 'idle' });
  }, [clearTimers, teardownStream]);

  // -- Render --------------------------------------------------------------

  if (browserError) {
    return (
      <div className="space-y-3 rounded-2xl border border-amber-300/50 bg-amber-50 p-5 sm:p-6">
        <div className="flex items-start gap-2">
          <AlertCircle
            aria-hidden
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
            strokeWidth={1.75}
          />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-900">
              Voice input is not available in this browser.
            </p>
            <p className="text-xs text-amber-900/80">{browserError}</p>
          </div>
        </div>
      </div>
    );
  }

  const isRecording = state.kind === 'recording';
  const isBusy =
    state.kind === 'uploading' || state.kind === 'transcribing';
  const hasTranscript = transcript.trim().length > 0;
  const elapsedSeconds = isRecording ? Math.floor(state.elapsedMs / 1000) : 0;
  const elapsedFraction = isRecording
    ? Math.min(1, state.elapsedMs / MAX_RECORDING_MS)
    : 0;

  // Status banner copy — keeps the mic icon stable while the surrounding
  // text narrates progress. Friendly + cheap copy; the polished version
  // would localize to Tagalog itself but that's out of scope here.
  let statusLabel = 'Tap to start recording';
  if (isRecording) statusLabel = 'Recording…';
  else if (state.kind === 'uploading') statusLabel = 'Uploading audio…';
  else if (state.kind === 'transcribing') statusLabel = 'Transcribing…';
  else if (state.kind === 'ready' && hasTranscript)
    statusLabel = 'Ready to generate. Edit the transcript if needed.';
  else if (state.kind === 'error') statusLabel = 'Recording error';

  return (
    <div className="space-y-5 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <div className="space-y-1">
        <p className="block text-sm font-medium text-ink">
          Describe your services out loud — Tagalog, English, or Taglish all
          work.
        </p>
        <p className="text-xs text-ink/60">
          Mention what you offer, your packages, pricing, and what&rsquo;s
          included. Keep recordings under 60 seconds for the best results.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 py-3">
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || isBusy}
          aria-pressed={isRecording}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          className={`relative inline-flex h-24 w-24 items-center justify-center rounded-full transition-all sm:h-28 sm:w-28 ${
            isRecording
              ? 'bg-terracotta text-cream shadow-lg shadow-terracotta/30 animate-pulse'
              : isBusy
                ? 'bg-terracotta/20 text-terracotta cursor-wait'
                : 'bg-terracotta text-cream shadow-md shadow-terracotta/20 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100'
          }`}
        >
          {isBusy ? (
            <Loader2 aria-hidden className="h-10 w-10 animate-spin" strokeWidth={1.75} />
          ) : isRecording ? (
            <Square aria-hidden className="h-9 w-9 fill-current" strokeWidth={1.5} />
          ) : (
            <Mic aria-hidden className="h-10 w-10" strokeWidth={1.75} />
          )}

          {/* Outer pulse ring while recording — purely decorative. */}
          {isRecording ? (
            <span
              aria-hidden
              className="absolute inset-0 -m-2 rounded-full border-2 border-terracotta/40 animate-ping"
            />
          ) : null}
        </button>

        <div className="text-center">
          <p className="text-sm font-medium text-ink/85">{statusLabel}</p>
          {isRecording ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
              {elapsedSeconds}s / 60s
            </p>
          ) : null}
        </div>

        {isRecording ? (
          <div
            className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-ink/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={60}
            aria-valuenow={elapsedSeconds}
            aria-label="Recording progress"
          >
            <span
              className="block h-full rounded-full bg-terracotta transition-all"
              style={{ width: `${elapsedFraction * 100}%` }}
            />
          </div>
        ) : null}
      </div>

      {state.kind === 'error' ? (
        <p
          role="alert"
          className="flex items-start gap-1.5 rounded-md border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-sm text-terracotta-700"
        >
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <span>{state.message}</span>
        </p>
      ) : null}

      {hasTranscript || state.kind === 'ready' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="voice-transcript"
              className="block text-xs font-medium text-ink/70"
            >
              Transcript (you can edit before generating)
            </label>
            <button
              type="button"
              onClick={handleReset}
              disabled={disabled || isBusy}
              className="inline-flex items-center gap-1 text-xs text-ink/55 underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
            >
              <RotateCcw aria-hidden className="h-3 w-3" strokeWidth={2} />
              Re-record
            </button>
          </div>
          <textarea
            id="voice-transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={6}
            className="input-field w-full resize-y font-sans text-sm leading-relaxed"
            maxLength={4000}
            disabled={disabled || isBusy}
          />
          <div className="flex justify-end">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">
              {transcript.length} / 4000
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onSubmit(transcript.trim())}
          disabled={
            disabled || isBusy || isRecording || transcript.trim().length === 0
          }
          className="button-primary inline-flex items-center gap-2"
        >
          <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Generate catalog from voice
        </button>
      </div>
    </div>
  );
}
