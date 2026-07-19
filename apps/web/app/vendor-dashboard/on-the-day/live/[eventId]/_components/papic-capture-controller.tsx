'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CloudOff, Loader2, RefreshCw, ShieldCheck, Video } from 'lucide-react';
import { usePapicCamera } from '@/lib/use-papic-camera';
import {
  countPapicVendorQueued,
  enqueuePapicVendorCapture,
  isPapicVendorTerminalError,
} from '@/lib/offline/service-handlers/papic-vendor-drain';
import { triggerSyncNow } from '@/lib/offline/sync-daemon';
import type { VendorPapicTier } from '@/lib/vendor-papic-tier';

// The vendor on-the-day Papic capture controller (owner-locked 2026-07-18).
// A consent gate → the live camera → gesture shutter (tap = photo · press-and-
// hold = ≤5s clip, Ltd/Unli only) → the server-side capture route enforces the
// tier's capture-point budget. Lite is photos-only; Ltd (and an admin-comped
// Unli) allow clips. Kept deliberately simple vs the couple seat surface (no
// face tag, no roll) — the vendor is working, so the shutter stays responsive
// by firing uploads without blocking, and the server budget is the hard gate.
//
// DURABLE offline queue (recon vendor-papic#offline): weak-signal venues are
// the norm, so an upload that fails on INFRASTRUCTURE (network / 5xx) hands the
// capture to the shared `papic` IndexedDB queue (mode:'vendor' — see
// papic-vendor-drain.ts) instead of losing it with the tab. The foreground
// drain below re-POSTs queued items on mount + connectivity regain; a queued
// item is deleted only after the capture route confirms the land. A TERMINAL
// server rejection (out_of_points / video_not_allowed / …) is never queued —
// retrying it can't succeed — so those keep the live rollback + toast.

