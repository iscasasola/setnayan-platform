'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Camera, Check, Eye, Images, Loader2, Lock, SwitchCamera, Trash2 } from 'lucide-react';
import { usePapicCamera } from '@/lib/use-papic-camera';
import { newClientCaptureId } from '@/lib/papic-client-capture-id';
import { papicUploader, saveShot } from '@/lib/papic-upload/browser';
import { markShutter, markShutterReady } from '@/lib/papic-upload/shutter-timing';
import { PapicUploadChip } from '@/app/papic/_components/upload-chip';
import { VENDOR_PAPIC_POINTS, type VendorPapicTier,
  VENDOR_PAPIC_VIDEO_MIN_POINTS,
} from '@/lib/vendor-papic-tier';
import { formatCount } from '@/lib/format-number';
import { ActionButton } from '@/components/action-button';
import { PartFoot, PartTop, setTwo } from '@/app/vendor-dashboard/_components/set-two/parts';

// The vendor on-the-day Papic capture controller (owner-locked 2026-07-18).
// A consent gate → the live camera → gesture shutter (tap = photo · press-and-
// hold = ≤10s clip, Ltd/Unli only) → the server-side capture route enforces the
// tier's capture-point budget. Lite is photos-only; Ltd (and an admin-comped
// Unli) allow clips. Kept deliberately simple vs the couple seat surface (no
// face tag, no roll) — the vendor is working, so the shutter stays responsive
// by firing uploads without blocking, and the server budget is the hard gate.
//
// SAVE FIRST, SEND LATER (owner 2026-10-23): every shot is written to this
// phone (the shared `papic` IndexedDB store) at the shutter and sent in pieces,
// straight to storage, by the page's one uploader (lib/papic-upload/) — so a
// dead venue link, or the tab closing, never loses a shot, and the supplier
// never waits on the network to take the next one. The route takes no file
// bytes (Vercel refuses bodies over 4.5 MB; a supplier clip was allowed 25 MB).
// A refusal that waiting can never fix (video not allowed, consent, the day is
// over) rolls back the optimistic spend and says so.
//
// THE NOVEMBER LOOK (supplier pages set two, page 8, owner-approved 21 Nov 2026):
// the consent's four lines are rows, each with its mark (check · eye · trash ·
// lock), and "Agree & open camera" is the one button in the thumb zone; the
// camera is full black with its controls ON the frame — what you shot · the
// shutter · Flip — and the tier and "N left" on the frame too (the separate grey
// meter is gone). Every word, gate and gesture is as it was.

const HOLD_MS = 260; // press longer than this → start recording
const CLIP_MAX_MS = 10000; // 10-SECOND CLIP CAP — owner 2026-07-22 · §0

