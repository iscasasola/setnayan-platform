'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import {
  Camera,
  Loader2,
  Check,
  CircleAlert,
  Video,
  Square,
  PartyPopper,
  Users,
  ScanLine,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  CloudOff,
} from 'lucide-react';
import {
  recordSeatCapture,
  tagSeatCapture,
  autoTagSeatCapture,
} from '@/app/papic/actions';
import { makeQrDetector } from '@/lib/qr-scan';
import {
  PAPIC_STYLES,
  cssPreviewFilter,
  applyPapicStyle,
  type PapicStyle,
} from '@/lib/papic-photo-styles';
import { usePapicCamera } from '@/lib/use-papic-camera';
import type { PapicFaceMode } from '@/lib/papic-face-mode';
import { PapicCameraControls } from '@/app/papic/_components/camera-controls';
import {
  enqueuePapicSeatCapture,
  isPapicTerminalError,
} from '@/lib/offline/service-handlers/papic-drain';
import { triggerSyncNow } from '@/lib/offline/sync-daemon';
import {
  getPapicQualityTier,
  photoJpegQuality,
  clipVideoBitsPerSecond,
  recordUploadSample,
} from '@/lib/papic-adaptive-quality';

// Papic · paparazzo capture (client)
//
// The working web-capture slice for a claimed seat. Rear camera (getUserMedia
// facingMode: environment). PHOTO mode freezes a frame to a canvas → JPEG. CLIP
// mode records up to 5 seconds via MediaRecorder (a HARD client cap — the corpus
// constraint, not configurable), grabs a poster frame, and uploads both.
//
// SHUTTER IS OPTIMISTIC (2026-06-26): the frame is frozen instantly, the count
// bumps, a "Saved" flash fires, and the shot is pushed onto a background upload
// queue — the paparazzo keeps shooting while bytes drain to R2. A serial worker
// presigns via /api/upload → PUTs to R2 → records through recordSeatCapture (RLS
// lets the claimer insert on their own seat). Each shot shows live status in the
// capture roll; a failed upload offers a one-tap retry (venue Wi-Fi is flaky —
// the shutter must never feel like it hung). A seat may carry a per-day capture
// cap (per-camera tiers); pack seats are uncapped.

const CLIP_MAX_MS = 5_000; // 5-second hard cap (corpus constraint · not configurable)
const HOLD_MS = 260; // tap-vs-hold boundary: a press held this long starts a clip
const TAG_CAP = 10; // max tags per photo (corpus hard cap · mirrored server-side)
const ROLL_MAX = 24; // most-recent shots kept in the session roll strip

// Server cap codes — the presign route and recordSeatCapture both signal
// "this seat is out of capture allowance today". Either rolls the optimistic
// count back and marks the shot capped (no retry). Papic v3 collapses the old
// per-kind caps (camera_*/daily_*) into ONE capture-points budget — both seams
// now return camera_points_exhausted; the legacy codes are kept so a stale
// client/server pairing during rollout still renders as capped, not failed.
const CAP_CODES: ReadonlySet<string> = new Set([
  'camera_points_exhausted',
  'camera_photo_cap',
  'camera_video_cap',
  'daily_photo_quota',
  'daily_video_quota',
]);
function isCapCode(code: string | null | undefined): boolean {
  return code != null && CAP_CODES.has(code);
}

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
  /** The event this seat belongs to — tags offline-queued captures so the admin
   *  diagnostic can group a venue's pending uploads by wedding. */
  eventId: string;
  initialPhotos: number;
  initialClips: number;
  /** null = uncapped (pack seat); a number = a per-seat cap to surface in the UI. */
  photoCap?: number | null;
  clipCap?: number | null;
  /** True when the claimer is a Supabase native anonymous user (one-tap claim,
   *  no account yet) — surfaces the opt-in "save to your account" affordance. */
  isAnon?: boolean;
  /** The event-wide look (set once by the couple at Papic setup). LOCKED — the
   *  paparazzo can't change it; it's baked into every photo this seat takes. */
  eventStyle: PapicStyle;
  /** Resolved per-event face-tag mode (One-Pool spec §3.4). mode_b (default) →
   *  the on-device embedder is NEVER called: no face descriptor is computed or
   *  transmitted for this seat's captures. Only mode_a (a consented custom-QR
   *  roster) runs `embedFaces`. Resolved server-side, forced to mode_b for
   *  christening/debut. */
  faceMode: PapicFaceMode;
};

/** A single capture as it moves through the background upload queue. Drives both
 *  the queue worker AND the visible roll strip. The heavy blobs live here (a ref
 *  list), never in React state, so re-renders stay cheap. */
