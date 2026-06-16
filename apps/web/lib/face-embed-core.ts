// Papic face auto-tagging — PURE embedding helpers (no 'server-only', no model
// runtime), so they're unit-testable and shared by the browser embedder. The
// heavy ONNX inference lives in face-embed.ts; the deterministic pre/post math
// (square-crop geometry + L2 normalization) lives here where it can be tested.
//
// Self-hosted, on-device: the recognition model (MobileFaceNet, ONNX) is served
// from R2 via NEXT_PUBLIC_FACE_MODEL_URL and run in the browser — no paid cloud
// face API (spec line), ₱0 marginal cost. When the URL is unset the whole
// embedder is a clean no-op (enrollment stores no vector — exactly today's
// behavior), so this ships safely DORMANT until the owner hosts the model.

/** Bumped whenever the model or preprocessing changes → triggers re-embedding. */
export const VECTOR_MODEL = 'mobilefacenet@1';

/** Model input is a square RGB crop of this many px per side (MobileFaceNet). */
export const FACE_EMBED_INPUT_SIZE = 112;

/** Extra context around the detected face box before cropping (recognition
 *  models expect some margin / the whole head, not a tight box). */
export const FACE_CROP_MARGIN = 0.25;

/** True only when a self-hosted face model URL is configured. The embedder and
 *  every caller gate on this so the feature is dormant until the owner hosts it. */
export function isFaceModelConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FACE_MODEL_URL);
}

export type CropBox = { x: number; y: number; size: number };
export type DetBox = { originX: number; originY: number; width: number; height: number };

/**
 * Expand a face detection box into a SQUARE crop, centered on the face, grown by
 * `margin`, and clamped to stay fully inside the image. Integer px. A square
 * crop is required because the model takes a square input; clamping avoids
 * sampling outside the bitmap. Returns null for a non-positive image.
 */
export function squareCropBox(
  box: DetBox,
  imgW: number,
  imgH: number,
  margin = FACE_CROP_MARGIN,
): CropBox | null {
  if (imgW <= 0 || imgH <= 0) return null;
  const cx = box.originX + box.width / 2;
  const cy = box.originY + box.height / 2;
  const base = Math.max(box.width, box.height) * (1 + margin);
  // Can't be larger than the image in either dimension.
  const size = Math.max(1, Math.min(base, imgW, imgH));
  const x = Math.min(Math.max(cx - size / 2, 0), imgW - size);
  const y = Math.min(Math.max(cy - size / 2, 0), imgH - size);
  return { x: Math.round(x), y: Math.round(y), size: Math.round(size) };
}

/**
 * L2-normalize a vector so cosine similarity reduces to a dot product and every
 * stored embedding is unit-length. A zero-magnitude vector is returned as-is
 * (all zeros) — it carries no signal and will never match.
 */
export function l2normalize(vec: number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const norm = Math.sqrt(sum);
  if (norm === 0) return vec.slice();
  return vec.map((v) => v / norm);
}
