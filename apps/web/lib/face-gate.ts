'use client';

import type {
  FaceDetector as FaceDetectorType,
  FaceDetectorResult,
} from '@mediapipe/tasks-vision';

/**
 * RSVP-selfie face-quality gate — ADVISORY ONLY. It warns and offers a retake;
 * it NEVER blocks the RSVP (RA 10173: a selfie can't be a hard requirement).
 *
 * Runs entirely in the browser via MediaPipe Tasks Vision FaceDetector (OSS,
 * Apache-2.0, BlazeFace short-range). The library + its WASM + model are
 * DYNAMICALLY imported / fetched at call time, so none of it touches the
 * shared JS bundle (the 200KB gzip ceiling in scripts/check-bundle-size.mjs) —
 * `import type` is erased, and the runtime `import()` lands in its own lazy
 * chunk loaded only when a guest actually takes a selfie.
 *
 * If the detector can't load (old browser, blocked CDN, no WASM) the gate
 * returns `available: false` and the caller ALLOWS the selfie unchecked —
 * Papic can re-screen server-side later. The goal is a selfie "up to standard
 * for face recognition": exactly one face, large enough, roughly frontal,
 * decently lit.
 *
 * Self-host follow-up: the WASM + model load from CDNs below. Mirror them to
 * an R2/`/public` path + allow them in the CSP to drop the runtime CDN
 * dependency (tracked for a later pass).
 */

/** The refusal findings this gate can report. The WORDS live at the capture
 *  screen, which is the only place that knows the event's own nouns. */
export type FaceGateReason =
  | 'no_face'
  | 'many_faces'
  | 'too_far'
  | 'not_frontal'
  | 'too_dark'
  | 'too_bright';

export type FaceGateResult = {
  /** false → detector couldn't run; caller should allow the selfie unchecked. */
  available: boolean;
  /** Passes the quality bar. Only meaningful when `available`. */
  ok: boolean;
  /** Rough 0..1 quality score persisted to guest_face_enrollments.quality_score. */
  score: number | null;
  faceCount: number;
  bboxRatio: number;
  frontal: boolean;
  brightness: number;
  /**
   * WHY the shot was refused, as a CODE — never a sentence.
   *
   * 🔒 THIS FILE MUST NEVER GROW EVENT CONTEXT. It is a pure browser-side
   * quality helper with no event id and no words, and one of these hints used
   * to read "…so the couple recognizes you" on every event type, wake included.
   * The fix is NOT to pass it an event — that is how the next leak gets
   * written. The capture screen already holds the resolved words, so it owns
   * the sentence and this owns the finding.
   */
  reasonCode?: FaceGateReason;
  meta: Record<string, unknown>;
};

export const FACE_GATE_VERSION = 'blazeface-short@v1';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const WASM_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';

const MIN_BBOX_RATIO = 0.1; // face must fill ≥10% of the frame
const BRIGHTNESS_MIN = 0.22;
const BRIGHTNESS_MAX = 0.96;
const MAX_EYE_TILT_DEG = 22;

let detectorPromise: Promise<FaceDetectorType | null> | null = null;

async function getDetector(): Promise<FaceDetectorType | null> {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    try {
      const { FilesetResolver, FaceDetector } = await import(
        '@mediapipe/tasks-vision'
      );
      const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);
      return await FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      });
    } catch {
      return null;
    }
  })();
  return detectorPromise;
}

// Mean luma over a 32×32 downscale of the frame — detector-independent, so we
// can still flag too-dark / blown-out selfies even when face detection runs.
function meanBrightness(canvas: HTMLCanvasElement): number {
  try {
    const s = 32;
    const tmp = document.createElement('canvas');
    tmp.width = s;
    tmp.height = s;
    const ctx = tmp.getContext('2d');
    if (!ctx) return 0.5;
    ctx.drawImage(canvas, 0, 0, s, s);
    const { data } = ctx.getImageData(0, 0, s, s);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      sum += 0.299 * r + 0.587 * g + 0.114 * b;
    }
    return sum / (s * s) / 255;
  } catch {
    return 0.5;
  }
}

