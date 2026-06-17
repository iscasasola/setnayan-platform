'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Loader2,
  Check,
  CircleAlert,
  ImageIcon,
  Video,
  Square,
  PartyPopper,
  Users,
  ScanLine,
} from 'lucide-react';
import {
  recordSeatCapture,
  tagSeatCapture,
  autoTagSeatCapture,
} from '@/app/papic/actions';
import { makeQrDetector } from '@/lib/qr-scan';

// Papic · paparazzo capture (client)
//
// The working web-capture slice for a claimed seat. Rear camera (getUserMedia
// facingMode: environment). PHOTO mode freezes a frame to a canvas → JPEG. CLIP
// mode records up to 5 seconds via MediaRecorder (a HARD client cap — the corpus
// constraint, not configurable), grabs a poster frame, and uploads both. Bytes
// are presigned via /api/upload (the media bucket already allows video MIME) →
// PUT to R2 → recorded through recordSeatCapture (RLS lets the claimer insert on
// their own seat). Free-sampler seats are capped (8 photos + 2 clips per seat);
// paid seats are uncapped. Mobile-first: full-bleed stage, thumb-reachable
// controls.

const CLIP_MAX_MS = 5_000; // 5-second hard cap (corpus constraint · not configurable)
const TAG_CAP = 10; // max tags per photo (corpus hard cap · mirrored server-side)

/** Friendly, paparazzo-facing copy for a tag failure. The camera never breaks
 *  on a tag miss — these just steer the next scan. */
function tagErrorMessage(error: string): string {
  switch (error) {
    case 'unrecognized':
      return 'That’s not a guest or table QR — point at a place card or table sign.';
    case 'guest_not_found':
      return 'That guest QR isn’t on this wedding’s list.';
    case 'table_not_found':
      return 'That table QR isn’t on this wedding’s seating plan.';
    case 'cap_reached':
      return `This photo already has all ${TAG_CAP} tags.`;
    case 'unavailable':
      return 'Tagging isn’t ready yet — your photo’s saved either way.';
    default:
      return 'That tag didn’t save — try the scan again.';
  }
}

type Props = {
  token: string;
  seatIndex: number;
  isFreeSampler?: boolean;
  initialPhotos: number;
  initialClips: number;
  /** null = uncapped (paid seat); a number = the free-sampler per-seat cap. */
  photoCap?: number | null;
  clipCap?: number | null;
};

/** Pick a MediaRecorder container the browser actually supports (Safari → mp4,
 *  Chrome/Firefox → webm). Falls back to plain webm. */
function pickClipMime(): string {
  const candidates = [
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  if (typeof MediaRecorder !== 'undefined') {
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c)) return c;
    }
  }
  return 'video/webm';
}