const HOLD_MS = 260; // press longer than this → start recording
const CLIP_MAX_MS = 5000; // 5-SECOND HARD CAP — corpus lock

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
  eventId: string;
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
  eventId,
  coupleName,
  tier,
  allowVideo,
  pointsCap,
  pointsSpent: initialSpent,
}: Props) {
  const [accepted, setAccepted] = useState(false);
  const [spent, setSpent] = useState(initialSpent);
  const [inFlight, setInFlight] = useState(0);
  const [queuedCount, setQueuedCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const cam = usePapicCamera({ enabled: accepted });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clipStartRef = useRef<number>(0);

  const unlimited = pointsCap == null;
  const pointsLeft = unlimited ? null : Math.max(0, pointsCap - spent);
  const canPhoto = unlimited || spent + 1 <= (pointsCap ?? 0);
  const canClip = allowVideo && (unlimited || spent + 3 <= (pointsCap ?? 0));
  const outOfPoints = !unlimited && (pointsLeft ?? 0) <= 0;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 1800);
  }, []);

  const refreshQueued = useCallback(async () => {
    setQueuedCount(await countPapicVendorQueued(eventId));
  }, [eventId]);

  // Drain any captures persisted to the offline queue (a venue signal drop, or
  // a prior session that closed before reconnecting). Runs in the FOREGROUND —
  // independent of the global offline-daemon flag + Background Sync (which iOS
  // Safari/PWA lacks) — so queued shots upload the moment connectivity returns
  // while the vendor keeps shooting. `triggerSyncNow()` is best-effort +
  // idempotent (IDB transactions serialize, so at-most-once delivery per item)
  // and no-ops when every queue is empty. Mirrors the couple seat surface.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const drain = () => {
      void (async () => {
        await triggerSyncNow();
        if (!cancelled) await refreshQueued();
      })();
    };
    drain();
    window.addEventListener('online', drain);
    return () => {
      cancelled = true;
      window.removeEventListener('online', drain);
    };
  }, [refreshQueued]);

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

  const upload = useCallback(
    async (
      kind: 'photo' | 'clip',
      blob: Blob,
      poster?: Blob | null,
      durationMs?: number,
    ) => {
      setInFlight((n) => n + 1);
      // Optimistic point spend so the meter + gating stay ahead of the network;
      // the server is the hard gate and reconciles on its response.
      const cost = kind === 'clip' ? 3 : 1;
      setSpent((s) => s + cost);
      // Hand a capture that failed on INFRASTRUCTURE to the durable offline
      // queue (IndexedDB — survives a tab death). On success OWNERSHIP
      // TRANSFERS to the queue: keep the optimistic spend (the shot WILL land
      // when the drain replays it) — mirrors the couple seat surface. Returns
      // false when persistence isn't available (private mode) or the per-event
      // backlog cap is hit, so the caller keeps the live rollback + toast.
      const queueForLater = async (reason: string): Promise<boolean> => {
        const queuedId = await enqueuePapicVendorCapture({
          eventId,
          mediaType: kind,
          contentType: blob.type || (kind === 'clip' ? 'video/mp4' : 'image/jpeg'),
          filename: kind === 'clip' ? 'clip.mp4' : 'photo.jpg',
          blob,
          posterBlob: kind === 'clip' ? poster ?? null : null,
          posterFilename: 'poster.jpg',
          durationMs:
            kind === 'clip' ? Math.min(durationMs ?? 0, CLIP_MAX_MS) : undefined,
          deviceModel:
            typeof navigator !== 'undefined'
              ? navigator.userAgent.slice(0, 120)
              : undefined,
          reason,
        });
        if (!queuedId) return false;
        void refreshQueued();
        flash(
          kind === 'clip'
            ? 'Clip saved — uploads when signal returns.'
            : 'Photo saved — uploads when signal returns.',
        );
        return true;
      };
      try {
        const fd = new FormData();
        fd.set('event_id', eventId);
        fd.set('media_type', kind);
        fd.set('consent', '1');
        fd.set('file', blob, kind === 'clip' ? 'clip.mp4' : 'photo.jpg');
        if (kind === 'clip') {
          fd.set('duration_ms', String(Math.min(durationMs ?? 0, CLIP_MAX_MS)));
          if (poster) fd.set('poster', poster, 'poster.jpg');
        }
        if (typeof navigator !== 'undefined') {
          fd.set('device_model', navigator.userAgent.slice(0, 120));
        }
        const res = await fetch('/api/vendor/papic-capture', {
          method: 'POST',
          body: fd,
        });
        const json = (await res.json().catch(() => ({}))) as {
          status?: string;
          error?: string;
          pointsSpent?: number;
        };
        if (res.ok && json.status === 'ok') {
          flash(kind === 'clip' ? 'Clip saved' : 'Photo saved');
        } else if (isPapicVendorTerminalError(json.error)) {
          // TERMINAL server rejection — retrying can never succeed, so it is
          // never queued. Roll back the optimistic spend; reflect server truth.
          setSpent((s) => Math.max(0, s - cost));
          if (json.error === 'out_of_points') {
            if (typeof json.pointsSpent === 'number' && pointsCap != null) {
              setSpent(pointsCap);
            }
            flash('You’re out of shots for this event.');
          } else if (json.error === 'video_not_allowed') {
            flash('Papic Lite is photos only.');
          } else if (json.error === 'consent_required') {
            flash('Consent is required before capturing.');
          } else {
            flash('Couldn’t save that one — try again.');
          }
        } else {
          // Transient infrastructure failure (5xx / uploads unavailable /
          // signed-out) — durable-queue it so a tab death can't lose it.
          if (!(await queueForLater(json.error ?? `http_${res.status}`))) {
            setSpent((s) => Math.max(0, s - cost));
            flash('Couldn’t save that one — try again.');
          }
        }
      } catch {
        // Network failure — the classic weak-signal-venue case.
        if (!(await queueForLater('network'))) {
          setSpent((s) => Math.max(0, s - cost));
          flash('Upload failed — check your signal.');
        }
      } finally {
        setInFlight((n) => Math.max(0, n - 1));
      }
    },
    [eventId, flash, pointsCap, refreshQueued],
  );

  const takePhoto = useCallback(async () => {
    if (!canPhoto) {
      flash(outOfPoints ? 'You’re out of shots for this event.' : 'No points left.');
      return;
    }
    const blob = await grabFrame();
    if (blob) void upload('photo', blob);
  }, [canPhoto, outOfPoints, grabFrame, upload, flash]);

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
      if (blob.size > 0) void upload('clip', blob, poster, durationMs);
    };
    recorderRef.current = recorder;
    recorder.start();
    clipStartRef.current = Date.now();
    setRecording(true);
    clipTimer.current = setTimeout(() => stopClip(), CLIP_MAX_MS);
  }, [cam.streamRef, canClip, grabFrame, upload, stopClip]);

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
      <div className="mx-auto max-w-md space-y-5 py-6">
        <div className="flex items-center gap-2">
          <ShieldCheck aria-hidden className="h-5 w-5" style={{ color: 'var(--m-orange-2)' }} strokeWidth={1.75} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--m-ink)' }}>
            Before you shoot
          </h1>
        </div>
        <div className="sn-tile space-y-3 text-sm" style={{ color: 'var(--m-slate-2)' }}>
          <p>
            You’re capturing guests at <strong>{coupleName}</strong>. By continuing you confirm:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>You have the couple’s go-ahead to shoot at this event.</li>
            <li>Only candid event moments — no nudity, harassment, or anything a guest hasn’t agreed to.</li>
            <li>Guests can ask you to delete a shot; the always-on filter also removes explicit content.</li>
            <li>Your captures stay in your vendor gallery for this event; location is never stored.</li>
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setAccepted(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white"
          style={{ background: 'var(--m-ink)' }}
        >
          <Camera aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Agree & open camera
        </button>
      </div>
    );
  }

  // ── The camera ─────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-md space-y-4 py-4">
      <TierMeter
        tier={tier}
        pointsLeft={pointsLeft}
        pointsCap={pointsCap}
        spent={spent}
        allowVideo={allowVideo}
      />

      <div className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: '3 / 4' }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={cam.videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
          style={{ transform: cam.mirrored ? 'scaleX(-1)' : undefined }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {!cam.ready && !cam.camError ? (
          <div className="absolute inset-0 grid place-items-center text-white/80">
            <Loader2 aria-hidden className="h-6 w-6 animate-spin" strokeWidth={1.75} />
          </div>
        ) : null}
        {cam.camError ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/85">
            Camera unavailable. Allow camera access, then reopen this tool.
          </div>
        ) : null}
        {recording ? (
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-[11px] font-semibold text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> REC
          </div>
        ) : null}
        {inFlight > 0 || queuedCount > 0 ? (
          <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
            {inFlight > 0 ? (
              <div className="flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white">
                <Loader2 aria-hidden className="h-3 w-3 animate-spin" strokeWidth={2} /> Saving {inFlight}
              </div>
            ) : null}
            {queuedCount > 0 ? (
              <div className="flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white">
                <CloudOff aria-hidden className="h-3 w-3" strokeWidth={2} /> {queuedCount} waiting for signal
              </div>
            ) : null}
          </div>
        ) : null}
        {toast ? (
          <div className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-black/65 px-3 py-1.5 text-xs font-medium text-white">
            {toast}
          </div>
        ) : null}

        {/* Camera controls */}
        <div className="absolute right-3 bottom-24 flex flex-col gap-2">
          {cam.canFlip ? (
            <button
              type="button"
              onClick={cam.flip}
              disabled={cam.switching}
              aria-label="Flip camera"
              className="grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur"
            >
              <RefreshCw aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </button>
          ) : null}
          {cam.lensOptions.length > 1 ? (
            <div className="flex flex-col overflow-hidden rounded-full bg-black/45 text-white backdrop-blur">
              {cam.lensOptions.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => cam.selectLens(f)}
                  className="px-2.5 py-1.5 text-xs font-semibold"
                  style={{ opacity: cam.lens === f ? 1 : 0.55 }}
                >
                  {f}×
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Shutter */}
        <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-1">
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
            className="grid h-16 w-16 place-items-center rounded-full border-4 border-white disabled:opacity-40"
            style={{
              background: recording ? '#dc2626' : 'rgba(255,255,255,0.25)',
              touchAction: 'manipulation',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
            }}
          >
            <span
              className="rounded-full bg-white transition-all"
              style={{ width: recording ? 22 : 48, height: recording ? 22 : 48, borderRadius: recording ? 6 : 999 }}
            />
          </button>
          <span className="text-[11px] font-medium text-white/80">
            {canClip ? 'Tap photo · hold for a 5s clip' : allowVideo ? '' : 'Photos only on Papic Lite'}
          </span>
        </div>
      </div>
    </div>
  );
}

function TierMeter({
  tier,
  pointsLeft,
  pointsCap,
  spent,
  allowVideo,
}: {
  tier: VendorPapicTier;
  pointsLeft: number | null;
  pointsCap: number | null;
  spent: number;
  allowVideo: boolean;
}) {
  const pct = pointsCap != null ? Math.min(100, Math.round((spent / pointsCap) * 100)) : 0;
  return (
    <div className="sn-tile">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Camera aria-hidden className="h-4 w-4" style={{ color: 'var(--m-orange-2)' }} strokeWidth={1.75} />
          <span className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
            {TIER_LABEL[tier]}
          </span>
          {allowVideo ? (
            <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
              <Video aria-hidden className="h-3 w-3" strokeWidth={1.75} /> photos + video
            </span>
          ) : (
            <span className="text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
              photos only
            </span>
          )}
        </div>
        <span className="font-mono text-sm font-bold" style={{ color: 'var(--m-ink)' }}>
          {pointsCap == null ? 'Unlimited' : `${pointsLeft} left`}
        </span>
      </div>
      {pointsCap != null ? (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--m-line)' }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--m-ink)' }} />
        </div>
      ) : null}
    </div>
  );
}
