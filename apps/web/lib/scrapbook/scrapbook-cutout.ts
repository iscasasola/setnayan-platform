/**
 * Kwento scrapbook — "tap a person and they lift off the photo" (browser only).
 *
 * MediaPipe's Interactive Segmenter (the "magic touch" model) runs ON THE
 * GUEST'S PHONE: the photo never leaves the device to be cut out, there is no
 * server render and no per-cut cost. It is the same package and the same two
 * hosts `lib/face-gate.ts` already loads face matching from — the wasm runtime
 * from jsdelivr, the model from storage.googleapis.com — so the CSP already
 * names both (`the-csp-names-what-face-matching-loads.test.ts` reads this file
 * too, so moving either host fails that guard rather than a wedding).
 *
 * The model (~6 MB) and the runtime (~11 MB) download the first time a cut-out
 * is asked for, never on page load.
 */

import type { InteractiveSegmenter } from '@mediapipe/tasks-vision';
import { edgeAlpha, maskBounds, pickMaskAt, type Mask } from './scrapbook-layout';
import { makeCanvas } from './scrapbook-draw';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite';
const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';

/** The long edge the segmenter looks at. Bigger is slower and not visibly cleaner. */
export const CUT_WORK_PX = 768;

let segmenter: Promise<InteractiveSegmenter> | null = null;

/** Loads once; a failed load is forgotten so the next tap can try again. */
export function loadCutout(): Promise<InteractiveSegmenter> {
  if (segmenter) return segmenter;
  const p = (async () => {
    const { FilesetResolver, InteractiveSegmenter } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);
    return InteractiveSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
  })();
  segmenter = p;
  p.catch(() => {
    if (segmenter === p) segmenter = null;
  });
  return p;
}

export type CutGesture =
  | { kind: 'tap'; at: { x: number; y: number } }
  | { kind: 'scribble'; points: { x: number; y: number }[] };

/** One tap (or line) → one confidence mask at the work canvas's size. */
export async function findSubject(work: HTMLCanvasElement, gesture: CutGesture): Promise<Mask> {
  const seg = await loadCutout();
  const roi = gesture.kind === 'tap' ? { keypoint: gesture.at } : { scribble: gesture.points };
  const probe = gesture.kind === 'tap' ? gesture.at : gesture.points[Math.min(1, gesture.points.length - 1)]!;
  const result = seg.segment(work, roi);
  try {
    const masks = result.confidenceMasks ?? [];
    if (masks.length === 0) throw new Error('no_mask');
    const w = masks[0]!.width;
    const h = masks[0]!.height;
    const data = pickMaskAt(
      masks.map((m) => m.getAsFloat32Array()),
      w,
      h,
      probe,
    );
    return { data, w, h };
  } finally {
    result.close();
  }
}

/**
 * The cut-out itself: the full-size photo, cropped to the kept pixels, with the
 * mask as its alpha (smoothed up from the work size so the edge stays soft).
 * Null when the mask kept nothing.
 */
export function cutFromMask(photo: HTMLCanvasElement, mask: Mask): HTMLCanvasElement | null {
  const b = maskBounds(mask);
  if (!b) return null;
  const alpha = makeCanvas(mask.w, mask.h);
  const ag = alpha.getContext('2d');
  if (!ag) return null;
  const img = ag.createImageData(mask.w, mask.h);
  for (let i = 0, j = 0; i < mask.data.length; i++, j += 4) {
    img.data[j] = 255;
    img.data[j + 1] = 255;
    img.data[j + 2] = 255;
    img.data[j + 3] = Math.round(edgeAlpha(mask.data[i]!) * 255);
  }
  ag.putImageData(img, 0, 0);
  const sx = photo.width / mask.w;
  const sy = photo.height / mask.h;
  const pad = 4;
  const bx = Math.max(0, (b.x0 - pad) * sx);
  const by = Math.max(0, (b.y0 - pad) * sy);
  const bw = Math.min(photo.width, (b.x1 + pad + 1) * sx) - bx;
  const bh = Math.min(photo.height, (b.y1 + pad + 1) * sy) - by;
  const out = makeCanvas(bw, bh);
  const og = out.getContext('2d');
  if (!og) return null;
  og.drawImage(photo, bx, by, bw, bh, 0, 0, bw, bh);
  og.globalCompositeOperation = 'destination-in';
  og.imageSmoothingQuality = 'high';
  og.drawImage(alpha, bx / sx, by / sy, bw / sx, bh / sy, 0, 0, bw, bh);
  return out;
}
