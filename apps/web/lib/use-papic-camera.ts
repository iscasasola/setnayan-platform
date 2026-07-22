'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react';

// Papic · shared camera controls (client)
//
// One hook owns the live capture stream for BOTH Papic capture surfaces (the
// claimed-seat paparazzo + the per-guest disposable camera) so flip + lens
// switching behave identically. It manages a SINGLE getUserMedia stream (the
// iOS-safe shape — a second getUserMedia while the camera is live can interrupt
// it) and re-acquires it only when the physical camera must change (a flip, or
// an ultra-wide lens that lives on a separate device).
//
// LENS CONTROL is gated by what the platform actually exposes (owner 2026-06-27
// "build all, gate by device" — no dead buttons, no synthetic 0.5×):
//   1. ZOOM-CAPABLE track (modern Chrome/Android logical cameras report a `zoom`
//      capability whose min dips below 1×) → 0.5/1 apply live via applyConstraints,
//      no re-acquire, perfectly smooth.
//   2. MULTI-CAMERA fallback (a distinct ULTRA-WIDE videoinput device is
//      enumerable for this facing) → 0.5 switches deviceId, 1 returns to the main.
//   3. NEITHER (iPhone Safari/PWA only ever hands a web app one back camera;
//      most front cameras) → the 0.5/1 toggle is simply not offered for that
//      facing. Full lens parity arrives with native Papic (Phase 2).
//
// Front ↔ back flip works everywhere a second camera is enumerable.

export type Facing = 'environment' | 'user';
export type LensFactor = 0.5 | 1;

/** TS DOM libs don't model the `zoom` capability/constraint yet — narrow casts. */
type ZoomCapabilities = MediaTrackCapabilities & {
  zoom?: { min: number; max: number; step?: number };
};
type ZoomConstraintSet = MediaTrackConstraintSet & { zoom?: number };

/** Below this the track can render an ultra-wide (~0.5×) field of view. */
const ULTRAWIDE_ZOOM_CEILING = 0.7;

/** Classify a videoinput device by its label. Labels are only populated after
 *  camera permission is granted; returns null when the label gives no hint. */
function labelFacing(label: string): Facing | null {
  const l = label.toLowerCase();
  if (/front|user|face|self/.test(l)) return 'user';
  if (/back|rear|environment|world/.test(l)) return 'environment';
  return null;
}

/** Is this label an ULTRA-wide lens (the 0.5× candidate)? Deliberately strict —
 *  plain "wide"/"camera" is the MAIN lens, so it never gets mistaken for 0.5×
 *  (a wrong-lens button is worse than no button). */