function pickClipMime(): string {
  const cands = [
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  if (typeof MediaRecorder !== 'undefined') {
    for (const c of cands) if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return 'video/webm';
}

type Props = {
  /** The page's pinned row (round back · "Papic capture" over "Back to the floor") — drawn over the consent; the
   *  camera carries its own back on the frame. */
  pin?: ReactNode;
  /** Where the camera's own back goes, and what it says to a screen reader. */
  backHref: string;
  backLabel: string;
  eventId: string;
  /** This supplier's owner tag at this event (lib/papic-upload/owner-tag.server.ts):
   *  a shot queued here never records as another supplier signed in later. */
  uploadOwner: string | null;
  coupleName: string;
  tier: VendorPapicTier;
  allowVideo: boolean;
  /** null = unlimited (Unli). */
  pointsCap: number | null;
  pointsSpent: number;
};

const TIER_LABEL: Record<VendorPapicTier, string> = {
  lite: 'Papic Lite',
  ltd: 'Papic Ltd',
  unli: 'Papic Unli',
};

export function PapicCaptureController({
  pin,
  backHref,
  backLabel,
  eventId,
  uploadOwner,
  coupleName,
  tier,
  allowVideo,
  pointsCap,
  pointsSpent: initialSpent,
}: Props) {
  const [accepted, setAccepted] = useState(false);
  const [spent, setSpent] = useState(initialSpent);
  const [toast, setToast] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const cam = usePapicCamera({
    enabled: accepted,
    // A camera that comes back never cuts a clip mid-take (a reopen is not a shot).
    holdRestart: recording,
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clipStartRef = useRef<number>(0);

  const unlimited = pointsCap == null;
  const pointsLeft = unlimited ? null : Math.max(0, pointsCap - spent);
  const canPhoto = unlimited || spent + VENDOR_PAPIC_POINTS.photo <= (pointsCap ?? 0);
  const canClip =
    allowVideo && (unlimited || spent + VENDOR_PAPIC_POINTS.clip <= (pointsCap ?? 0));
  const outOfPoints = !unlimited && (pointsLeft ?? 0) <= 0;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 1800);
  }, []);

  // What the uploader hears back, for THIS event's supplier shots. A shot that
  // can never land gives its credits back on the meter and says why.
  // A kept shot is asked again later; its credits come back on the meter ONCE.
  const uncounted = useRef(new Set<string>());
  useEffect(() => {
    return papicUploader().on((e) => {
      if (e.shot.lane !== 'vendor' || e.shot.eventId !== eventId) return;
      const cost = e.shot.media === 'clip' ? VENDOR_PAPIC_POINTS.clip : VENDOR_PAPIC_POINTS.photo;
      if (e.type === 'recorded' && uncounted.current.delete(e.shot.id)) {
        // A kept shot landed after all: it counts again.
        setSpent((s) => s + cost);
        return;
      }
      if (e.type === 'credits') {
        if (pointsCap != null) setSpent(pointsCap);
        flash('You’re out of credits for this event — the shot waits on this phone.');
      } else if (e.type === 'kept') {
        // Kept on this phone, never erased (review 2026-10-23); it is not counted.
        if (uncounted.current.has(e.shot.id)) return;
        uncounted.current.add(e.shot.id);
        setSpent((s) => Math.max(0, s - cost));
        if (e.code === 'video_not_allowed') flash('This tier is photos only — the clip stays on this phone.');
        else if (e.code === 'event_over') flash('Not sent — this event is over. The shot stays on this phone.');
        else flash('Not sent yet — the shot stays on this phone.');
      } else if (e.type === 'refused') {
        if (!uncounted.current.has(e.shot.id)) setSpent((s) => Math.max(0, s - cost));
        uncounted.current.add(e.shot.id);
        flash('Couldn’t save that one.');
      }
    });
  }, [eventId, flash, pointsCap]);

  const grabFrame = useCallback(async (): Promise<Blob | null> => {
    const video = cam.videoRef.current;
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
  }, [cam.videoRef]);

  // The shutter's hand-off: write to this phone, move the meter, free the
  // shutter. Nothing here waits on the network.
  const save = useCallback(
    async (kind: 'photo' | 'clip', blob: Blob, poster?: Blob | null, durationMs?: number) => {
      const cost = kind === 'clip' ? VENDOR_PAPIC_POINTS.clip : VENDOR_PAPIC_POINTS.photo;
      try {
        await saveShot({
          id: newClientCaptureId(),
          lane: 'vendor',
          eventId,
          media: kind,
          capturedAtMs: kind === 'clip' && durationMs ? Date.now() - durationMs : Date.now(),
          durationMs: kind === 'clip' ? Math.min(durationMs ?? 0, CLIP_MAX_MS) : undefined,
          // The consent gate above was passed for this camera (RA 10173).
          consent: true,
          deviceModel: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : undefined,
          primary: blob,
          poster: kind === 'clip' ? poster ?? null : null,
          ownerTag: uploadOwner,
        });
      } catch {
        flash('Couldn’t save that one on this phone — free up some space.');
        return;
      }
      // Optimistic point spend so the meter + gating stay ahead of the network;
      // the server is the hard gate. Sourced from VENDOR_PAPIC_POINTS so it can
      // never drift from the constant the server ledger enforces.
      setSpent((s) => s + cost);
      flash(kind === 'clip' ? 'Clip saved' : 'Photo saved');
    },
    [eventId, flash, uploadOwner],
  );

  // This camera is open: this supplier's shots for this event may send from here.
  useEffect(
    () => papicUploader().register({ lane: 'vendor', eventId, ownerTag: uploadOwner }),
    [eventId, uploadOwner],
  );

  const takePhoto = useCallback(async () => {
    if (!canPhoto) {
      flash(outOfPoints ? 'You’re out of credits for this event.' : 'No credits left.');
      return;
    }
    markShutter();
    const blob = await grabFrame();
    if (blob) await save('photo', blob);
    markShutterReady();
  }, [canPhoto, outOfPoints, grabFrame, save, flash]);

  const stopClip = useCallback(() => {
    if (clipTimer.current) {
      clearTimeout(clipTimer.current);
      clipTimer.current = null;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    recorderRef.current = null;
  }, []);

  const startClip = useCallback(() => {
    const stream = cam.streamRef.current;
    if (!stream || !canClip) return;
    const mime = pickClipMime();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      return;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      const durationMs = clipStartRef.current ? Date.now() - clipStartRef.current : 0;
      const blob = new Blob(chunksRef.current, { type: mime });
      const poster = await grabFrame();
      setRecording(false);
      if (blob.size > 0) void save('clip', blob, poster, durationMs);
    };
    recorderRef.current = recorder;
    recorder.start();
    clipStartRef.current = Date.now();
    setRecording(true);
    clipTimer.current = setTimeout(() => stopClip(), CLIP_MAX_MS);
  }, [cam.streamRef, canClip, grabFrame, save, stopClip]);

  // Gesture shutter: press-and-hold past HOLD_MS → clip (if allowed); a short
  // tap → photo. Mirrors the seat surface's pointer model.
  const onShutterDown = useCallback(() => {
    if (outOfPoints) return;
    if (canClip) {
      holdTimer.current = setTimeout(() => {
        holdTimer.current = null;
        startClip();
      }, HOLD_MS);
    }
  }, [outOfPoints, canClip, startClip]);

  const onShutterUp = useCallback(() => {
    if (holdTimer.current) {
      // Released before the hold threshold → it was a tap → photo.
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      void takePhoto();
      return;
    }
    if (recording) {
      stopClip();
      return;
    }
    // No hold armed (Lite, or video disabled) → tap = photo.
    if (!canClip) void takePhoto();
  }, [recording, canClip, takePhoto, stopClip]);

  // ── Consent gate (RA 10173) — shown before the camera ever mounts ──────────
  if (!accepted) {
    return (
      <>
        {pin}
        <PartTop title="Before you shoot">
          <p>
            You’re capturing guests at <strong>{coupleName}</strong>. By continuing you confirm:
          </p>
        </PartTop>
        <ul className={setTwo.list} data-papic-consent="">
          {CONSENT.map(({ icon: Mark, line }) => (
            <li key={line} className={`${setTwo.row} ${setTwo.rowTop}`}>
              <span aria-hidden className={setTwo.rowIcon}>
                <Mark strokeWidth={1.75} />
              </span>
              <span className={setTwo.rowBody}>
                <span className={setTwo.rowLine}>{line}</span>
              </span>
            </li>
          ))}
        </ul>
        <PartFoot mark="papic-consent" label="Before you shoot">
          <ActionButton
            tone="brand"
            main
            icon={Camera}
            label="Agree & open camera"
            onClick={() => setAccepted(true)}
            className="w-full tab:w-auto"
          />
        </PartFoot>
      </>
    );
  }

  // ── The camera — full black, the controls on the frame ─────────────────────
  return (
    <div className={setTwo.cam} data-papic-camera="">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={cam.videoRef}
        playsInline
        muted
        autoPlay
        className={setTwo.camVideo}
        style={{ transform: cam.mirrored ? 'scaleX(-1)' : undefined }}
      />
      <canvas ref={canvasRef} className="hidden" />

      {!cam.ready && !cam.camError ? (
        <div className={setTwo.camCover}>
          <Loader2 aria-hidden className="animate-spin" strokeWidth={1.75} />
        </div>
      ) : null}
      {cam.camError ? (
        <div className={setTwo.camCover}>Camera unavailable. Allow camera access, then reopen this tool.</div>
      ) : null}

      {/* On the frame, top: back · the tier · what is left. */}
      <div className={setTwo.camTop}>
        <Link href={backHref} aria-label={backLabel} className={setTwo.camRound}>
          <ArrowLeft aria-hidden strokeWidth={1.75} />
        </Link>
        <span className={setTwo.camPill} data-papic-tier={tier}>
          {TIER_LABEL[tier]}
          <small>· {allowVideo ? 'photos + video' : 'photos only'}</small>
        </span>
        <span className={`${setTwo.camPill} ${setTwo.camEnd}`} data-papic-left="">
          {pointsCap == null ? 'Unlimited' : `${formatCount(pointsLeft)} left`}
        </span>
      </div>
      {/* 📡 Save first, send later — the uploader's one line (details in ⓘ). */}
      <div className={setTwo.camChip}>
        <PapicUploadChip surface="bg-black/55 text-white" />
      </div>
      {recording ? (
        <div className={setTwo.camRec}>
          <i aria-hidden className="animate-pulse" /> REC
        </div>
      ) : null}
      {toast ? (
        <div role="status" className={setTwo.camToast}>
          {toast}
        </div>
      ) : null}
      {cam.lensOptions.length > 1 ? (
        <div className={setTwo.camLens}>
          {cam.lensOptions.map((f) => (
            <button key={f} type="button" onClick={() => cam.selectLens(f)} style={{ opacity: cam.lens === f ? 1 : 0.55 }}>
              {f}×
            </button>
          ))}
        </div>
      ) : null}

      {/* On the frame, in the thumb's reach: what you shot · the shutter · Flip camera. */}
      <div className={setTwo.camBottom}>
        <div className={setTwo.camControls}>
          <a href="#what-you-shot" aria-label="What you shot" className={setTwo.camRound}>
            <Images aria-hidden strokeWidth={1.75} />
          </a>
          <button
            type="button"
            aria-label={canClip ? 'Tap for photo, hold for video' : 'Take photo'}
            disabled={outOfPoints || !cam.ready}
            onPointerDown={onShutterDown}
            onPointerUp={onShutterUp}
            onPointerCancel={() => {
              if (holdTimer.current) {
                clearTimeout(holdTimer.current);
                holdTimer.current = null;
              }
              if (recording) stopClip();
            }}
            className={`${setTwo.shutter} ${recording ? setTwo.shutterRec : ''}`}
            data-papic-shutter=""
          >
            <i aria-hidden />
          </button>
          {cam.canFlip ? (
            <button type="button" onClick={cam.flip} disabled={cam.switching} aria-label="Flip camera" className={setTwo.camRound}>
              <SwitchCamera aria-hidden strokeWidth={1.75} />
            </button>
          ) : (
            <span aria-hidden className={setTwo.camSpacer} />
          )}
        </div>
        <p className={setTwo.camHint}>
          {canClip
            ? 'Tap photo · hold for a 10s clip'
            : allowVideo
              ? ''
              : /* ⚠ THE REASON IS THE CREDIT THRESHOLD, NOT THE TIER. This
                   read "Photos only on Papic Lite" until 2026-08-26, when
                   video moved from an always-true tier flag onto the
                   allowance (owner: "800 credits will allow them to take
                   videos"). Left alone it named the wrong tier to a Ltd
                   supplier AND the wrong reason to everyone — a refusal that
                   misdescribes itself sends somebody to fix the wrong thing.
                   The number is DERIVED, never re-typed. */
                `Photos only — video unlocks at ${formatCount(VENDOR_PAPIC_VIDEO_MIN_POINTS)} credits`}
        </p>
      </div>
    </div>
  );
}

/** The four lines the supplier confirms, each with the mark that says what it is about. */
const CONSENT = [
  { icon: Check, line: 'You have the couple’s go-ahead to shoot at this event.' },
  { icon: Eye, line: 'Only candid event moments — no nudity, harassment, or anything a guest hasn’t agreed to.' },
  { icon: Trash2, line: 'Guests can ask you to delete a shot; the always-on filter also removes explicit content.' },
  { icon: Lock, line: 'Your captures stay in your shop’s event photos; location is never stored.' },
] as const;