export function PapicSeatCapture({
  token,
  seatIndex,
  isFreeSampler = false,
  initialPhotos,
  initialClips,
  photoCap = null,
  clipCap = null,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mode, setMode] = useState<'photo' | 'clip'>('photo');
  const [photos, setPhotos] = useState(initialPhotos);
  const [clips, setClips] = useState(initialClips);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ---- tagging (scan-to-tag) ----------------------------------------------
  // After a capture lands we keep its photo_id so the paparazzo can scan guest /
  // table QRs to record who's in it. Tagging reuses the SAME live stream (no
  // second getUserMedia — iOS-safe), running a QR decode loop while open.
  const [lastPhotoId, setLastPhotoId] = useState<string | null>(null);
  const [tagging, setTagging] = useState(false);
  const [tagCount, setTagCount] = useState(0);
  const [taggedNames, setTaggedNames] = useState<string[]>([]);
  const [tagNotice, setTagNotice] = useState<string | null>(null);
  const tagBusyRef = useRef(false);
  const lastScanRef = useRef<string>('');

  const photoFull = photoCap != null && photos >= photoCap;
  const clipFull = clipCap != null && clips >= clipCap;
  const clipsAllowed = clipCap == null || clipCap > 0;
  const capped = photoCap != null || clipCap != null;

  useEffect(() => {
    let cancelled = false;
    async function acquire(withAudio: boolean) {
      return navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: withAudio,
      });
    }
    async function start() {
      // ONE stream for the whole session (the iOS-safe shape — a second
      // getUserMedia while the camera is live can interrupt it). Prefer audio so
      // clips have sound; if the mic is denied/unavailable, fall back to
      // video-only (silent clips) rather than losing the camera entirely.
      try {
        let stream: MediaStream;
        try {
          stream = await acquire(true);
        } catch {
          stream = await acquire(false);
        }
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
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Presign + PUT a blob to R2; returns the stored r2:// ref (or throws).
  const uploadBlob = useCallback(
    async (blob: Blob, contentType: string, ext: string): Promise<string> => {
      const presignRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket: 'media',
          pathPrefix: isFreeSampler
            ? `papic-sampler/seat-${seatIndex}`
            : `papic/seat-${seatIndex}`,
          filename: `papic-${Date.now()}.${ext}`,
          contentType,
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
        headers: { 'Content-Type': contentType },
        body: blob,
      });
      if (!putRes.ok) throw new Error('put');
      return r2Ref;
    },
    [isFreeSampler, seatIndex],
  );

  // Grab the current video frame as a JPEG blob (the photo body, or a clip's
  // poster frame). Returns null if the stream isn't producing pixels yet.
  const grabFrame = useCallback(async (): Promise<Blob | null> => {
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
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    );
  }, []);

  const flash = useCallback(() => {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 900);
  }, []);

  // Point the tag flow at a freshly-captured photo (resets the running count +
  // scan debounce). photoId can be null in the degraded insert path — then the
  // "Tag people" affordance simply doesn't appear for that shot.
  const armTagging = useCallback((photoId: string | null) => {
    setLastPhotoId(photoId);
    setTagCount(0);
    setTaggedNames([]);
    setTagNotice(null);
    lastScanRef.current = '';
  }, []);

  // FACE auto-tag (best-effort, fire-and-forget) — runs AFTER the photo is saved
  // so the shutter stays instant and the photo always lands (untagged-still-
  // delivered). The phone detects faces + computes their 128-d descriptors
  // on-device (lazy-imported face-api.js) from the just-shot frame and sends ONLY
  // the vectors to the matcher; the face IMAGE never leaves the device. Dormant
  // until a face model is hosted (NEXT_PUBLIC_FACE_MODEL_URL) — embedFaces then
  // returns [] and this no-ops. Any error is swallowed; QR scan stays the manual
  // fallback either way.
  const autoTagFromBlob = useCallback(
    async (photoId: string, imageBlob: Blob) => {
      try {
        const { embedFaces } = await import('@/lib/face-embed');
        const url = URL.createObjectURL(imageBlob);
        try {
          const img = new Image();
          img.src = url;
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('decode'));
          });
          const vectors = await embedFaces(img);
          if (vectors.length > 0) {
            await autoTagSeatCapture(token, photoId, vectors);
          }
        } finally {
          URL.revokeObjectURL(url);
        }
      } catch {
        // best-effort — a face-tag miss never affects the saved photo
      }
    },
    [token],
  );

  const capturePhoto = useCallback(async () => {
    if (busy || recording || !ready || photoFull) return;
    setBusy(true);
    setSaveError(null);
    try {
      const blob = await grabFrame();
      if (!blob) throw new Error('frame');
      const r2Ref = await uploadBlob(blob, 'image/jpeg', 'jpg');
      const result = await recordSeatCapture(token, r2Ref, 'photo');
      if (!result.ok) {
        // A cap hit is a SUCCESS state, not an error — reflect "full" so the UI
        // shows the celebratory cap message instead of "didn't save".
        if (result.error === 'sampler_photo_cap') {
          setPhotos(photoCap ?? photos);
          return;
        }
        throw new Error(result.error);
      }
      setPhotos((n) => n + 1);
      flash();
      armTagging(result.photoId);
      if (result.photoId) void autoTagFromBlob(result.photoId, blob);
    } catch {
      setSaveError("That shot didn't save — check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, recording, ready, photoFull, grabFrame, uploadBlob, token, photoCap, photos, flash, armTagging, autoTagFromBlob]);

  const finishClip = useCallback(
    async (clipBlob: Blob, mime: string) => {
      setBusy(true);
      setSaveError(null);
      try {
        const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
        const poster = await grabFrame(); // last live frame ≈ a fine poster
        const clipRef = await uploadBlob(clipBlob, mime, ext);
        let posterRef: string | undefined;
        if (poster) {
          try {
            posterRef = await uploadBlob(poster, 'image/jpeg', 'jpg');
          } catch {
            posterRef = undefined; // poster is best-effort; clip still lands
          }
        }
        const result = await recordSeatCapture(token, clipRef, 'clip', posterRef);
        if (!result.ok) {
          if (result.error === 'sampler_clip_cap') {
            setClips(clipCap ?? clips);
            return;
          }
          throw new Error(result.error);
        }
        setClips((n) => n + 1);
        flash();
        armTagging(result.photoId);
        // Clips: embed from the poster frame (the still proxy we already grabbed).
        if (result.photoId && poster) void autoTagFromBlob(result.photoId, poster);
      } catch {
        setSaveError("That clip didn't save — check your signal and try again.");
      } finally {
        setBusy(false);
      }
    },
    [grabFrame, uploadBlob, token, clipCap, clips, flash, armTagging, autoTagFromBlob],
  );

  const stopClip = useCallback(() => {
    if (clipTimerRef.current) {
      clearTimeout(clipTimerRef.current);
      clipTimerRef.current = null;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }, []);

  const startClip = useCallback(() => {
    if (busy || recording || !ready || clipFull) return;
    const stream = streamRef.current;
    if (!stream || stream.getVideoTracks().length === 0) return;
    setSaveError(null);

    const mime = pickClipMime();
    let recorder: MediaRecorder;
    try {
      // Record the live session stream directly (video + audio if the mic was
      // granted at startup) — no second getUserMedia, so iOS never drops the
      // camera mid-clip.
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      setSaveError('Clips aren’t supported on this browser — photos still work.');
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      setRecording(false);
      const blob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];
      if (blob.size > 0) void finishClip(blob, mime);
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    // Hard 5-second cap — auto-stop. Not configurable (corpus constraint).
    clipTimerRef.current = setTimeout(stopClip, CLIP_MAX_MS);
  }, [busy, recording, ready, clipFull, finishClip, stopClip]);

  // ---- tagging -------------------------------------------------------------

  const startTagging = useCallback(() => {
    if (!lastPhotoId) return;
    lastScanRef.current = '';
    tagBusyRef.current = false;
    setTagNotice(null);
    setTagging(true);
  }, [lastPhotoId]);

  const stopTagging = useCallback(() => {
    setTagging(false);
  }, []);

  // Act on one decoded QR payload: hand it to the server (which classifies it as
  // a guest or table code, resolves within this event, and writes the tag). The
  // camera keeps running regardless — a miss only steers the next scan.
  const handleScan = useCallback(
    async (raw: string) => {
      if (!lastPhotoId) return;
      const result = await tagSeatCapture(token, lastPhotoId, raw);
      if (!result.ok) {
        setTagNotice(tagErrorMessage(result.error));
        // A transient/server error ('tag_failed') is worth retrying — clear the
        // scan debounce so the SAME code held under the lens self-heals on the
        // next tick instead of being silently stuck until the next capture.
        // Deterministic outcomes (unrecognized / not-found / cap / unavailable)
        // stay debounced so a held code can't spam the RPC.
        if (result.error === 'tag_failed') lastScanRef.current = '';
        return;
      }
      if (typeof navigator !== 'undefined') navigator.vibrate?.(60);
      setTagCount(result.tagCount);
      if (result.added > 0) {
        setTaggedNames((prev) =>
          Array.from(new Set([...prev, ...result.names])),
        );
      }
      if (result.kind === 'table') {
        if (result.added === 0 && (result.totalAtTable ?? 0) === 0) {
          setTagNotice(`No one’s seated at ${result.tableLabel ?? 'that table'} yet.`);
        } else if (result.truncated) {
          setTagNotice(
            `${result.tableLabel ?? 'Table'}: added ${result.added}, but this photo hit the ${TAG_CAP}-tag limit.`,
          );
        } else if (result.added === 0) {
          setTagNotice(`Everyone at ${result.tableLabel ?? 'that table'} is already tagged.`);
        } else {
          setTagNotice(null);
        }
      } else {
        setTagNotice(
          result.already ? `${result.names[0] ?? 'They’re'} already tagged.` : null,
        );
      }
    },
    [lastPhotoId, token],
  );

  // Decode loop — runs only while the tag sheet is open, on the EXISTING live
  // stream. Serial (awaits each decode before the next) + debounced on the raw
  // payload so a code held under the lens fires once, not every frame.
  useEffect(() => {
    if (!tagging) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const detect = await makeQrDetector();
      if (!active) return;
      const loop = async () => {
        if (!active) return;
        const video = videoRef.current;
        if (video && !tagBusyRef.current) {
          const raw = await detect(video).catch(() => null);
          if (active && raw && raw !== lastScanRef.current) {
            lastScanRef.current = raw;
            tagBusyRef.current = true;
            try {
              await handleScan(raw);
            } finally {
              tagBusyRef.current = false;
            }
          }
        }
        if (active) timer = setTimeout(loop, 200);
      };
      void loop();
    })();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [tagging, handleScan]);

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

  const currentFull = mode === 'clip' ? clipFull : photoFull;
  const otherModeHasRoom = mode === 'clip' ? !photoFull : !clipFull && clipsAllowed;

  const countLabel = capped
    ? mode === 'clip'
      ? `${clips}/${clipCap} ${clips === 1 ? 'clip' : 'clips'}`
      : `${photos}/${photoCap} ${photos === 1 ? 'photo' : 'photos'}`
    : `${photos + clips} ${photos + clips === 1 ? 'shot' : 'shots'}`;

  return (
    <main className="flex min-h-screen flex-col bg-ink text-cream">
      <header className="flex items-center justify-between px-4 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cream/70">
          Papic · seat {seatIndex}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 text-xs font-medium text-cream">
          {mode === 'clip' ? (
            <Video aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <ImageIcon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          {countLabel}
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
        {recording && (
          <div className="absolute left-1/2 top-4 -translate-x-1/2">
            <span className="inline-flex items-center gap-2 rounded-full bg-ink/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-cream">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-terracotta" />
              Recording · max 5s
            </span>
          </div>
        )}
        {justSaved && (
          <div className="absolute inset-0 flex items-center justify-center bg-cream/15">
            <span className="inline-flex items-center gap-2 rounded-full bg-ink/70 px-4 py-2 text-sm font-medium text-cream">
              <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} /> Saved
            </span>
          </div>
        )}
        {tagging && (
          <>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex h-48 w-48 items-center justify-center rounded-3xl border-2 border-cream/80 shadow-[0_0_0_2000px_rgba(30,34,41,0.35)]">
                <ScanLine aria-hidden className="h-7 w-7 animate-pulse text-cream/80" strokeWidth={1.75} />
              </div>
            </div>
            <div className="absolute left-1/2 top-4 -translate-x-1/2">
              <span className="inline-flex items-center gap-2 rounded-full bg-ink/70 px-3 py-1.5 text-xs font-semibold text-cream">
                Scanning · {tagCount}/{TAG_CAP} tagged
              </span>
            </div>
          </>
        )}
      </div>

      <div className="space-y-3 px-4 pb-8 pt-4">
        {tagging ? (
          /* Tag sheet — scan guest / table QRs to record who's in the last shot. */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-cream">Tag who&rsquo;s in this shot</p>
              <span className="rounded-full bg-cream/10 px-2.5 py-1 text-xs font-medium text-cream/80">
                {tagCount}/{TAG_CAP}
              </span>
            </div>
            {taggedNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {taggedNames.map((n) => (
                  <span
                    key={n}
                    className="inline-flex items-center gap-1 rounded-full bg-cream/10 px-2.5 py-1 text-xs text-cream"
                  >
                    <Check aria-hidden className="h-3 w-3" strokeWidth={2.5} /> {n}
                  </span>
                ))}
              </div>
            )}
            <p className="text-center text-xs text-cream/60">
              {tagCount >= TAG_CAP
                ? `This photo has all ${TAG_CAP} tags.`
                : 'Point at a guest’s place-card QR — or a table sign to tag the whole table.'}
            </p>
            {tagNotice && (
              <p className="text-center text-xs text-cream/80">{tagNotice}</p>
            )}
            {/* Persistent live region — announces notices + the running tag
                count to screen readers without affecting the visual layout. */}
            <span aria-live="polite" role="status" className="sr-only">
              {tagNotice ?? `${tagCount} of ${TAG_CAP} tagged`}
            </span>
            <button
              type="button"
              onClick={stopTagging}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-cream px-4 py-3 text-sm font-semibold text-ink transition active:scale-95"
            >
              <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} /> Done tagging
            </button>
          </div>
        ) : (
          <>
        {/* Photo / Clip mode toggle — only when clips are allowed for this seat. */}
        {clipsAllowed && (
          <div className="mx-auto flex w-full max-w-[14rem] items-center rounded-full bg-cream/10 p-1">
            <button
              type="button"
              onClick={() => !recording && !busy && setMode('photo')}
              disabled={recording || busy}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                mode === 'photo' ? 'bg-cream text-ink' : 'text-cream/70'
              }`}
            >
              <ImageIcon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Photo
            </button>
            <button
              type="button"
              onClick={() => !recording && !busy && setMode('clip')}
              disabled={recording || busy}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                mode === 'clip' ? 'bg-cream text-ink' : 'text-cream/70'
              }`}
            >
              <Video aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Clip
            </button>
          </div>
        )}

        {saveError && (
          <p className="text-center text-xs text-cream/80">{saveError}</p>
        )}

        {currentFull ? (
          <div className="mx-auto max-w-sm text-center">
            <PartyPopper aria-hidden className="mx-auto h-6 w-6 text-terracotta" strokeWidth={1.75} />
            <p className="mt-2 text-sm font-medium text-cream">
              That&rsquo;s all your free {mode === 'clip' ? 'clips' : 'photos'} —
              every one&rsquo;s in the couple&rsquo;s gallery.
            </p>
            {otherModeHasRoom && (
              <button
                type="button"
                onClick={() => setMode(mode === 'clip' ? 'photo' : 'clip')}
                className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full bg-cream/10 px-4 py-2 text-xs font-medium text-cream hover:bg-cream/15"
              >
                {mode === 'clip' ? (
                  <>
                    <ImageIcon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Shoot photos instead
                  </>
                ) : (
                  <>
                    <Video aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Try a clip instead
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center">
              {mode === 'clip' ? (
                <button
                  type="button"
                  onClick={recording ? stopClip : startClip}
                  disabled={busy || !ready}
                  aria-label={recording ? 'Stop recording' : 'Record a clip'}
                  className="flex items-center justify-center rounded-full border-4 border-cream/80 bg-cream/10 transition active:scale-95 disabled:opacity-50"
                  style={{ height: '4.5rem', width: '4.5rem' }}
                >
                  {busy ? (
                    <Loader2 aria-hidden className="h-7 w-7 animate-spin text-cream" strokeWidth={2} />
                  ) : recording ? (
                    <Square aria-hidden className="h-6 w-6 fill-terracotta text-terracotta" strokeWidth={2} />
                  ) : (
                    <Video aria-hidden className="h-7 w-7 text-cream" strokeWidth={1.75} />
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={capturePhoto}
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
              )}
            </div>
            <p className="text-center text-xs text-cream/60">
              {mode === 'clip'
                ? 'Up to 5 seconds. Every clip lands in the couple’s gallery.'
                : 'Every photo lands in the couple’s gallery in real time.'}
            </p>
          </>
        )}

        {/* After a capture: offer to tag who's in it (skippable — untagged
            photos still land in the gallery). */}
        {lastPhotoId && !recording && !busy && (
          <button
            type="button"
            onClick={startTagging}
            className="mx-auto flex w-fit items-center justify-center gap-2 rounded-full border border-cream/25 bg-cream/5 px-4 py-2 text-xs font-medium text-cream transition hover:bg-cream/10"
          >
            <Users aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {tagCount > 0 ? `Tagged ${tagCount} · tag more` : 'Tag who’s in it'}
          </button>
        )}
          </>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
