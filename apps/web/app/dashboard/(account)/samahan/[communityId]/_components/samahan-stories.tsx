'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clapperboard, Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import { compressVideoForWeb } from '@/lib/video-compress';
import type { SamahanStory } from '@/lib/samahan-stories';

// Samahan Stories strip (Setlog concept, owner 2026-08-24): raw short clips,
// one per member per hour, gone in 24 hours.
//
// The composer is a CAMERA, not an upload (owner 2026-08-24: "this should be
// upload a video. it should be record your 3 seconds. then compress it"):
// tap → live preview → record exactly RECORD_MS → the phone transcodes the
// recording to web720 (the same compressVideoForWeb both Papic cameras use),
// draws the poster frame from the last live frame, and posts. The server
// never sees a raw phone export. A file picker survives ONLY as the fallback
// for devices where the camera is unavailable or refused.

const RECORD_MS = 3000; // the Setlog rhythm — three raw seconds, auto-stop
const MAX_DURATION_S = 10; // platform clip cap — the server refuses past it
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const ERROR_COPY: Record<string, string> = {
  one_per_hour: 'One story an hour — yours for this hour is already up.',
  too_long: 'Keep it under 10 seconds — 2 or 3 is perfect.',
  screen_refused: 'That clip can’t go up here.',
  screen_unavailable: 'We couldn’t check that clip just now. Try again in a moment.',
  clip_size: 'That video is too heavy to share. Try a shorter clip.',
  not_a_member: 'Only members can post here.',
};

function hoursLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'gone';
  const h = ms / 3_600_000;
  return h >= 1 ? `${Math.floor(h)}h left` : `${Math.max(1, Math.floor(ms / 60_000))}m left`;
}