type Shot = {
  id: string;
  kind: 'photo' | 'clip';
  /** Object URL for the thumbnail (the clip's poster frame for clips). */
  thumbUrl: string;
  status: 'uploading' | 'saved' | 'capped' | 'failed' | 'queued';
  photoId: string | null;
  // Upload payload (kept for the worker + retry).
  blob: Blob;
  contentType: string;
  ext: string;
  poster?: Blob | null;
  durationMs?: number;
  /** A CLEAN (un-styled) JPEG of the same frame, used ONLY for on-device face
   *  embedding. The event look would wreck face-api's descriptors, so faces are
   *  read from this, never from the styled delivery blob. */
  faceBlob?: Blob | null;
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

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

export function PapicSeatCapture({
  token,
  seatIndex,
  eventId,
  initialPhotos,
  initialClips,
  photoCap = null,
  clipCap = null,
  isAnon = false,
  eventStyle,
  faceMode,
}: Props) {
  // The event-wide look is LOCKED (couple-set at setup) — baked into every photo.
  // styleRef mirrors the prop so grabFrame reads it without a dep churn.
  const styleRef = useRef<PapicStyle>(eventStyle);
  useEffect(() => {
    styleRef.current = eventStyle;
  }, [eventStyle]);
  const styleMeta = PAPIC_STYLES.find((s) => s.id === eventStyle);

  // Drain any captures that were persisted to the offline queue (a venue WiFi
  // blip, or a prior session that closed before reconnecting). This runs the
  // drain in the FOREGROUND — independent of the global offline-daemon feature
  // flag + Background Sync (which iOS Safari/PWA lacks) — so a paparazzo's
  // queued shots upload the moment connectivity returns while they keep shooting.
  // `triggerSyncNow()` is best-effort + idempotent (IDB transactions serialize,
  // so at-most-once delivery per item) and no-ops when every queue is empty.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const drain = () => {
      void triggerSyncNow();
    };
    drain();
    window.addEventListener('online', drain);
    return () => window.removeEventListener('online', drain);
  }, []);

  // The live camera + its flip / lens controls (shared hook owns the stream).
  const {
    videoRef,
    streamRef,
    ready,
    camError,
    canFlip,
    flip,
    lensOptions,
    lens,
    selectLens,
    mirrored,
    switching,
  } = usePapicCamera({ enabled: true });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clipStartRef = useRef<number>(0);
  // Gesture shutter: a hold-timer distinguishes a TAP (photo) from a HOLD
  // (record). didHoldRef remembers a hold crossed the threshold so the matching
  // release stops the clip instead of also firing a photo.
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHoldRef = useRef(false);
  const capNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous mirror of the recorder lifecycle. The React `recording` state
  // only clears in the async recorder.onstop, so a rapid re-press right after a
  // clip would read a stale `true` and drop the gesture — the ref flips
  // immediately on start/stop, so gesture decisions are never stale.
  const recordingRef = useRef(false);

  const [recording, setRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const [photos, setPhotos] = useState(initialPhotos);
  const [clips, setClips] = useState(initialClips);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Transient "you've used all your photos/clips" feedback when a gesture is
  // blocked by a per-seat cap (uncapped seats → never set).
  const [capNotice, setCapNotice] = useState<'photos' | 'clips' | null>(null);
  // SOFT-STOP (Phase 0c): the event-scoped pass pool warns here BEFORE the hard
  // stop, so a crew shooting a flat-pass event sees the fence coming instead of
  // hitting it cold. Null on every event without a pass (no fence at all).
  const [poolNotice, setPoolNotice] = useState<string | null>(null);

  // ---- capture roll + background upload queue ------------------------------
  // `shots` is the visible roll (newest first). The queue worker drains shots
  // with status 'uploading' one at a time so a burst of taps never floods the
  // network — the shutter stays instant regardless of how far behind uploads are.
  const [shots, setShots] = useState<Shot[]>([]);
  const queueRef = useRef<Shot[]>([]);
  const processingRef = useRef(false);

  // ---- tagging (scan-to-tag) -----------------------------------------------
  // After a shot finishes uploading we know its photo_id, so the paparazzo can
  // scan guest / table QRs to record who's in it. Tagging reuses the SAME live
  // stream (no second getUserMedia — iOS-safe), running a QR decode loop while
  // open. A roll thumbnail can also re-open tagging for that specific shot.
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

  // The camera stream itself is owned by usePapicCamera; here we only tear down
  // the capture-side timers on unmount (the hook stops its own tracks).
  useEffect(() => {
    return () => {
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
      if (recTickRef.current) clearInterval(recTickRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (capNoticeTimerRef.current) clearTimeout(capNoticeTimerRef.current);
    };
  }, []);

  // Free every thumbnail object URL on unmount (the blobs would otherwise leak).
  useEffect(() => {
    return () => {
      queueRef.current = [];
      setShots((prev) => {
        prev.forEach((s) => URL.revokeObjectURL(s.thumbUrl));
        return prev;
      });
    };
  }, []);

  const patchShot = useCallback((id: string, patch: Partial<Shot>) => {
    setShots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  // Presign + PUT a blob to R2; returns the stored r2:// ref (or throws).
  // The server derives the bucket + event/seat-scoped object prefix from the
  // seat token (and verifies the caller is the seat's claimer) — the client
  // never chooses where seat captures land.
  const uploadBlob = useCallback(
    async (blob: Blob, contentType: string, ext: string): Promise<string> => {
      const presignRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          papicSeatToken: token,
          filename: `papic-${Date.now()}.${ext}`,
          contentType,
          sizeBytes: blob.size,
        }),
      });
      if (!presignRes.ok) {
        // The presign route refuses to mint a URL once a per-camera seat is at
        // its per-kind daily cap. Surface that as the SAME cap signal
        // recordSeatCapture returns.
        let code: string | undefined;
        try {
          ({ code } = (await presignRes.json()) as { code?: string });
        } catch {
          // non-JSON body — fall through to the generic presign error
        }
        if (isCapCode(code)) {
          throw new Error(code);
        }
        throw new Error('presign');
      }
      const { uploadUrl, r2Ref } = (await presignRes.json()) as {
        uploadUrl?: string;
        r2Ref?: string;
      };
      if (!uploadUrl || !r2Ref) throw new Error('presign');
      const putStart = Date.now();
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob,
      });
      if (!putRes.ok) throw new Error('put');
      // Feed real throughput into the adaptive-quality estimate so the NEXT
      // capture's encode reacts to how this venue's link actually performs.
      recordUploadSample(blob.size, Date.now() - putStart);
      return r2Ref;
    },
    [token],
  );

  // Grab the current video frame. Returns the DELIVERED JPEG (`blob`) plus a
  // CLEAN one (`clean`) for face embedding.
  //
  // `styled` bakes the locked event look into `blob`. PHOTOS pass true; a CLIP
  // POSTER passes false — the clip body can't be styled in V1 (no video render
  // pipeline), so a clean poster honestly matches the un-styled video. `clean`
  // is always un-styled: face-api would choke on mono/cross-processed pixels, so
  // faces are read from it, never the styled blob. Null if no pixels yet.
  const grabFrame = useCallback(
    async (styled: boolean): Promise<{ blob: Blob; clean: Blob } | null> => {
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
      const clean = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.9),
      );
      if (!clean) return null;
      if (!styled) return { blob: clean, clean };
      // Bake the locked event look into the delivered photo (clean already kept).
      applyPapicStyle(canvas, styleRef.current);
      // Adaptive: the DELIVERY blob shrinks on a weak link; the clean face frame
      // above stays at full fidelity so face descriptors aren't degraded.
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', photoJpegQuality(getPapicQualityTier())),
      );
      return blob ? { blob, clean } : { blob: clean, clean };
    },
    [videoRef],
  );

  const flash = useCallback(() => {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 900);
  }, []);

  // Point the tag flow at a shot (resets the running count + scan debounce).
  const armTagging = useCallback((photoId: string | null) => {
    setLastPhotoId(photoId);
    setTagCount(0);
    setTaggedNames([]);
    setTagNotice(null);
    lastScanRef.current = '';
  }, []);

  // FACE auto-tag (best-effort, fire-and-forget) — runs AFTER the shot records,
  // off the queue worker, so the shutter never waits on it. The phone detects
  // faces + computes their 128-d descriptors on-device (lazy-imported
  // face-api.js) and sends ONLY the vectors to the matcher; the face IMAGE never
  // leaves the device. Dormant until a face model is hosted
  // (NEXT_PUBLIC_FACE_MODEL_URL) — embedFaces then returns [] and this no-ops.
  const autoTagFromBlob = useCallback(
    async (photoId: string, imageBlob: Blob) => {
      // FACE-MODE GATE (One-Pool spec §3.4): in mode_b `embedFaces` is NEVER
      // called — no 128-d descriptor is computed and nothing is transmitted.
      // Only mode_a (a consented custom-QR roster) reaches the embedder.
      if (faceMode !== 'mode_a') return;
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
          const { vectors } = await embedFaces(img);
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
    [token, faceMode],
  );

  // CLIP auto-tag (owner 2026-07-11 "we want multi tagging"): a clip is a moving
  // scene, so instead of embedding only the poster frame we sample a few frames
  // across the video and union the faces — everyone who appears ANYWHERE in the
  // clip is tagged, not just whoever is in the first frame. Same best-effort,
  // fire-and-forget contract as autoTagFromBlob (returns [] and no-ops when no
  // model is hosted or on any decode/seek error → never touches the saved clip).
  const autoTagFromClip = useCallback(
    async (photoId: string, videoBlob: Blob) => {
      // FACE-MODE GATE (One-Pool spec §3.4): mode_b never samples/embeds clip
      // frames — no descriptor is computed or transmitted. Only mode_a runs it.
      if (faceMode !== 'mode_a') return;
      try {
        const { embedClipFaces } = await import('@/lib/face-embed-clip');
        const vectors = await embedClipFaces(videoBlob);
        if (vectors.length > 0) {
          await autoTagSeatCapture(token, photoId, vectors);
        }
      } catch {
        // best-effort — a face-tag miss never affects the saved clip
      }
    },
    [token, faceMode],
  );

  // Roll back the optimistic count when a shot fails for a non-cap reason — the
  // slot is free again (matters for capped seats).
  const rollbackCount = useCallback((kind: 'photo' | 'clip') => {
    if (kind === 'photo') setPhotos((n) => Math.max(0, n - 1));
    else setClips((n) => Math.max(0, n - 1));
  }, []);

  // Upload one shot end-to-end (presign+PUT main blob, optional poster, record).
  const uploadShot = useCallback(
    async (shot: Shot) => {
      // Adaptive: when the link is effectively unusable, skip the doomed live
      // upload and hand the shot straight to the durable offline queue at the
      // (already reduced) encode size — the foreground drain uploads it the
      // moment throughput recovers. Same ownership transfer as the catch path.
      if (getPapicQualityTier() === 'queue_only') {
        const queuedId = await enqueuePapicSeatCapture({
          eventId,
          seatToken: token,
          seatIndex,
          kind: shot.kind,
          contentType: shot.contentType,
          blob: shot.blob,
          durationMs: shot.durationMs,
          reason: 'low_bandwidth',
        });
        if (queuedId) {
          patchShot(shot.id, { status: 'queued' });
          return;
        }
        // Couldn't persist (no IndexedDB) — fall through and try the network.
      }
      try {
        const mainRef = await uploadBlob(shot.blob, shot.contentType, shot.ext);
        let posterRef: string | undefined;
        if (shot.kind === 'clip' && shot.poster) {
          try {
            posterRef = await uploadBlob(shot.poster, 'image/jpeg', 'jpg');
          } catch {
            posterRef = undefined; // poster is best-effort; clip still lands
          }
        }
        const result =
          shot.kind === 'photo'
            ? await recordSeatCapture(token, mainRef, 'photo')
            : await recordSeatCapture(token, mainRef, 'clip', posterRef, shot.durationMs);

        if (!result.ok) {
          if (isCapCode(result.error)) {
            // Cap hit: the optimistic count was right at the edge — pin it to the
            // cap and mark the shot capped (it never lands; no retry).
            if (shot.kind === 'photo') setPhotos(photoCap ?? ((n) => n));
            else setClips(clipCap ?? ((n) => n));
            patchShot(shot.id, { status: 'capped' });
            return;
          }
          if (result.error === 'clip_too_long') {
            setSaveError('Clips are capped at 5 seconds — give it another go.');
            patchShot(shot.id, { status: 'failed' });
            rollbackCount(shot.kind);
            return;
          }
          throw new Error(result.error);
        }

        // Event-pool SOFT-STOP: warn while there's still room, not at the wall.
        // Absent on every non-pass event, so this stays null for them.
        if (result.eventPool?.soft) {
          setPoolNotice(
            `Running low — about ${result.eventPool.remaining.toLocaleString()} shots left for this event.`,
          );
        } else if (result.eventPool) {
          setPoolNotice(null);
        }
        patchShot(shot.id, { status: 'saved', photoId: result.photoId });
        // Arm the inline "tag who's in it" affordance on the freshest saved shot.
        armTagging(result.photoId);
        if (result.photoId) {
          // Clips → multi-FRAME tag across the whole video (everyone who appears
          // anywhere, not just the poster). Photos → single-frame embed from the
          // CLEAN blob (never the styled delivery blob). A clip with no video blob
          // (unexpected) falls back to the poster via the single-frame path.
          if (shot.kind === 'clip' && shot.blob) {
            void autoTagFromClip(result.photoId, shot.blob);
          } else {
            const faceSource =
              shot.faceBlob ?? (shot.kind === 'clip' ? shot.poster : shot.blob);
            if (faceSource) void autoTagFromBlob(result.photoId, faceSource);
          }
        }
        setSaveError(null);
      } catch (err) {
        if (err instanceof Error && isCapCode(err.message)) {
          if (shot.kind === 'photo') setPhotos(photoCap ?? ((n) => n));
          else setClips(clipCap ?? ((n) => n));
          patchShot(shot.id, { status: 'capped' });
          return;
        }
        const code = err instanceof Error ? err.message : '';
        const failManualRetry = () => {
          patchShot(shot.id, { status: 'failed' });
          rollbackCount(shot.kind);
          setSaveError(
            shot.kind === 'clip'
              ? "A clip didn't upload — tap it in the roll to retry."
              : "A shot didn't upload — tap it in the roll to retry.",
          );
        };
        // A terminal server rejection (revoked seat, window closed, …) can never
        // succeed on retry — surface it and roll the optimistic count back.
        if (isPapicTerminalError(code)) {
          failManualRetry();
          return;
        }
        // Infrastructure failure (presign / PUT / network). Hand the shot off to
        // the durable offline queue so it survives a reconnect — or the
        // paparazzo closing the tab — and the sync daemon drains it on reconnect.
        // OWNERSHIP TRANSFERS to the queue: keep the optimistic count (the shot
        // WILL land) and mark it 'queued' so the manual-retry path (which only
        // re-fires 'failed' shots) can't double-deliver the same capture.
        const queuedId = await enqueuePapicSeatCapture({
          eventId,
          seatToken: token,
          seatIndex,
          kind: shot.kind,
          contentType: shot.contentType,
          blob: shot.blob,
          durationMs: shot.durationMs,
          reason: code || 'network',
        });
        if (queuedId) {
          patchShot(shot.id, { status: 'queued' });
          setSaveError(
            shot.kind === 'clip'
              ? "A clip will finish uploading once you're back online."
              : "A shot will finish uploading once you're back online.",
          );
        } else {
          // No durable storage (e.g. private-mode IndexedDB) — fall back to the
          // in-memory "tap to retry" path so the bytes aren't lost this session.
          failManualRetry();
        }
      }
    },
    [
      uploadBlob,
      token,
      eventId,
      seatIndex,
      photoCap,
      clipCap,
      patchShot,
      armTagging,
      autoTagFromBlob,
      autoTagFromClip,
      rollbackCount,
    ],
  );

  // Serial queue worker — drains 'uploading' shots one at a time. Re-entrant-safe
  // via processingRef so multiple enqueues coalesce into one drain loop.
  const drainQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const next = queueRef.current.shift();
        if (next) await uploadShot(next);
      }
    } finally {
      processingRef.current = false;
    }
  }, [uploadShot]);

  // Push a freshly-captured shot onto the roll + the upload queue. The count is
  // bumped OPTIMISTICALLY here so a per-seat cap self-enforces on the
  // very next tap without waiting for the server round-trip.
  const enqueueShot = useCallback(
    (shot: Shot) => {
      if (shot.kind === 'photo') setPhotos((n) => n + 1);
      else setClips((n) => n + 1);
      flash();
      setShots((prev) => {
        const next = [shot, ...prev];
        // Cap the visible roll; revoke the URL of anything we drop.
        if (next.length > ROLL_MAX) {
          next.slice(ROLL_MAX).forEach((s) => URL.revokeObjectURL(s.thumbUrl));
        }
        return next.slice(0, ROLL_MAX);
      });
      queueRef.current.push(shot);
      void drainQueue();
    },
    [flash, drainQueue],
  );

  // Retry a failed shot from the roll (venue Wi-Fi recovers — the bytes are
  // still in memory). Re-bumps the optimistic count and re-queues.
  const retryShot = useCallback(
    (id: string) => {
      setShots((prev) => {
        const shot = prev.find((s) => s.id === id);
        if (!shot || shot.status !== 'failed') return prev;
        if (shot.kind === 'photo') setPhotos((n) => n + 1);
        else setClips((n) => n + 1);
        const requeued: Shot = { ...shot, status: 'uploading' };
        queueRef.current.push(requeued);
        void drainQueue();
        return prev.map((s) => (s.id === id ? requeued : s));
      });
      setSaveError(null);
    },
    [drainQueue],
  );

  const capturePhoto = useCallback(async () => {
    if (recordingRef.current || !ready || switching || photoFull) return;
    setSaveError(null);
    const grabbed = await grabFrame(true); // photo → styled with the event look
    if (!grabbed) {
      setSaveError('Could not grab that frame — try again.');
      return;
    }
    const { blob, clean } = grabbed;
    // Optimistic: the shutter is already free; the queue does the network work.
    enqueueShot({
      id: newId(),
      kind: 'photo',
      thumbUrl: URL.createObjectURL(blob),
      status: 'uploading',
      photoId: null,
      blob,
      contentType: 'image/jpeg',
      ext: 'jpg',
      faceBlob: clean,
    });
  }, [ready, switching, photoFull, grabFrame, enqueueShot]);

  const stopClip = useCallback(() => {
    // Flip the synchronous flag the instant we ask the recorder to stop, so a
    // re-press in the window before onstop fires isn't blocked by a stale flag.
    recordingRef.current = false;
    if (clipTimerRef.current) {
      clearTimeout(clipTimerRef.current);
      clipTimerRef.current = null;
    }
    if (recTickRef.current) {
      clearInterval(recTickRef.current);
      recTickRef.current = null;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }, []);

  const startClip = useCallback(() => {
    if (recordingRef.current || !ready || switching || clipFull) return;
    const stream = streamRef.current;
    if (!stream || stream.getVideoTracks().length === 0) return;
    setSaveError(null);

    const mime = pickClipMime();
    let recorder: MediaRecorder;
    try {
      // Record the live session stream directly (video + audio if the mic was
      // granted at startup) — no second getUserMedia, so iOS never drops the
      // camera mid-clip.
      const clipBitrate = clipVideoBitsPerSecond(getPapicQualityTier());
      recorder = new MediaRecorder(
        stream,
        clipBitrate ? { mimeType: mime, videoBitsPerSecond: clipBitrate } : { mimeType: mime },
      );
    } catch {
      setSaveError('Clips aren’t supported on this browser — photos still work.');
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      recordingRef.current = false;
      setRecording(false);
      setRecElapsed(0);
      const durationMs = clipStartRef.current ? Date.now() - clipStartRef.current : 0;
      const blob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];
      if (blob.size === 0) {
        // A sub-frame hold produced no data — tell the paparazzo rather than
        // silently doing nothing (parity with the guest camera).
        setSaveError('That clip came back empty — hold a little longer.');
        return;
      }
      const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
      // Clip poster stays CLEAN (styled=false) — an honest match to the
      // un-styled video body; faces embed from the same clean frame.
      const grabbed = await grabFrame(false);
      const poster = grabbed?.blob ?? null;
      enqueueShot({
        id: newId(),
        kind: 'clip',
        thumbUrl: poster ? URL.createObjectURL(poster) : '',
        status: 'uploading',
        photoId: null,
        blob,
        contentType: mime,
        ext,
        poster,
        faceBlob: grabbed?.clean ?? null,
        durationMs,
      });
    };
    recorderRef.current = recorder;
    clipStartRef.current = Date.now();
    recorder.start();
    recordingRef.current = true;
    setRecording(true);
    setRecElapsed(0);
    // Live 5-second countdown — drives the progress bar + ring + numeric readout.
    recTickRef.current = setInterval(() => {
      const elapsed = Date.now() - clipStartRef.current;
      setRecElapsed(Math.min(elapsed, CLIP_MAX_MS));
    }, 100);
    // Hard 5-second cap — auto-stop. Not configurable (corpus constraint).
    clipTimerRef.current = setTimeout(stopClip, CLIP_MAX_MS);
  }, [ready, switching, clipFull, grabFrame, enqueueShot, stopClip, streamRef]);

  // Flash a transient "you've used your photos/clips" notice (per-seat caps).
  const flashCapNotice = useCallback((kind: 'photos' | 'clips') => {
    setCapNotice(kind);
    if (capNoticeTimerRef.current) clearTimeout(capNoticeTimerRef.current);
    capNoticeTimerRef.current = setTimeout(() => setCapNotice(null), 1800);
  }, []);

  // ---- gesture shutter -----------------------------------------------------
  // TAP = photo, HOLD = record (release / 5s cap stops it). One button, no mode
  // toggle — the muscle-memory camera gesture. pointerdown arms a hold timer;
  // a release before HOLD_MS is a tap (photo), a release after is a clip stop.
  const onShutterDown = useCallback(
    (e: RPointerEvent<HTMLButtonElement>) => {
      if (recordingRef.current || !ready || switching) return;
      // Capture the pointer so the matching up/cancel always lands on THIS button
      // even if the finger drifts off — robust taps + no stranded recording.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* unsupported — degrade to plain pointerup */
      }
      didHoldRef.current = false;
      if (!clipsAllowed) return; // photo-only seat → the tap fires on pointerup
      holdTimerRef.current = setTimeout(() => {
        holdTimerRef.current = null;
        didHoldRef.current = true;
        if (clipFull) {
          flashCapNotice('clips');
          return;
        }
        if (typeof navigator !== 'undefined') navigator.vibrate?.(40);
        startClip();
      }, HOLD_MS);
    },
    [ready, switching, clipsAllowed, clipFull, startClip, flashCapNotice],
  );

  const onShutterUp = useCallback(
    (e: RPointerEvent<HTMLButtonElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* wasn't captured */
      }
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (didHoldRef.current) {
        // The press was a hold — stop the clip (no-op if the 5s cap already did).
        didHoldRef.current = false;
        stopClip();
        return;
      }
      // The press was a tap — take a photo (or surface the per-seat photo cap).
      if (photoFull) {
        flashCapNotice('photos');
        return;
      }
      void capturePhoto();
    },
    [photoFull, capturePhoto, stopClip, flashCapNotice],
  );

  // System interruption (call, notification) mid-press — stop a running clip,
  // never fire a photo.
  const onShutterCancel = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (didHoldRef.current) {
      didHoldRef.current = false;
      stopClip();
    }
  }, [stopClip]);

  // ---- tagging -------------------------------------------------------------

  const startTagging = useCallback(
    (photoId?: string) => {
      const target = photoId ?? lastPhotoId;
      if (!target) return;
      if (photoId) armTagging(photoId);
      else {
        lastScanRef.current = '';
        tagBusyRef.current = false;
        setTagNotice(null);
      }
      setTagging(true);
    },
    [lastPhotoId, armTagging],
  );

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
        // next tick. Deterministic outcomes stay debounced.
        if (result.error === 'tag_failed') lastScanRef.current = '';
        return;
      }
      if (typeof navigator !== 'undefined') navigator.vibrate?.(60);
      setTagCount(result.tagCount);
      if (result.added > 0) {
        setTaggedNames((prev) => Array.from(new Set([...prev, ...result.names])));
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
  // stream. Serial (awaits each decode) + debounced on the raw payload so a code
  // held under the lens fires once, not every frame.
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
  }, [tagging, handleScan, videoRef]);

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

  // One gesture shutter, so "all used up" means BOTH kinds are exhausted (a
  // photo-only seat just needs photos gone). Paid seats are uncapped → never full.
  const allFull = photoFull && (clipFull || !clipsAllowed);

  const countLabel = capped
    ? `${photos}/${photoCap} ${photos === 1 ? 'photo' : 'photos'}${
        clipsAllowed ? ` · ${clips}/${clipCap} ${clips === 1 ? 'clip' : 'clips'}` : ''
      }`
    : `${photos + clips} ${photos + clips === 1 ? 'shot' : 'shots'}`;

  // Countdown ring geometry (a 4.5rem button → r≈30 stroke ring around it).
  const RING_C = 2 * Math.PI * 32;
  const recFrac = Math.min(recElapsed / CLIP_MAX_MS, 1);
  const recSecondsLeft = Math.max(0, Math.ceil((CLIP_MAX_MS - recElapsed) / 1000));
  const uploadingCount = shots.filter((s) => s.status === 'uploading').length;

  return (
    <main className="flex min-h-screen flex-col bg-ink text-cream">
      <header className="flex items-center justify-between px-4 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cream/70">
          Papic · seat {seatIndex}
        </p>
        <div className="flex items-center gap-2">
          {styleMeta && styleMeta.id !== 'ORIG' ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-cream/10 px-2.5 py-1 text-xs font-medium text-cream/90"
              title={`Event look: ${styleMeta.blurb} — set by the couple`}
            >
              <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
              {styleMeta.label}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 text-xs font-medium text-cream">
            <Camera aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {countLabel}
          </span>
        </div>
      </header>

      {/* Opt-in account sync (anonymous claimers only). One-tap claim stays
          frictionless; this is the calm "keep these" nudge — /signup attaches an
          email to the SAME anon uid, so the seat + every capture carry over. */}
      {isAnon && (
        <Link
          href={`/signup?next=${encodeURIComponent(`/papic/seat/${token}`)}`}
          className="mx-4 mb-1 flex items-center gap-2 rounded-lg border border-champagne-gold/40 bg-champagne-gold/10 px-3 py-2 text-xs text-cream/85 transition hover:bg-champagne-gold/15"
        >
          <ShieldCheck aria-hidden className="h-4 w-4 shrink-0 text-champagne-gold" strokeWidth={1.9} />
          <span className="min-w-0 flex-1">
            <span className="font-medium text-cream">Shooting as a guest.</span>{' '}
            Save these to your Setnayan account to find them later.
          </span>
          <span className="shrink-0 rounded-full bg-cream/15 px-2.5 py-1 font-medium text-cream">
            Save
          </span>
        </Link>
      )}

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
          /* Live preview of the locked event look. CSS filter is presentation-
             only — it doesn't touch the pixels grabFrame reads or the QR decode
             loop, so the captured photo stays the exact engine output. */
          style={{
            transform: mirrored ? 'scaleX(-1)' : undefined,
            filter: cssPreviewFilter(eventStyle),
          }}
        />
        {(!ready || switching) && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/80">
            <Loader2 aria-hidden className="h-6 w-6 animate-spin text-cream/70" strokeWidth={2} />
          </div>
        )}
        {/* Flip + lens controls (hidden while recording / tagging keep the stage
            clean; the hook gates each control to what the device actually offers). */}
        {ready && !tagging && !recording && (
          <PapicCameraControls
            canFlip={canFlip}
            onFlip={flip}
            lensOptions={lensOptions}
            lens={lens}
            onSelectLens={selectLens}
            disabled={switching}
          />
        )}
        {recording && (
          <>
            <div className="absolute left-1/2 top-4 -translate-x-1/2">
              <span className="inline-flex items-center gap-2 rounded-full bg-ink/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-cream">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-terracotta" />
                Rec · {recSecondsLeft}s
              </span>
            </div>
            {/* 5-second countdown as a draining bottom progress bar. */}
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-cream/20">
              <div
                className="h-full bg-terracotta transition-[width] duration-100 ease-linear"
                style={{ width: `${Math.round(recFrac * 100)}%` }}
              />
            </div>
          </>
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

      {/* Capture roll — what you've shot this session, newest first. A spinner
          rides each upload; a tap retries a failed one or re-opens tagging on a
          saved one. Hidden during recording / tagging to keep the stage clean. */}
      {shots.length > 0 && !tagging && !recording && (
        <div className="px-4 pt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-cream/55">
              Your shots
            </p>
            {uploadingCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-cream/55">
                <Loader2 aria-hidden className="h-3 w-3 animate-spin" strokeWidth={2} />
                Uploading {uploadingCount}
              </span>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {shots.map((shot) => (
              <button
                key={shot.id}
                type="button"
                onClick={() => {
                  if (shot.status === 'failed') retryShot(shot.id);
                  else if (shot.status === 'saved' && shot.photoId) startTagging(shot.photoId);
                }}
                disabled={
                  shot.status === 'uploading' ||
                  shot.status === 'capped' ||
                  shot.status === 'queued'
                }
                aria-label={
                  shot.status === 'failed'
                    ? 'Retry upload'
                    : shot.status === 'queued'
                      ? 'Waiting to upload when back online'
                      : shot.status === 'saved'
                        ? 'Tag who’s in this shot'
                        : shot.kind === 'clip'
                          ? 'Clip'
                          : 'Photo'
                }
                className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-cream/15 bg-cream/5"
              >
                {shot.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shot.thumbUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Video aria-hidden className="absolute inset-0 m-auto h-5 w-5 text-cream/50" strokeWidth={1.75} />
                )}
                {shot.kind === 'clip' && shot.thumbUrl && (
                  <Play aria-hidden className="absolute right-1 top-1 h-3.5 w-3.5 fill-cream/90 text-cream/90" strokeWidth={2} />
                )}
                {shot.status === 'uploading' && (
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/45">
                    <Loader2 aria-hidden className="h-4 w-4 animate-spin text-cream" strokeWidth={2} />
                  </span>
                )}
                {shot.status === 'failed' && (
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/55">
                    <RotateCcw aria-hidden className="h-4 w-4 text-cream" strokeWidth={2} />
                  </span>
                )}
                {shot.status === 'queued' && (
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/55">
                    <CloudOff aria-hidden className="h-4 w-4 text-cream" strokeWidth={2} />
                  </span>
                )}
                {shot.status === 'saved' && (
                  <span className="absolute bottom-1 right-1 rounded-full bg-ink/70 p-0.5">
                    <Check aria-hidden className="h-3 w-3 text-cream" strokeWidth={2.5} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

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
            {saveError && (
              <p className="text-center text-xs text-cream/80">{saveError}</p>
            )}
            {capNotice && !saveError && (
              <p className="text-center text-xs text-cream/80">
                {capNotice === 'photos'
                  ? 'That’s all your free photos — every one’s in the gallery.'
                  : 'That’s all your free clips — every one’s in the gallery.'}
              </p>
            )}
            {poolNotice && !saveError && !capNotice && (
              <p className="text-center text-xs text-cream/80">{poolNotice}</p>
            )}

            {allFull ? (
              <div className="mx-auto max-w-sm text-center">
                <PartyPopper aria-hidden className="mx-auto h-6 w-6 text-terracotta" strokeWidth={1.75} />
                <p className="mt-2 text-sm font-medium text-cream">
                  That&rsquo;s everything you can shoot — every photo and clip is in
                  the couple&rsquo;s gallery.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center">
                  <div className="relative h-[4.5rem] w-[4.5rem]">
                    {/* Draining countdown ring around the shutter while recording. */}
                    {recording && (
                      <svg
                        aria-hidden
                        viewBox="0 0 72 72"
                        className="pointer-events-none absolute inset-0 -rotate-90"
                      >
                        <circle cx="36" cy="36" r="32" fill="none" stroke="rgba(245,240,232,0.18)" strokeWidth="4" />
                        <circle
                          cx="36"
                          cy="36"
                          r="32"
                          fill="none"
                          stroke="var(--m-terracotta, #c4674f)"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={RING_C}
                          strokeDashoffset={RING_C * recFrac}
                          style={{ transition: 'stroke-dashoffset 100ms linear' }}
                        />
                      </svg>
                    )}
                    {/* THE gesture shutter: tap = photo, press-and-hold = record.
                        Pointer events (not onClick) drive the hold detection; the
                        guards kill iOS long-press selection / the context menu so a
                        hold reliably records instead of selecting the button. */}
                    <button
                      type="button"
                      onPointerDown={onShutterDown}
                      onPointerUp={onShutterUp}
                      onPointerCancel={onShutterCancel}
                      onContextMenu={(e) => e.preventDefault()}
                      disabled={!ready || switching}
                      aria-label={
                        recording
                          ? 'Recording — release to stop'
                          : clipsAllowed
                            ? 'Tap to take a photo, or press and hold to record a clip'
                            : 'Tap to take a photo'
                      }
                      className="flex h-full w-full items-center justify-center rounded-full border-4 border-cream/80 bg-cream/10 transition active:scale-95 disabled:opacity-50"
                      style={{
                        touchAction: 'manipulation',
                        WebkitUserSelect: 'none',
                        userSelect: 'none',
                        WebkitTouchCallout: 'none',
                      }}
                    >
                      {recording ? (
                        <Square aria-hidden className="h-6 w-6 fill-terracotta text-terracotta" strokeWidth={2} />
                      ) : (
                        <Camera aria-hidden className="h-7 w-7 text-cream" strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Keyboard / assistive-tech path — the press gesture is pointer-
                    only, so expose the two actions as discrete (visually hidden)
                    controls. */}
                <div className="sr-only">
                  <button type="button" onClick={() => (photoFull ? flashCapNotice('photos') : void capturePhoto())}>
                    Take a photo
                  </button>
                  {clipsAllowed && (
                    <button
                      type="button"
                      onClick={() =>
                        recording ? stopClip() : clipFull ? flashCapNotice('clips') : startClip()
                      }
                    >
                      {recording ? 'Stop recording' : 'Record a 5-second clip'}
                    </button>
                  )}
                </div>

                <p className="text-center text-xs text-cream/60">
                  {recording
                    ? 'Recording… release to stop.'
                    : clipsAllowed
                      ? 'Tap for a photo · press and hold to record (up to 5s).'
                      : 'Tap to take a photo. Every shot lands in the couple’s gallery.'}
                </p>
              </>
            )}

            {/* After a capture: offer to tag who's in the latest saved shot
                (skippable — untagged photos still land in the gallery). */}
            {lastPhotoId && !recording && (
              <button
                type="button"
                onClick={() => startTagging()}
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
