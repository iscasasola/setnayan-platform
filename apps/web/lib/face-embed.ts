import { isFaceModelConfigured, VECTOR_MODEL } from '@/lib/face-embed-core';

// Browser-only ON-DEVICE face EMBEDDER (face-api.js → dlib ResNet, 128-d
// descriptors — public-domain weights + MIT code, validated 2026-06-17). Loads
// the detector + landmark + recognition models from R2 (NEXT_PUBLIC_FACE_MODEL_URL)
// and runs them on the guest's / friend's own phone — no cloud face API, ₱0. The
// face IMAGE never leaves the device; only the tiny 128-d descriptor moves on.
//
// face-api.js (+ its bundled TF.js) is loaded at RUNTIME as a UMD <script> from
// the SAME R2 host as the weights — NOT bundled by webpack. That's deliberate:
// the lib is large enough that bundling it tips `next build` over Vercel's 8GB
// build-machine ceiling and OOM-kills the deploy (the #1258 mechanic — see
// next.config.ts). Runtime-loading keeps it off the build entirely AND off the
// JS bundle until a face is actually embedded. Best-effort: returns null / [] when
// no model is hosted, the script can't load, no face is found, or anything errors
// — so the feature ships DORMANT and can never block a selfie or a capture.
//
// ⚠ Needs the weights + `face-api.js` hosted on R2 and NEXT_PUBLIC_FACE_MODEL_URL
// set (OWNER_ACTIONS). The script URL defaults to `${MODEL_URL}/face-api.js`;
// override with NEXT_PUBLIC_FACE_API_URL. Until then every call here is a no-op.

type FaceDetection = { descriptor: Float32Array };
type FaceApi = {
  nets: {
    ssdMobilenetv1: { loadFromUri(url: string): Promise<void> };
    faceLandmark68Net: { loadFromUri(url: string): Promise<void> };
    faceRecognitionNet: { loadFromUri(url: string): Promise<void> };
  };
  detectSingleFace(input: HTMLCanvasElement | HTMLImageElement): {
    withFaceLandmarks(): { withFaceDescriptor(): Promise<FaceDetection | undefined> };
  };
  detectAllFaces(input: HTMLCanvasElement | HTMLImageElement): {
    withFaceLandmarks(): { withFaceDescriptors(): Promise<FaceDetection[]> };
  };
};

let apiPromise: Promise<FaceApi | null> | null = null;

/** Where the face-api.js UMD lives — next to the weights on R2 by default. */
function faceApiScriptUrl(modelUrl: string): string {
  const explicit = process.env.NEXT_PUBLIC_FACE_API_URL;
  if (explicit) return explicit;
  return `${modelUrl.replace(/\/+$/, '')}/face-api.js`;
}

/** Inject the UMD <script> once and resolve window.faceapi (null on any error). */
function loadFaceApiScript(src: string): Promise<FaceApi | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);
    const w = window as unknown as { faceapi?: FaceApi };
    if (w.faceapi) return resolve(w.faceapi);
    const existing = document.querySelector<HTMLScriptElement>('script[data-faceapi]');
    if (existing) {
      existing.addEventListener('load', () => resolve(w.faceapi ?? null), { once: true });
      existing.addEventListener('error', () => resolve(null), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.dataset.faceapi = '1';
    s.addEventListener('load', () => resolve(w.faceapi ?? null), { once: true });
    s.addEventListener('error', () => resolve(null), { once: true });
    document.head.appendChild(s);
  });
}

async function getFaceApi(): Promise<FaceApi | null> {
  if (apiPromise) return apiPromise;
  apiPromise = (async () => {
    try {
      const url = process.env.NEXT_PUBLIC_FACE_MODEL_URL;
      if (!url || typeof window === 'undefined') return null;
      const faceapi = await loadFaceApiScript(faceApiScriptUrl(url));
      if (!faceapi) return null;
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(url),
        faceapi.nets.faceLandmark68Net.loadFromUri(url),
        faceapi.nets.faceRecognitionNet.loadFromUri(url),
      ]);
      return faceapi;
    } catch {
      return null;
    }
  })();
  return apiPromise;
}

/**
 * Enrollment: one selfie → the single (largest) face's descriptor + model id, or
 * null. Stored as the guest's face fingerprint in guest_face_enrollments.
 */
export async function embedSingleFace(
  input: HTMLCanvasElement | HTMLImageElement,
): Promise<{ vector: number[]; model: string } | null> {
  try {
    if (!isFaceModelConfigured()) return null;
    const faceapi = await getFaceApi();
    if (!faceapi) return null;
    const det = await faceapi
      .detectSingleFace(input)
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!det) return null;
    return { vector: Array.from(det.descriptor), model: VECTOR_MODEL };
  } catch {
    return null;
  }
}

/**
 * Capture: a photo → one descriptor per detected face (empty array if no face,
 * no model, or any error). The capturing phone sends these to the server matcher,
 * which compares them to the event's enrolled fingerprints.
 */
export async function embedFaces(
  input: HTMLCanvasElement | HTMLImageElement,
): Promise<number[][]> {
  try {
    if (!isFaceModelConfigured()) return [];
    const faceapi = await getFaceApi();
    if (!faceapi) return [];
    const dets = await faceapi
      .detectAllFaces(input)
      .withFaceLandmarks()
      .withFaceDescriptors();
    return dets.map((d) => Array.from(d.descriptor));
  } catch {
    return [];
  }
}
