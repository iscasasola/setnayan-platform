import { isFaceModelConfigured, VECTOR_MODEL } from '@/lib/face-embed-core';

// Browser-only ON-DEVICE face EMBEDDER (face-api.js → dlib ResNet, 128-d
// descriptors — public-domain weights + MIT code, validated 2026-06-17). Loads
// the detector + landmark + recognition models from R2 (NEXT_PUBLIC_FACE_MODEL_URL)
// and runs them on the guest's / friend's own phone — no cloud face API, ₱0. The
// face IMAGE never leaves the device; only the tiny 128-d descriptor moves on.
//
// Lazy-imports face-api.js so the (heavy) library + TF.js stay OUT of the main
// bundle until a face is actually embedded. Best-effort: returns null / [] when
// no model is hosted, no face is found, or anything errors — so the feature ships
// DORMANT and can never block a selfie or a capture.
//
// ⚠ Needs the face-api.js model weights hosted on R2 + NEXT_PUBLIC_FACE_MODEL_URL
// set (OWNER_ACTIONS). Until then every call here is a clean no-op.

type FaceApi = typeof import('@vladmandic/face-api');
let apiPromise: Promise<FaceApi | null> | null = null;

async function getFaceApi(): Promise<FaceApi | null> {
  if (apiPromise) return apiPromise;
  apiPromise = (async () => {
    try {
      const url = process.env.NEXT_PUBLIC_FACE_MODEL_URL;
      if (!url || typeof window === 'undefined') return null;
      const faceapi = await import('@vladmandic/face-api');
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
