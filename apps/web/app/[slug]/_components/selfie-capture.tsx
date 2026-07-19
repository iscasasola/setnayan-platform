'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import type { FaceGateResult } from '@/lib/face-gate';

/**
 * RSVP selfie capture (owner directive 2026-06-05 — guest photos come from a
 * Gmail avatar or a selfie, and the selfie must be face-recognition grade so
 * Papic can reuse it). Front camera → mirror → full-res JPEG → guest-session
 * presign (/api/guest-selfie) → R2. Renders the hidden inputs the RSVP form's
 * `submitRsvp` reads: `biometric_consent`, `selfie_ref`, `selfie_quality`.
 *
 * Prominent but SKIPPABLE (RA 10173 — biometric consent must be freely given):
 * the whole block is optional, and a separate consent checkbox gates the
 * CAPTURE UI, never the RSVP submit. The MediaPipe quality gate is advisory —
 * it warns + offers a retake but the selfie still saves.
 */
type Phase = 'idle' | 'camera' | 'review' | 'gallery';

/** A committed angle in multi-shot mode. */
type Shot = {
  ref: string;
  vector: number[] | null;
  quality: Record<string, unknown> | null;
  preview: string;
};

/** Pose hints shown one per angle (owner 2026-06-28 — 3 angles lift face-match
 *  recall vs. a single frontal frame). Index = shot number. */
const POSE_HINTS = [
  'Look straight at the camera',
  'Now turn your head slightly left',
  'And slightly to the right',
];

/** Decode an uploaded image File into a downscaled canvas (≤1280px long edge),
 *  ready for the same gate + embed + upload pipeline a live frame uses. */