export async function runFaceGate(
  canvas: HTMLCanvasElement,
): Promise<FaceGateResult> {
  const brightness = meanBrightness(canvas);

  const detector = await getDetector();
  if (!detector) {
    return {
      available: false,
      ok: true,
      score: null,
      faceCount: 0,
      bboxRatio: 0,
      frontal: true,
      brightness,
      meta: { gate_version: FACE_GATE_VERSION, gate: 'unavailable' },
    };
  }

  let result: FaceDetectorResult;
  try {
    result = detector.detect(canvas);
  } catch {
    return {
      available: false,
      ok: true,
      score: null,
      faceCount: 0,
      bboxRatio: 0,
      frontal: true,
      brightness,
      meta: { gate_version: FACE_GATE_VERSION, gate: 'detect_failed' },
    };
  }

  const detections = result.detections ?? [];
  const faceCount = detections.length;
  const frameArea = canvas.width * canvas.height;

  // Largest detected face drives the size + frontal checks.
  let largest: (typeof detections)[number] | null = null;
  let largestArea = 0;
  for (const d of detections) {
    const bb = d.boundingBox;
    if (!bb) continue;
    const area = bb.width * bb.height;
    if (area > largestArea) {
      largestArea = area;
      largest = d;
    }
  }
  const bboxRatio = frameArea > 0 ? largestArea / frameArea : 0;

  // Frontal estimate from the two eye keypoints (BlazeFace short-range:
  // keypoints[0] = right eye, [1] = left eye, normalized 0..1). Cheap, no full
  // pose model. Absent keypoints → assume frontal (don't false-reject).
  let frontal = true;
  const kp = largest?.keypoints;
  const bb = largest?.boundingBox;
  const right = kp?.[0];
  const left = kp?.[1];
  if (right && left && bb) {
    const dx = (left.x - right.x) * canvas.width;
    const dy = (left.y - right.y) * canvas.height;
    const rawTilt = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
    const tilt = rawTilt > 90 ? 180 - rawTilt : rawTilt;
    const eyeMidX = ((left.x + right.x) / 2) * canvas.width;
    const centerX = bb.originX + bb.width / 2;
    const offset = bb.width > 0 ? Math.abs(eyeMidX - centerX) / bb.width : 0;
    frontal = tilt <= MAX_EYE_TILT_DEG && offset <= 0.22;
  }

  let ok = true;
  let reasonCode: FaceGateReason | undefined;
  if (faceCount === 0) {
    ok = false;
    reasonCode = 'no_face';
  } else if (faceCount > 1) {
    ok = false;
    reasonCode = 'many_faces';
  } else if (bboxRatio < MIN_BBOX_RATIO) {
    ok = false;
    reasonCode = 'too_far';
  } else if (!frontal) {
    ok = false;
    reasonCode = 'not_frontal';
  } else if (brightness < BRIGHTNESS_MIN) {
    ok = false;
    reasonCode = 'too_dark';
  } else if (brightness > BRIGHTNESS_MAX) {
    ok = false;
    reasonCode = 'too_bright';
  }

  const sizeScore = Math.max(0, Math.min(1, bboxRatio / (MIN_BBOX_RATIO * 2.5)));
  const score = ok ? 0.5 + 0.5 * sizeScore : 0.2;

  return {
    available: true,
    ok,
    score: Number(score.toFixed(3)),
    faceCount,
    bboxRatio: Number(bboxRatio.toFixed(3)),
    frontal,
    brightness: Number(brightness.toFixed(3)),
    reasonCode,
    meta: {
      gate_version: FACE_GATE_VERSION,
      faceCount,
      bboxRatio: Number(bboxRatio.toFixed(3)),
      frontal,
      brightness: Number(brightness.toFixed(3)),
    },
  };
}
