/**
 * ONE lazy door for a supplier upload's mark (Seal and plate, owner-approved 2026-11-04).
 *
 * FileUpload `import()`s THIS module — never the parts — and only after a file is picked with `mark` set, so
 * the mark pipeline (asking the server what to stamp, painting the photo, burning the clip, the private clean
 * copy and its pairing) is NOT in FileUpload's own chunk. 🔑 Why it matters: about a dozen Maker panels
 * import FileUpload eagerly, so every byte written inline in `uploadOne` lands in the Maker's FIRST load
 * (`scripts/check-maker-js-budget.mjs`); #7246 wrote it inline and went 0.5 KB over that budget. Why ONE
 * door: every separate lazy chunk is one more entry in the webpack runtime that EVERY page loads, and the
 * shared bundle has almost no room (`scripts/check-bundle-size.mjs`).
 *
 * 🔒 FAIL-CLOSED. Nothing here catches: every failure THROWS, and FileUpload turns any throw into a refused
 * tile with Try again (`refuseUnmarked`). A function here that returned the unmarked original would publish
 * a supplier photo with every artefact of success around it — the exact bug this slice removed.
 */
import { photoMark } from './photo-mark-actions';
import type { PhotoMarkInput } from '@/lib/watermark';
import { uploadTypeOf } from '@/lib/upload-type-names';

export type MarkKind = 'supplier' | 'setnayan';
export type Optimizing = { label: string; pct: number } | null;

/** A refusal the person is told in the server's own words. */
export class MarkRefused extends Error {
  constructor(says: string) {
    super(says);
    // FileUpload tells a refusal by this name (it never imports this module eagerly, so no `instanceof`).
    this.name = 'MarkRefused';
  }
}

const isImage = (t: string) => t.startsWith('image/');
const isVideo = (t: string) => t.startsWith('video/');

/** What to stamp, decided on the SERVER from the shop the login is standing in — never from props. */
async function askMark(kind: MarkKind, pathPrefix: string): Promise<PhotoMarkInput> {
  const answer = await photoMark('mark', { kind, pathPrefix });
  if (!answer.ok) throw new MarkRefused(answer.error);
  return { spec: answer.spec, logoDataUrl: answer.logoDataUrl };
}

/**
 * The marked file: a photo painted with the Seal and plate, or a clip re-encoded at 720p with it burned in.
 * Anything else comes back untouched (a PDF is never marked). THROWS on any failure.
 */
export async function markFile(
  rawFile: File,
  opts: { kind: MarkKind; pathPrefix: string; contentType: string; maxVideoDurationS?: number; onOptimizing: (o: Optimizing) => void },
): Promise<File> {
  const { kind, pathPrefix, contentType } = opts;
  if (!isImage(contentType) && !isVideo(contentType)) return rawFile;
  const input = await askMark(kind, pathPrefix);
  if (isImage(contentType)) {
    const { markPhotoFile } = await import('@/lib/watermark');
    return markPhotoFile(rawFile, input);
  }
  // The marked clip: `markAndCompressVideo` throws rather than hand back the unmarked original
  // that `compressVideoForWeb` would.
  const [{ markAndCompressVideo }, { markOverlayPng }] = await Promise.all([import('@/lib/video-compress'), import('@/lib/watermark')]);
  const label = 'Preparing your clip · adding the Setnayan mark';
  opts.onOptimizing({ label, pct: 0 });
  try {
    return await markAndCompressVideo(rawFile, {
      markPng: (w, h) => markOverlayPng(w, h, input),
      maxDurationS: opts.maxVideoDurationS,
      onProgress: (p) => opts.onOptimizing({ label, pct: Math.round(p.ratio * 100) }),
    });
  } finally {
    opts.onOptimizing(null);
  }
}

/**
 * THE PRIVATE CLEAN COPY of a supplier photo — PUT before the public copy, so a public copy never exists
 * without its original. Same web size as the public copy (the re-mark job re-stamps from it), into
 * `vendor-originals/<shop>/` in the PRIVATE verification bucket, which `/api/upload` only lets that shop
 * write. Returns its r2:// ref. THROWS on any failure.
 */
export async function keepCleanCopy(
  rawFile: File,
  opts: { pathPrefix: string; contentType: string; compressImage: boolean; stallMs: number; responseMs: number; onStall: () => void },
): Promise<string> {
  const shopId = /^vendors\/([^/]+)/.exec(opts.pathPrefix)?.[1] ?? null;
  if (!shopId) throw new Error(`no shop in pathPrefix ${opts.pathPrefix}`);
  const [{ compressImageForWeb }, { sendToStorage }] = await Promise.all([import('@/lib/image-compress'), import('@/lib/upload-send')]);
  const clean = opts.compressImage ? await compressImageForWeb(rawFile) : rawFile;
  const out = await sendToStorage(
    { file: clean, bucket: 'vendor-verification', pathPrefix: `vendor-originals/${shopId}`, contentType: uploadTypeOf(clean.type) || opts.contentType },
    { stallMs: opts.stallMs, responseMs: opts.responseMs, onProgress: () => {}, onStall: opts.onStall },
  ).done;
  if (!out.ok) throw new Error(`original copy refused at ${out.step}`);
  return out.r2Ref;
}

/**
 * Pair the marked public copy with its clean copy BEFORE it joins the value: a public photo the shop could
 * never re-mark is refused like an unmarked one. THROWS (MarkRefused) when the server refuses.
 */
export async function pairWithOriginal(publicRef: string, originalRef: string): Promise<void> {
  const paired = await photoMark('pair', { publicRef, originalRef });
  if (!paired.ok) throw new MarkRefused(paired.error);
}