async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That image could not be read.'));
      i.src = url;
    });
    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight, 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function SelfieCapture({
  onReadyChange,
  multiShot = false,
  maxShots = 3,
}: {
  /** Fires when a consented selfie is captured + uploaded (or cleared) — lets a
   *  standalone enroll form gate its submit. The RSVP form omits it (no-op). */
  onReadyChange?: (ready: boolean) => void;
  /** Capture up to `maxShots` angles (center / left / right) and submit them as
   *  `selfie_refs[]` / `selfie_vectors[]` / `selfie_qualities[]` for multi-vector
   *  enrollment. Default false → unchanged single-shot behavior (RSVP path). */
  multiShot?: boolean;
  maxShots?: number;
} = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [consent, setConsent] = useState(false);
  // Adults-only gate (RA 10173 · NPC — minors are scoped OUT of biometric
  // enrollment for V1). A separate REQUIRED affirmation the guest must tick
  // alongside biometric consent before any capture UI unlocks. No age/DOB is
  // collected — this is an attestation, not a data field.
  const [ageAffirmed, setAgeAffirmed] = useState(false);
  // Both facts must be affirmed before enrollment is allowed.
  const enrollAllowed = consent && ageAffirmed;
  const [phase, setPhase] = useState<Phase>('idle');
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [r2Ref, setR2Ref] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gate, setGate] = useState<FaceGateResult | null>(null);
  const [selfieVector, setSelfieVector] = useState<number[] | null>(null);
  // Multi-shot only: the committed angles so far.
  const [shots, setShots] = useState<Shot[]>([]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Always release the camera on unmount.
  useEffect(() => () => stopStream(), [stopStream]);

  // A consented, uploaded selfie is "ready to enroll" — surface it so a
  // standalone enroll form (day-of / camera) can enable its submit button.
  useEffect(() => {
    const has = multiShot ? shots.length > 0 : Boolean(r2Ref);
    onReadyChange?.(Boolean(enrollAllowed && has));
  }, [enrollAllowed, r2Ref, shots.length, multiShot, onReadyChange]);

  const startCamera = useCallback(async () => {
    setError(null);
    setCamError(false);
    setReady(false);
    setPhase('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setReady(true);
    } catch {
      setCamError(true);
    }
  }, []);

  const retake = useCallback(() => {
    setR2Ref(null);
    setGate(null);
    setSelfieVector(null);
    setPreviewUrl(null);
    setError(null);
    void startCamera();
  }, [startCamera]);

  // Shared pipeline for any frame (live capture OR uploaded photo): advisory
  // quality gate → on-device face fingerprint → presign + PUT the full-res JPEG
  // to R2. Returns the enrollment asset, or null on a soft failure (sets error).
  // Both lazy imports keep MediaPipe / face-api off the bundle until used.
  const processCanvas = useCallback(
    async (
      canvas: HTMLCanvasElement,
    ): Promise<{ ref: string; vector: number[] | null; gate: FaceGateResult | null } | null> => {
      let gateLocal: FaceGateResult | null = null;
      try {
        const { runFaceGate } = await import('@/lib/face-gate');
        gateLocal = await runFaceGate(canvas);
      } catch {
        gateLocal = null;
      }

      let vectorLocal: number[] | null = null;
      try {
        const { embedSingleFace } = await import('@/lib/face-embed');
        const r = await embedSingleFace(canvas);
        vectorLocal = r ? r.vector : null;
      } catch {
        vectorLocal = null;
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92),
      );
      if (!blob) {
        setError('Could not read that image — please try another.');
        return null;
      }
      const presignRes = await fetch('/api/guest-selfie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: 'image/jpeg', sizeBytes: blob.size }),
      });
      const data = (await presignRes.json()) as {
        uploadUrl?: string;
        r2Ref?: string;
        error?: string;
      };
      if (!presignRes.ok || !data.uploadUrl || !data.r2Ref) {
        throw new Error(data.error ?? 'Upload could not start.');
      }
      const putRes = await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      });
      if (!putRes.ok) throw new Error('Upload failed — check your signal.');
      return { ref: data.r2Ref, vector: vectorLocal, gate: gateLocal };
    },
    [],
  );

  const capture = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !ready) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    setBusy(true);
    setError(null);

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setBusy(false);
      return;
    }
    // Mirror so the saved photo matches the selfie preview the guest just saw.
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    setPreviewUrl(canvas.toDataURL('image/jpeg', 0.7));
    stopStream();
    setPhase('review');

    try {
      const shot = await processCanvas(canvas);
      if (!shot) {
        setBusy(false);
        return;
      }
      setGate(shot.gate);
      setSelfieVector(shot.vector);
      setR2Ref(shot.ref);
      if (multiShot) {
        // Commit this angle, then return to the gallery for the next pose.
        const preview = canvas.toDataURL('image/jpeg', 0.6);
        const quality = shot.gate ? { score: shot.gate.score, ...shot.gate.meta } : null;
        setShots((prev) => [...prev, { ref: shot.ref, vector: shot.vector, quality, preview }]);
        setR2Ref(null);
        setGate(null);
        setSelfieVector(null);
        setPreviewUrl(null);
        setPhase('gallery');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed — please retake.');
    } finally {
      setBusy(false);
    }
  }, [ready, stopStream, multiShot, processCanvas]);

  // Multi-shot only: add up to the remaining angles from uploaded photos
  // (owner 2026-06-28 — guests can upload up to 3, min 1, instead of posing).
  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setBusy(true);
      setError(null);
      const remaining = Math.max(0, maxShots - shots.length);
      for (const file of Array.from(files).slice(0, remaining)) {
        try {
          const canvas = await fileToCanvas(file);
          const shot = await processCanvas(canvas);
          if (shot) {
            const preview = canvas.toDataURL('image/jpeg', 0.6);
            const quality = shot.gate ? { score: shot.gate.score, ...shot.gate.meta } : null;
            setShots((prev) =>
              prev.length >= maxShots
                ? prev
                : [...prev, { ref: shot.ref, vector: shot.vector, quality, preview }],
            );
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not add that photo — try another.');
        }
      }
      setBusy(false);
      setPhase('gallery');
    },
    [maxShots, shots.length, processCanvas],
  );

  // Drop any captured selfie + reset the capture UI. Called when either the
  // biometric consent OR the 18+ affirmation is withdrawn — losing either fact
  // means we may no longer hold or capture the biometric.
  const resetCapture = () => {
    stopStream();
    setR2Ref(null);
    setGate(null);
    setPreviewUrl(null);
    setShots([]);
    setPhase('idle');
  };

  // Withdrawing consent drops any captured selfie — no consent, no photo.
  const onConsentChange = (checked: boolean) => {
    setConsent(checked);
    if (!checked) resetCapture();
  };

  // Withdrawing the 18+ affirmation likewise blocks + drops enrollment —
  // minors are scoped out entirely.
  const onAgeChange = (checked: boolean) => {
    setAgeAffirmed(checked);
    if (!checked) resetCapture();
  };

  // Derived multi-shot hidden-input payload (computed here so TS can narrow the
  // first angle once, instead of re-indexing shots[0] inside JSX).
  const firstShot = shots[0] ?? null;
  const multiHidden =
    multiShot && firstShot
      ? {
          ref: firstShot.ref,
          refs: JSON.stringify(shots.map((s) => s.ref)),
          quality: firstShot.quality ? JSON.stringify(firstShot.quality) : null,
          qualities: JSON.stringify(shots.map((s) => s.quality)),
          vector: firstShot.vector ? JSON.stringify(firstShot.vector) : null,
          vectors: JSON.stringify(shots.map((s) => s.vector)),
        }
      : null;

  return (
    <div className="rounded-xl border border-ink/10 bg-cream/60 p-4">
      {/* Hidden inputs the enroll/RSVP action reads on submit. In multi-shot
          mode we emit the arrays AND the single inputs (= first angle) so the
          single-path guard + display-photo write still work. */}
      {multiHidden ? (
        <>
          <input type="hidden" name="selfie_ref" value={multiHidden.ref} />
          <input type="hidden" name="selfie_refs" value={multiHidden.refs} />
          {multiHidden.quality ? (
            <input type="hidden" name="selfie_quality" value={multiHidden.quality} />
          ) : null}
          <input
            type="hidden"
            name="selfie_qualities"
            value={multiHidden.qualities}
          />
          {multiHidden.vector ? (
            <input type="hidden" name="selfie_vector" value={multiHidden.vector} />
          ) : null}
          <input type="hidden" name="selfie_vectors" value={multiHidden.vectors} />
        </>
      ) : multiShot ? null : (
        <>
          {r2Ref ? <input type="hidden" name="selfie_ref" value={r2Ref} /> : null}
          {r2Ref && gate ? (
            <input
              type="hidden"
              name="selfie_quality"
              value={JSON.stringify({ score: gate.score, ...gate.meta })}
            />
          ) : null}
          {r2Ref && selfieVector ? (
            <input
              type="hidden"
              name="selfie_vector"
              value={JSON.stringify(selfieVector)}
            />
          ) : null}
        </>
      )}

      <div className="flex items-start gap-2">
        <ShieldCheck
          aria-hidden
          className="mt-0.5 h-5 w-5 shrink-0 text-terracotta"
          strokeWidth={1.75}
        />
        <div>
          <p className="text-sm font-medium text-ink">
            Add your photo{' '}
            <span className="font-normal text-ink/50">· optional</span>
          </p>
          <p className="mt-0.5 text-xs text-ink/60">
            So the couple recognizes you on their guest list — and the
            photographers can find your candid shots after the wedding.
          </p>
        </div>
      </div>

      {/* Adults-only notice + the two REQUIRED affirmations. Both gate the
          capture UI (never the RSVP submit). Minors are scoped out of biometric
          enrollment for V1 (RA 10173 · NPC) — hence a distinct 18+ box, not a
          buried clause. No age/DOB is collected; these are attestations. */}
      <p className="mt-3 text-[0.7rem] font-medium uppercase tracking-wide text-terracotta">
        Adults only (18+)
      </p>

      {/* 1. Biometric consent — keeps name="biometric_consent" that the RSVP
          action reads to decide whether to enroll. */}
      <label className="mt-1.5 flex cursor-pointer items-start gap-2 rounded-lg border border-ink/10 bg-cream p-3 text-xs text-ink/75">
        <input
          type="checkbox"
          name="biometric_consent"
          value="1"
          checked={consent}
          onChange={(e) => onConsentChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
        />
        <span>
          I consent to{' '}
          <span className="font-medium">
            facial-recognition photo matching for this event
          </span>
          . My selfie is used only to recognize me in this event&rsquo;s photos,
          only for this event, and I can withdraw anytime in my settings.{' '}
          <span className="text-ink/45">
            (Philippine Data Privacy Act, RA 10173.)
          </span>
        </span>
      </label>

      {/* 2. Required 18+ affirmation — attestation only, no age field. */}
      <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border border-ink/10 bg-cream p-3 text-xs text-ink/75">
        <input
          type="checkbox"
          name="age_affirmation"
          value="1"
          checked={ageAffirmed}
          onChange={(e) => onAgeChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
        />
        <span>
          I confirm I am{' '}
          <span className="font-medium">18 or older</span> and consent to
          facial-recognition photo matching for this event.{' '}
          <span className="text-ink/45">
            (Face recognition is not offered to minors.)
          </span>
        </span>
      </label>

      {/* Hidden picker for the multi-shot upload path (up to maxShots photos). */}
      {multiShot ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            void handleUploadFiles(e.target.files);
            e.target.value = '';
          }}
        />
      ) : null}

      <div className="mt-3">
        {phase === 'idle' ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!enrollAllowed}
              onClick={startCamera}
              className="inline-flex items-center gap-2 rounded-full bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Camera aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              {multiShot
                ? 'Take selfies'
                : r2Ref
                  ? 'Retake selfie'
                  : 'Take a selfie'}
            </button>
            {multiShot ? (
              <button
                type="button"
                disabled={!enrollAllowed || busy}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-sm font-medium text-ink/75 transition-colors hover:border-terracotta hover:text-terracotta disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Upload aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Upload photos
              </button>
            ) : null}
          </div>
        ) : null}

        {phase === 'camera' ? (
          <div className="space-y-3">
            {camError ? (
              <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-xs text-terracotta-700">
                We couldn&rsquo;t open your camera. Allow camera access and try
                again — or just skip the photo.
                <button
                  type="button"
                  onClick={() => setPhase('idle')}
                  className="ml-2 underline"
                >
                  Back
                </button>
              </div>
            ) : (
              <>
                {multiShot ? (
                  <p className="text-center text-xs font-medium text-ink/70">
                    Angle {shots.length + 1} of {maxShots} ·{' '}
                    <span className="text-terracotta">
                      {POSE_HINTS[shots.length] ?? 'One more angle'}
                    </span>
                  </p>
                ) : null}
                <div className="relative mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-xl bg-ink">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="h-full w-full -scale-x-100 object-cover"
                  />
                  {!ready ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-ink/80">
                      <Loader2
                        aria-hidden
                        className="h-6 w-6 animate-spin text-cream/70"
                        strokeWidth={2}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      stopStream();
                      setPhase('idle');
                    }}
                    className="rounded-full border border-ink/20 px-4 py-2 text-sm text-ink/70 hover:border-ink/40"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={capture}
                    disabled={!ready || busy}
                    className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta/90 disabled:opacity-50"
                  >
                    <Camera aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    {multiShot ? `Capture angle ${shots.length + 1}` : 'Capture'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {phase === 'review' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Your selfie"
                  className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-ink/10"
                />
              ) : null}
              <div className="min-w-0 text-xs">
                {busy ? (
                  <p className="inline-flex items-center gap-1.5 text-ink/60">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                    Saving…
                  </p>
                ) : error ? (
                  <p className="text-terracotta-700">{error}</p>
                ) : gate && gate.available && !gate.ok ? (
                  <p className="inline-flex items-start gap-1.5 text-warn-700">
                    <AlertTriangle
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      strokeWidth={2}
                    />
                    <span>
                      {gate.reason}{' '}
                      <span className="text-ink/50">
                        Saved anyway — retake for a clearer match.
                      </span>
                    </span>
                  </p>
                ) : r2Ref ? (
                  <p className="inline-flex items-center gap-1.5 text-success-700">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Looks great — added to your RSVP.
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={retake}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/70 underline-offset-2 hover:underline"
            >
              <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Retake
            </button>
          </div>
        ) : null}

        {phase === 'gallery' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {shots.map((s, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={s.preview}
                  alt={`Angle ${i + 1}`}
                  className="h-16 w-16 rounded-lg object-cover ring-1 ring-ink/10"
                />
              ))}
              {shots.length < maxShots ? (
                <>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-ink/30 text-ink/55 transition-colors hover:border-terracotta hover:text-terracotta"
                  >
                    <Camera aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    <span className="text-[0.6rem] leading-none">Camera</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-ink/30 text-ink/55 transition-colors hover:border-terracotta hover:text-terracotta disabled:opacity-50"
                  >
                    <Upload aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    <span className="text-[0.6rem] leading-none">Upload</span>
                  </button>
                </>
              ) : null}
            </div>
            <p className="inline-flex items-center gap-1.5 text-xs text-success-700">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              {shots.length} of {maxShots} angles added
              {shots.length < maxShots
                ? ' — more angles help the photos find you'
                : ' — perfect'}
              .
            </p>
            {error ? <p className="text-xs text-terracotta-700">{error}</p> : null}
          </div>
        ) : null}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