/** Poster + duration from an already-recorded/picked video file (fallback path). */
async function extractPoster(file: File): Promise<{ poster: Blob; durationS: number }> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('unreadable'));
    });
    const durationS = Number.isFinite(video.duration) ? video.duration : 0;
    video.currentTime = Math.min(0.1, Math.max(0, durationS / 2));
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('unreadable'));
    });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const poster = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no_poster'))), 'image/jpeg', 0.8);
    });
    return { poster, durationS };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function SamahanStories({
  communityId,
  stories,
}: {
  communityId: string;
  stories: SamahanStory[];
}) {
  const router = useRouter();
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [recording, setRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const [busy, setBusy] = useState<'idle' | 'compressing' | 'posting'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [playing, setPlaying] = useState<SamahanStory | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const myHourUsed = useMemo(() => {
    const hourStart = new Date();
    hourStart.setMinutes(0, 0, 0);
    return stories.some((s) => s.is_self && new Date(s.created_at) >= hourStart);
  }, [stories]);

  const closeCamera = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    stopTimerRef.current = null;
    tickRef.current = null;
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      // Detach onstop first — closing mid-record ABANDONS the take, it
      // doesn't post it.
      rec.onstop = null;
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRecording(false);
    setCameraReady(false);
    setCameraOpen(false);
  }, []);

  // Stop the camera when the component unmounts with the sheet open.
  useEffect(() => closeCamera, [closeCamera]);

  // Re-attach the stream once the overlay's <video> has actually mounted —
  // getUserMedia can resolve before React commits the sheet, leaving
  // previewRef null at assignment time.
  useEffect(() => {
    if (!cameraOpen || !cameraReady) return;
    const video = previewRef.current;
    const stream = streamRef.current;
    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
      void video.play().catch(() => {});
    }
  }, [cameraOpen, cameraReady]);

  const openCamera = useCallback(
    async (nextFacing?: 'user' | 'environment') => {
      const face = nextFacing ?? facing;
      setMessage(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        // No camera API at all (old browser, some desktops) — fall back to
        // the picker, whose capture attr still opens a camera app on phones.
        fallbackInputRef.current?.click();
        return;
      }
      // Swap streams cleanly on flip.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraReady(false);
      setCameraOpen(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: face, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        streamRef.current = stream;
        setFacing(face);
        if (previewRef.current) {
          previewRef.current.srcObject = stream;
          void previewRef.current.play().catch(() => {});
        }
        setCameraReady(true);
      } catch {
        setCameraOpen(false);
        // Refused or busy — the picker is the honest fallback, not an error
        // dead-end.
        setMessage('We couldn’t open your camera — you can record with your camera app instead.');
        fallbackInputRef.current?.click();
      }
    },
    [facing],
  );

  const grabPoster = useCallback(async (): Promise<Blob | null> => {
    const video = previewRef.current;
    if (!video || video.videoWidth === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8);
    });
  }, []);

  const postClip = useCallback(
    async (clip: File, poster: Blob, durationMs: number) => {
      try {
        setBusy('compressing');
        const web = await compressVideoForWeb(clip, { profile: 'web720' });
        if (web.size > MAX_UPLOAD_BYTES) {
          setMessage(ERROR_COPY.clip_size!);
          return;
        }
        setBusy('posting');
        const form = new FormData();
        form.append('community_id', communityId);
        form.append('clip', web, web.name || 'story.mp4');
        form.append('poster', poster, 'poster.jpg');
        form.append('duration_ms', String(Math.min(Math.max(1, Math.round(durationMs)), 10_000)));
        const res = await fetch('/api/samahan/story', { method: 'POST', body: form });
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          setMessage(ERROR_COPY[json?.error ?? ''] ?? 'That didn’t go up. Try again.');
          return;
        }
        router.refresh();
      } catch {
        setMessage('That didn’t go up. Try again.');
      } finally {
        setBusy('idle');
      }
    },
    [communityId, router],
  );

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || recording || busy !== 'idle') return;
    chunksRef.current = [];
    // Recorder created + started SYNCHRONOUSLY (the Papic capture lesson —
    // an await here strands a quick take with no live recorder to stop).
    let mimeType = '';
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
      if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4';
      else if (MediaRecorder.isTypeSupported('video/webm')) mimeType = 'video/webm';
    }
    let rec: MediaRecorder;
    try {
      const opts: MediaRecorderOptions = {};
      if (mimeType) opts.mimeType = mimeType;
      rec = new MediaRecorder(stream, opts);
    } catch {
      setMessage('Recording isn’t supported on this browser — try another phone.');
      return;
    }
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = async () => {
      setRecording(false);
      if (tickRef.current) clearInterval(tickRef.current);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      tickRef.current = null;
      stopTimerRef.current = null;
      const durationMs = Math.min(Date.now() - startedAtRef.current, RECORD_MS);
      const type = rec.mimeType || mimeType || 'video/mp4';
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      // Poster from the LAST LIVE FRAME, before the stream dies — same NSFW
      // proxy the Papic cameras use.
      const poster = await grabPoster();
      closeCamera();
      if (blob.size === 0 || !poster) {
        setMessage('That recording came back empty — try again.');
        return;
      }
      const ext = type.includes('webm') ? 'webm' : 'mp4';
      await postClip(new File([blob], `story.${ext}`, { type }), poster, durationMs);
    };

    startedAtRef.current = Date.now();
    setRecElapsed(0);
    setMessage(null);
    try {
      rec.start();
    } catch {
      setMessage('Couldn’t start recording — try again.');
      return;
    }
    setRecording(true);
    // The whole point: exactly three seconds, then it stops itself.
    stopTimerRef.current = setTimeout(stopRecording, RECORD_MS);
    tickRef.current = setInterval(() => {
      setRecElapsed(Math.min(RECORD_MS, Date.now() - startedAtRef.current));
    }, 100);
  }, [recording, busy, grabPoster, closeCamera, postClip, stopRecording]);

  // Fallback ONLY (camera refused/unavailable): a picked file still goes
  // through the same duration gate, poster extraction and compression.
  async function onPick(file: File) {
    setMessage(null);
    try {
      const { poster, durationS } = await extractPoster(file);
      if (durationS > MAX_DURATION_S + 0.9) {
        setMessage(ERROR_COPY.too_long!);
        return;
      }
      await postClip(file, poster, durationS * 1000);
    } catch {
      setMessage('We couldn’t read that video. Try another one.');
    } finally {
      if (fallbackInputRef.current) fallbackInputRef.current.value = '';
    }
  }

  async function onRemove(storyId: string) {
    setRemoving(storyId);
    try {
      const res = await fetch('/api/samahan/story', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ story_id: storyId }),
      });
      if (res.ok) {
        setPlaying(null);
        router.refresh();
      }
    } finally {
      setRemoving(null);
    }
  }

  return (
    <section aria-label="Stories">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">This hour, right now</h2>
          <p className="text-xs text-ink/60">
            Three raw seconds from each of you — one an hour, gone after 24.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void openCamera()}
          disabled={busy !== 'idle' || myHourUsed}
          className="inline-flex items-center gap-1.5 rounded-full bg-mulberry px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy !== 'idle' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Clapperboard className="h-3.5 w-3.5" aria-hidden />
          )}
          {busy === 'compressing'
            ? 'Shrinking…'
            : busy === 'posting'
              ? 'Posting…'
              : myHourUsed
                ? 'Yours is up'
                : 'Record your 3 seconds'}
        </button>
      </div>
      <input
        ref={fallbackInputRef}
        type="file"
        accept="video/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPick(f);
        }}
      />
      {message ? <p className="mt-2 text-xs text-mulberry-700">{message}</p> : null}

      {stories.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-ink/15 p-4 text-xs text-ink/55">
          Nothing yet this day. Record three seconds of whatever is in front of you.
        </p>
      ) : (
        <ul className="mt-4 flex gap-3 overflow-x-auto pb-2" role="list">
          {stories.map((s) => (
            <li key={s.story_id} className="w-24 flex-none">
              <button
                type="button"
                onClick={() => setPlaying(s)}
                className="block w-full overflow-hidden rounded-xl border border-ink/10 bg-ink/5"
                aria-label={`Play ${s.author_name}’s story`}
              >
                {s.poster_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived presigned URL; the optimizer would re-transform per render
                  <img
                    src={s.poster_url}
                    alt=""
                    className="aspect-[3/4] w-full object-cover"
                  />
                ) : (
                  <span className="flex aspect-[3/4] w-full items-center justify-center text-ink/30">
                    <Clapperboard className="h-6 w-6" aria-hidden />
                  </span>
                )}
              </button>
              <p className="mt-1 truncate text-[11px] font-medium text-ink/80">
                {s.is_self ? 'You' : s.author_name}
              </p>
              <p className="text-[10px] text-ink/50">{hoursLeft(s.expires_at)}</p>
            </li>
          ))}
        </ul>
      )}

      {cameraOpen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/95 p-4"
          role="dialog"
          aria-label="Record your 3 seconds"
        >
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-black">
            <video
              ref={previewRef}
              autoPlay
              muted
              playsInline
              className={`aspect-[3/4] w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
            />
            {!cameraReady ? (
              <span className="absolute inset-0 flex items-center justify-center text-white/70">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
              </span>
            ) : null}
            {recording ? (
              <div className="absolute inset-x-0 top-0 h-1 bg-white/20">
                <div
                  className="h-1 bg-mulberry transition-[width] duration-100 ease-linear"
                  style={{ width: `${Math.round((recElapsed / RECORD_MS) * 100)}%` }}
                />
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex w-full max-w-sm items-center justify-between">
            <button
              type="button"
              onClick={closeCamera}
              className="inline-flex items-center gap-1 text-xs text-white/80"
            >
              <X className="h-3.5 w-3.5" aria-hidden /> Close
            </button>
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={!cameraReady}
              aria-label={recording ? 'Stop recording' : 'Start recording'}
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/80 disabled:opacity-40"
            >
              <span
                className={
                  recording
                    ? 'h-6 w-6 rounded-sm bg-mulberry'
                    : 'h-12 w-12 rounded-full bg-mulberry'
                }
              />
            </button>
            <button
              type="button"
              onClick={() => void openCamera(facing === 'user' ? 'environment' : 'user')}
              disabled={recording}
              className="inline-flex items-center gap-1 text-xs text-white/80 disabled:opacity-40"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Flip
            </button>
          </div>
          <p className="mt-3 text-xs text-white/60">
            {recording
              ? `${Math.max(0, Math.ceil((RECORD_MS - recElapsed) / 1000))}s`
              : 'It records three seconds and stops by itself.'}
          </p>
        </div>
      ) : null}

      {playing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4"
          role="dialog"
          aria-label={`${playing.author_name}’s story`}
        >
          <div className="relative w-full max-w-sm">
            {playing.clip_url ? (
              <video
                src={playing.clip_url}
                poster={playing.poster_url ?? undefined}
                autoPlay
                loop
                playsInline
                controls
                className="w-full rounded-2xl"
              />
            ) : null}
            <div className="mt-3 flex items-center justify-between text-xs text-white/80">
              <span>
                {playing.is_self ? 'You' : playing.author_name} · {hoursLeft(playing.expires_at)}
              </span>
              <span className="flex items-center gap-3">
                {playing.is_self ? (
                  <button
                    type="button"
                    onClick={() => void onRemove(playing.story_id)}
                    disabled={removing === playing.story_id}
                    className="inline-flex items-center gap-1 text-white/80 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Take it down
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPlaying(null)}
                  className="inline-flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" aria-hidden /> Close
                </button>
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