function isUltraWideLabel(label: string): boolean {
  return /ultra[\s-]?wide|0[.,]5/i.test(label) && !/tele|zoom/i.test(label);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function applyZoom(track: MediaStreamTrack, factor: LensFactor): void {
  const caps = track.getCapabilities?.() as ZoomCapabilities | undefined;
  if (!caps?.zoom) return;
  const target = clamp(factor, caps.zoom.min, caps.zoom.max);
  void track
    .applyConstraints({ advanced: [{ zoom: target } as ZoomConstraintSet] })
    .catch(() => {
      /* zoom rejected — preview simply stays at its current factor */
    });
}

export type PapicCamera = {
  videoRef: RefObject<HTMLVideoElement | null>;
  streamRef: MutableRefObject<MediaStream | null>;
  ready: boolean;
  camError: boolean;
  /** Current facing — drives the selfie mirror + which lens set is offered. */
  facing: Facing;
  /** A second camera is enumerable → the flip control is meaningful. */
  canFlip: boolean;
  /** Flip front ↔ back. Resets the lens to 1× for the new facing. */
  flip: () => void;
  /** Lens factors available for the CURRENT facing — `[1]` means hide the toggle. */
  lensOptions: LensFactor[];
  lens: LensFactor;
  selectLens: (factor: LensFactor) => void;
  /** True while facing 'user' → mirror the preview (selfie convention). */
  mirrored: boolean;
  /** True while re-acquiring the stream (flip / deviceId lens swap) → freeze the shutter. */
  switching: boolean;
};

/**
 * Own the Papic capture stream + its flip/lens controls.
 *
 * @param enabled  Acquire (and hold) the camera only while true. The guest
 *   surface flips this false behind its UGC gate and while the front-camera
 *   face-enroll panel owns the camera; the seat surface passes a constant true.
 */
export function usePapicCamera({ enabled }: { enabled: boolean }): PapicCamera {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facing, setFacing] = useState<Facing>('environment');
  const [lens, setLens] = useState<LensFactor>(1);
  const [lensOptions, setLensOptions] = useState<LensFactor[]>([1]);
  const [canFlip, setCanFlip] = useState(false);
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState(false);
  const [switching, setSwitching] = useState(false);

  // When set, open THIS device (the ultra-wide multi-camera path) instead of the
  // facingMode default. Cleared on flip / when returning to the 1× main lens.
  const [targetDeviceId, setTargetDeviceId] = useState<string | null>(null);

  // Probe results for the active facing (refs so selectLens reads them without
  // re-rendering): can the live track zoom below 1×, and the ultra-wide deviceId.
  const zoomCapableRef = useRef(false);
  const wideDeviceIdRef = useRef<string | null>(null);
  // The lens the user wants — applied after a fresh facingMode acquire so a 0.5×
  // request survives a flip-then-zoom on zoom-capable hardware.
  const lensWantedRef = useRef<LensFactor>(1);

  // Figure out which lenses this facing can actually offer, and whether a flip
  // target exists. Runs after every successful acquire.
  const probeLenses = useCallback(async (stream: MediaStream, forFacing: Facing) => {
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    const settings = track.getSettings?.() ?? {};
    const caps = track.getCapabilities?.() as ZoomCapabilities | undefined;

    let zoomCapable = false;
    let factors: LensFactor[] = [1];
    let wideDeviceId: string | null = null;

    if (
      caps?.zoom &&
      typeof caps.zoom.min === 'number' &&
      caps.zoom.min <= ULTRAWIDE_ZOOM_CEILING &&
      caps.zoom.max >= 1
    ) {
      zoomCapable = true;
      factors = [0.5, 1];
    } else {
      // No sub-1× zoom on the track — look for a distinct ultra-wide device.
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === 'videoinput');
        const hasFront = cams.some((c) => labelFacing(c.label) === 'user');
        const hasBack = cams.some((c) => labelFacing(c.label) === 'environment');
        setCanFlip((hasFront && hasBack) || cams.length > 1);
        const wide = cams.find(
          (c) =>
            (labelFacing(c.label) === forFacing || labelFacing(c.label) === null) &&
            isUltraWideLabel(c.label) &&
            c.deviceId &&
            c.deviceId !== settings.deviceId,
        );
        if (wide) {
          factors = [0.5, 1];
          wideDeviceId = wide.deviceId;
        }
      } catch {
        /* enumerateDevices unavailable — fall back to a flip-only / 1× camera */
      }
    }

    zoomCapableRef.current = zoomCapable;
    wideDeviceIdRef.current = wideDeviceId;
    setLensOptions(factors);
  }, []);

  // Acquire (and re-acquire) the stream. Fires on enable, flip (facing), and the
  // ultra-wide deviceId swap. Zoom-based lens changes do NOT re-acquire — they
  // applyConstraints on the live track (see selectLens), so the stream is stable.
  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setReady(false);
      return;
    }
    setSwitching(true);

    async function acquire(withAudio: boolean) {
      // Request a HIGH-RES stream (owner 2026-07-14): Papic stills are grabbed by
      // canvas-drawing this video (papic-guest-capture / papic-seat-capture at
      // `video.videoWidth × videoHeight`), so an unconstrained stream shipped
      // ~VGA photos — far below the camera's capability, bad for a candid-PHOTO
      // product. `ideal` 1440p targets QHD (≈3.7 MP stills, ~4–10× the old
      // default) and degrades gracefully on weaker cameras — no `exact`/`max`, so
      // never an OverconstrainedError, and 10s clips off the same stream stay
      // manageable (the clip encode is bitrate-bounded in papic-adaptive-quality,
      // so a 10s 1440p clip targets ~12.5 MB). Applies to BOTH capture surfaces
      // via this shared hook.
      // (True full-sensor stills would need ImageCapture.takePhoto(), which iOS
      //  Safari doesn't support — deferred; this lifts every platform uniformly.)
      const HI_RES = { width: { ideal: 2560 }, height: { ideal: 1440 } } as const;
      const video: MediaTrackConstraints = targetDeviceId
        ? { deviceId: { exact: targetDeviceId }, ...HI_RES }
        : { facingMode: { ideal: facing }, ...HI_RES };
      return navigator.mediaDevices.getUserMedia({ video, audio: withAudio });
    }

    (async () => {
      try {
        // Prefer audio so a hold-to-record clip has sound; fall back to
        // video-only rather than losing the camera if the mic is denied.
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
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true; // never echo the shooter's own mic
          await video.play().catch(() => {});
        }
        setReady(true);
        setCamError(false);
        // A 0.5× request that rides a zoom-capable track needs re-applying after
        // a fresh facingMode acquire (the new track starts at 1×).
        if (lensWantedRef.current === 0.5 && !targetDeviceId) {
          const track = stream.getVideoTracks()[0];
          const caps = track?.getCapabilities?.() as ZoomCapabilities | undefined;
          if (track && caps?.zoom && caps.zoom.min <= ULTRAWIDE_ZOOM_CEILING) {
            applyZoom(track, 0.5);
          }
        }
        void probeLenses(stream, facing);
      } catch {
        setCamError(true);
      } finally {
        if (!cancelled) setSwitching(false);
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [enabled, facing, targetDeviceId, probeLenses]);

  const flip = useCallback(() => {
    setLens(1);
    lensWantedRef.current = 1;
    setTargetDeviceId(null);
    setFacing((f) => (f === 'environment' ? 'user' : 'environment'));
  }, []);

  const selectLens = useCallback(
    (factor: LensFactor) => {
      lensWantedRef.current = factor;
      if (zoomCapableRef.current) {
        // Smooth path — zoom the live track, no re-acquire.
        const track = streamRef.current?.getVideoTracks()[0];
        if (track) {
          applyZoom(track, factor);
          setLens(factor);
        }
        return;
      }
      // Multi-camera path — swap to/from the ultra-wide device (re-acquires).
      if (factor === 0.5 && wideDeviceIdRef.current) {
        setLens(0.5);
        setTargetDeviceId(wideDeviceIdRef.current);
      } else if (factor === 1) {
        setLens(1);
        setTargetDeviceId(null);
      }
    },
    [],
  );

  return {
    videoRef,
    streamRef,
    ready,
    camError,
    facing,
    canFlip,
    flip,
    lensOptions,
    lens,
    selectLens,
    mirrored: facing === 'user',
    switching,
  };
}
