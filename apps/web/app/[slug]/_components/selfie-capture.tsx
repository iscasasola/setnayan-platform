'use client';

import { useEventWords, WORDS_AS_SHIPPED } from './event-words-provider';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Info, Loader2, X } from 'lucide-react';
import type { FaceGateReason, FaceGateResult } from '@/lib/face-gate';
import type { PapicFaceMode } from '@/lib/papic-face-mode';
import {
  FACE_STEP_SUB,
  FACE_STEP_TICK,
  FACE_STEP_TICK_HINT,
  FACE_STEP_TITLE,
} from '@/lib/face-enroll-refusal';
import { FaceReceiptCard } from './face-receipt-card';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { PAPIC_CAPTURE_GRACE_HOURS } from '@/lib/papic-window';

/**
 * THE FACE SCREEN — built from the approved design
 * `prototypes/face_registration_2026-09-30_fable.html` (frames A, B, C, E).
 *
 * ⚖ Owner 2026-09-30, testing with a real guest: *"we don't want it scrolling.
 * we want 1 step at a time"* → *"too many texts again"* → *"keep everything
 * very simple and fluid and easy to use. too much confirmation is a hassle"*.
 *
 *   A · the whole screen is the front camera with a soft oval to stand in;
 *       "Find you in photos?" on top, × (not now) top-left; a bottom sheet
 *       with ONE tick — "I'm 18+ and agree to face tagging", never pre-ticked —
 *       and "Take selfie", grey with "Tick to continue" under it until ticked,
 *       so a tap is never a silent nothing;
 *   B · ticked → the button fills; one tap takes AND saves — no preview, no
 *       "use this photo?", no second confirm;
 *   C · ⓘ opens the consent in plain words over the camera; "Got it" only
 *       closes it — it never ticks the box for them;
 *   E · a failure keeps them here, tick kept, with the reason in the toast
 *       (drawn by the parent into `toast`).
 *
 * 🔒 THE EMBEDDER RUNS ONLY ON A mode_a EVENT (One-Pool spec §3.4); the server
 * nulls any vector off mode_a regardless — this is the first line.
 */

/** What a successful shot hands the parent — the parent saves it. */
export type SelfieShot = {
  ref: string;
  vector: number[] | null;
  quality: Record<string, unknown> | null;
};

/**
 * A quality-gate code → the few words the toast carries (frame E). 🔑
 * `lib/face-gate.ts` returns a CODE and nothing else; the resolved words are
 * already here, so the words are here. `null` = advisory only, save anyway.
 */
function faceGateHint(code: FaceGateReason | undefined): string | null {
  switch (code) {
    case 'no_face':
      return 'no face found';
    case 'many_faces':
      return 'more than one face';
    case 'too_dark':
      return 'too dark';
    default:
      // too_far · not_frontal · too_bright — advisory: the selfie still saves.
      return null;
  }
}

