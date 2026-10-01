import 'server-only';
import { isFaceModelConfigured } from '@/lib/face-embed-core';

/**
 * face-embed-server.ts — THE SERVER'S OWN FACE EMBEDDER, for the one
 * end-of-event rescan (owner 2026-09-30, answering PR #6195: *"2. a"* —
 * `@vladmandic/face-api` on the server, the same model family as the phones).
 *
 * 🔑 SAME MODEL AS THE PHONES, SO THE VECTORS COMPARE. The phones load
 * face-api.js from R2 (lib/face-embed.ts) — the files `scripts/host-face-models.mjs`
 * copied from `@vladmandic/face-api@1.7.15` — and store 128-d dlib descriptors
 * as `faceapi-dlib@1`. This loads the SAME weights from the SAME R2 folder
 * (`NEXT_PUBLIC_FACE_MODEL_URL`) into the SAME library version, pinned, so a
 * descriptor computed here is directly comparable with an enrolled selfie.
 *
 * ⚙ THE NODE BUILD WITHOUT NATIVE CODE. face-api ships four Node entry points;
 * `face-api.node.js` needs `@tensorflow/tfjs-node` (native — breaks on Vercel,
 * next.config.ts says so), and the bundled ESM build fails under Node
 * (`TextEncoder is not a constructor`, measured). `face-api.node-wasm.js` runs
 * on the pure-JS `@tensorflow/tfjs` this repo already ships plus
 * `@tensorflow/tfjs-backend-wasm` (a `.wasm` file, not a native build), both
 * pinned to tfjs 4.22.0 — face-api 1.7.15's own build version. Measured locally
 * on the 1024-px group fixture: 5 faces in ~0.5 s on wasm. If the wasm backend
 * cannot start, the CPU backend is used instead: slower, same answers.
 *
 * 🔒 SERVER ONLY, AND LAZY. `server-only` keeps it out of every client bundle;
 * the library is required only on the first embed, and both packages are
 * `serverExternalPackages` (next.config.ts), so webpack never inlines them.
 * DORMANT without `NEXT_PUBLIC_FACE_MODEL_URL` — the same switch as the phones.
 *
 * ⛔ IT RETURNS NUMBERS AND KEEPS NOTHING. Descriptors are handed back to the
 * caller in memory; this module writes nowhere and logs no vector.
 */

type Box = { x: number; y: number; width: number; height: number };
type Detection = { descriptor: Float32Array; detection: { box: Box } };
type Tensor3D = { dispose(): void };
type FaceApiNode = {
  tf: {
    setBackend(name: string): Promise<boolean>;
    ready(): Promise<void>;
    getBackend(): string;
    tensor3d(values: Uint8Array, shape: [number, number, number], dtype: 'int32'): Tensor3D;
  };
  nets: {
    ssdMobilenetv1: { loadFromUri(url: string): Promise<void> };
    faceLandmark68Net: { loadFromUri(url: string): Promise<void> };
    faceRecognitionNet: { loadFromUri(url: string): Promise<void> };
  };
  detectAllFaces(input: Tensor3D): { withFaceLandmarks(): { withFaceDescriptors(): Promise<Detection[]> } };
};

/** The longest side a photo is decoded to before detection — speed, not recall, past this. */
export const SERVER_EMBED_MAX_SIDE = 1024;

let loading: Promise<FaceApiNode | null> | null = null;

async function load(): Promise<FaceApiNode | null> {
  const url = process.env.NEXT_PUBLIC_FACE_MODEL_URL;
  if (!url || !isFaceModelConfigured()) return null;
  const api = require('@vladmandic/face-api/dist/face-api.node-wasm.js') as FaceApiNode;
  try {
    await api.tf.setBackend('wasm');
    await api.tf.ready();
  } catch {
    await api.tf.setBackend('cpu');
    await api.tf.ready();
  }
  const base = url.replace(/\/+$/, '');
  await Promise.all([
    api.nets.ssdMobilenetv1.loadFromUri(base),
    api.nets.faceLandmark68Net.loadFromUri(base),
    api.nets.faceRecognitionNet.loadFromUri(base),
  ]);
  return api;
}

/** The loaded library, once per warm instance; a failed load is retried next time. */
export async function serverFaceApi(): Promise<FaceApiNode | null> {
  if (!loading) {
    const attempt = load().catch((err) => {
      console.warn('[face-embed-server] model load failed', err instanceof Error ? err.message : String(err));
      return null;
    });
    loading = attempt;
    const api = await attempt;
    if (!api && loading === attempt) loading = null;
    return api;
  }
  return loading;
}

/**
 * One photo → one 128-d descriptor per face found (empty when none, or on any
 * error). EXIF-rotated and scaled to {@link SERVER_EMBED_MAX_SIDE} first.
 */
export async function embedPhotoFacesOnServer(bytes: Uint8Array): Promise<number[][]> {
  const api = await serverFaceApi();
  if (!api) return [];
  let input: Tensor3D | null = null;
  try {
    const sharp = (await import('sharp')).default;
    const { data, info } = await sharp(bytes)
      .rotate()
      .resize({ width: SERVER_EMBED_MAX_SIDE, height: SERVER_EMBED_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.channels !== 3) return [];
    input = api.tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32');
    const dets = await api.detectAllFaces(input).withFaceLandmarks().withFaceDescriptors();
    return dets.map((d) => Array.from(d.descriptor));
  } catch {
    return [];
  } finally {
    input?.dispose();
  }
}