export function SelfieCapture({
  faceMode = 'mode_b',
  onShot,
  onFail,
  onClose,
  saving = false,
  toast = null,
}: {
  /** Server-resolved effective face-tag mode; only mode_a computes a descriptor. */
  faceMode?: PapicFaceMode;
  /** A consented, uploaded selfie — the parent saves it. */
  onShot: (shot: SelfieShot) => Promise<void> | void;
  /** The few words of a failure (frame E) — never swallowed. */
  onFail: (words: string) => void;
  /** × — not now. */
  onClose: () => void;
  /** The parent is saving — the button waits. */
  saving?: boolean;
  /** The parent's toast, drawn just above the sheet (frame E). */
  toast?: ReactNode;
}) {
  const w = useEventWords() ?? WORDS_AS_SHIPPED;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [details, setDetails] = useState(false);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  // The whole screen is a modal over the page (Escape = ×, the page behind it
  // cannot scroll); the ⓘ sheet is a modal over the screen.
  const screenRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose, containerRef: screenRef });
  useModalA11y({ open: details, onClose: () => setDetails(false), containerRef: sheetRef });

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  }, []);

  // CAMERA FIRST (frame A): the guest opened this screen themselves, so the
  // front camera starts with it. Released on leaving.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
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
        setLive(true);
      } catch {
        if (!cancelled) onFail('camera blocked');
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [onFail, stopStream]);

  // The frame → the quality gate → the descriptor (mode_a only) → the upload
  // to this guest's own folder → the parent saves. Taken AND saved in one go.
  const takeSelfie = useCallback(async () => {
    if (!agreed || busy || saving) return; // the button says why (frame A)
    const video = videoRef.current;
    if (!video || !live || !video.videoWidth) {
      onFail('camera blocked');
      return;
    }
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      // Mirror, so the saved photo matches the preview the guest just saw.
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      let gate: FaceGateResult | null = null;
      try {
        const { runFaceGate } = await import('@/lib/face-gate');
        gate = await runFaceGate(canvas);
      } catch {
        gate = null;
      }
      const refused = gate?.available && !gate.ok ? faceGateHint(gate.reasonCode) : null;
      if (refused) {
        onFail(refused);
        return;
      }

      let vector: number[] | null = null;
      if (faceMode === 'mode_a') {
        try {
          const { embedSingleFace } = await import('@/lib/face-embed');
          const r = await embedSingleFace(canvas);
          vector = r ? r.vector : null;
        } catch {
          vector = null;
        }
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('blob');
      const presign = await fetch('/api/guest-selfie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: 'image/jpeg', sizeBytes: blob.size }),
      });
      const data = (await presign.json()) as { uploadUrl?: string; r2Ref?: string };
      if (!presign.ok || !data.uploadUrl || !data.r2Ref) throw new Error('presign');
      const put = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
      if (!put.ok) throw new Error('put');
      await onShot({ ref: data.r2Ref, vector, quality: gate ? { score: gate.score, ...gate.meta } : null });
    } catch {
      onFail('connection lost');
    } finally {
      setBusy(false);
    }
  }, [agreed, busy, saving, live, onFail, onShot, faceMode]);

  const working = busy || saving;
  const ready = agreed && !working;

  return (
    <div
      ref={screenRef}
      role="dialog"
      aria-modal="true"
      aria-label={FACE_STEP_TITLE}
      tabIndex={-1}
      data-face-screen
      className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[#1d1719] text-cream">
      {/* THE CAMERA — the whole screen (frame A). */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
      />
      {!live ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 aria-hidden className="h-6 w-6 animate-spin text-cream/50" strokeWidth={2} />
        </div>
      ) : null}
      {/* The soft oval to stand in. Decorative. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center pb-40">
        <div className="h-[46%] max-h-80 w-[62%] max-w-60 rounded-[50%] border border-cream/70 shadow-[0_0_0_9999px_rgba(29,23,25,0.45)]" />
      </div>

      {/* Top: × and the title (frame A). */}
      <header className="relative z-10 flex items-start gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Not now"
          className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/30"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
        <div className="min-w-0 pr-10 text-center">
          <h2 className="font-serif text-[1.75rem] leading-tight">{FACE_STEP_TITLE}</h2>
          <p className="mt-0.5 text-xs text-cream/80">{FACE_STEP_SUB}</p>
        </div>
      </header>

      {/* Bottom: the toast (frame E), then the sheet (frames A/B). */}
      <div className="relative z-10 mt-auto">
        {toast}
        <div className="rounded-t-3xl bg-cream px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-ink">
          <div aria-hidden className="mx-auto mb-3 h-1 w-9 rounded-full bg-ink/15" />
          <div className="flex items-center gap-3">
            <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="face_step_agree"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="h-5 w-5 shrink-0 rounded border-ink/40 text-ink focus:ring-ink"
              />
              <span>{FACE_STEP_TICK}</span>
            </label>
            <button
              type="button"
              onClick={() => setDetails(true)}
              aria-label="Details"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/55"
            >
              <Info aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
          {/* Both inputs the enrolment reads, posted only with the tick. */}
          {agreed ? (
            <>
              <input type="hidden" name="biometric_consent" value="1" />
              <input type="hidden" name="age_affirmation" value="1" />
            </>
          ) : null}
          <button
            type="button"
            disabled={!ready}
            aria-describedby={agreed ? undefined : 'face-step-hint'}
            onClick={() => void takeSelfie()}
            className="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-base font-medium text-cream transition disabled:bg-ink/10 disabled:text-ink/45"
          >
            {working ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} /> : null}
            Take selfie
          </button>
          {agreed ? null : (
            <p id="face-step-hint" className="mt-2 text-center text-xs text-ink/55">
              {FACE_STEP_TICK_HINT}
            </p>
          )}
        </div>
      </div>

      {/* ⓘ — THE DETAILS, OVER THE CAMERA (frame C). "Got it" only closes. */}
      {details ? (
        <div
          ref={sheetRef}
          tabIndex={-1}
          className="absolute inset-0 z-20 flex flex-col justify-end bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="Face tagging"
        >
          <div className="max-h-[85%] overflow-y-auto rounded-t-3xl bg-cream px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-ink">
            <div aria-hidden className="mx-auto mb-3 h-1 w-9 rounded-full bg-ink/15" />
            <p className="text-center text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink/60">Face tagging</p>
            <p className="mt-1 text-center font-serif text-lg leading-snug">
              One selfie, so Papic can spot you in {w.theOrganizerPossessive} photos.
            </p>
            <ul className="mt-3 divide-y divide-ink/10 text-sm text-ink/80">
              <li className="py-2"><b className="text-ink">This event only.</b> Your face data is never used anywhere else.</li>
              <li className="py-2"><b className="text-ink">Erased</b> when you sign out, or when Papic closes — {PAPIC_CAPTURE_GRACE_HOURS} hours after the event.</li>
              <li className="py-2"><b className="text-ink">Tags already made stay</b> on those photos.</li>
              <li className="py-2">Photo helpers for {w.theOrganizerPossessive} event see your tags, not your face data.</li>
              <li className="py-2"><b className="text-ink">Say no anytime</b> — untick here, or turn it off in Me → Face tagging.</li>
            </ul>
            <details className="mt-2 text-xs text-ink/65">
              <summary className="cursor-pointer py-1 font-medium">Full wording</summary>
              <div className="space-y-2 pt-1">
                {faceMode === 'mode_a' ? (
                  <p>
                    I consent to facial-recognition photo matching for this event. My selfie is used
                    only to find me in photos taken at this event — including photos other guests take
                    on their own phones — so those photos can be delivered to me. I confirm I am 18 or
                    older. This event only; I can withdraw anytime on my invitation. (Philippine Data
                    Privacy Act, RA 10173.)
                  </p>
                ) : (
                  <p>
                    I agree to add my photo to this event&rsquo;s guest list, so {w.theOrganizer} and
                    their team can recognize me. No facial recognition runs at this event. I confirm I
                    am 18 or older. (Philippine Data Privacy Act, RA 10173.)
                  </p>
                )}
                <FaceReceiptCard
                  heading="What this saves, and for how long"
                  faceMode={faceMode}
                  eventWord={w.eventWord}
                  theOrganizer={w.theOrganizer}
                />
              </div>
            </details>
            <button
              type="button"
              onClick={() => setDetails(false)}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-base font-medium text-cream"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
