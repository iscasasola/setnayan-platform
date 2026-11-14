/**
 * 📲 GUEST PHONE UPLOADS — the reads that need a browser: each picked file's taken-date, and a clip's length + first
 * frame. The rules they feed are pure, in `lib/papic-phone-uploads.ts`.
 *
 * Everything here reads the guest's own file ON THE PHONE. Nothing is sent until the guest presses Add.
 */
import { exifTakenWall, mvhdCreationMs, takenAtFromExif, takenAtFromMs, type TakenAt } from './papic-phone-uploads';

/** How much of a photo is read to find its EXIF: a JPEG's APP1 sits at the front; a HEIC's Exif item, near it. */
const PHOTO_HEAD_BYTES = 1024 * 1024;
/** The largest `moov` box read whole to find the creation time (a phone clip's is a few hundred KB). */
const MOOV_MAX_BYTES = 8 * 1024 * 1024;

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** The `moov` box of an MP4/MOV, found by walking the top-level boxes with small reads (it may sit at the end). */
async function moovBytes(file: File): Promise<Uint8Array | null> {
  let at = 0;
  for (let guard = 0; guard < 64 && at + 8 <= file.size; guard++) {
    const head = await bytesOf(file.slice(at, at + 16));
    const dv = new DataView(head.buffer);
    let size = dv.getUint32(0);
    const type = String.fromCharCode(head[4]!, head[5]!, head[6]!, head[7]!);
    if (size === 1 && head.length >= 16) size = Number(dv.getBigUint64(8));
    else if (size === 0) size = file.size - at;
    if (size < 8) return null;
    if (type === 'moov') return size <= MOOV_MAX_BYTES ? bytesOf(file.slice(at, at + size)) : null;
    at += size;
  }
  return null;
}

/** When was this file taken, as its own bytes say? Null = it carries no taken-date (a screenshot, a forward). */
export async function readTakenAt(file: File): Promise<TakenAt | null> {
  try {
    if (file.type.startsWith('video/') || /\.(mov|mp4|m4v)$/i.test(file.name)) {
      const moov = await moovBytes(file);
      return moov ? takenAtFromMs(mvhdCreationMs(moov)) : null;
    }
    const found = exifTakenWall(await bytesOf(file.slice(0, PHOTO_HEAD_BYTES)));
    return found ? takenAtFromExif(found) : null;
  } catch {
    return null;
  }
}

export function isClipFile(file: File): boolean {
  return file.type.startsWith('video/') || /\.(mov|mp4|m4v|webm)$/i.test(file.name);
}

/** A clip's length and a still from it (the poster the safety screen reads). Null when this browser cannot decode it. */
export async function probeClip(file: Blob, atS = 0.1): Promise<{ durationMs: number; poster: Blob } | null> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    await new Promise<void>((resolve, reject) => {
      v.onloadeddata = () => resolve();
      v.onerror = () => reject(new Error('decode'));
      setTimeout(() => reject(new Error('timeout')), 15_000);
    });
    const durationMs = Number.isFinite(v.duration) ? Math.round(v.duration * 1000) : NaN;
    if (!Number.isFinite(durationMs)) return null;
    // A hair in: frame 0 of a phone recording is often black.
    v.currentTime = Math.min(Math.max(0, atS), Math.max(0, v.duration - 0.05));
    await new Promise<void>((resolve) => {
      v.onseeked = () => resolve();
      setTimeout(resolve, 2000);
    });
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    if (!canvas.width || !canvas.height) return null;
    canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height);
    const poster = await new Promise<Blob | null>((r) => canvas.toBlob((b) => r(b), 'image/jpeg', 0.85));
    return poster ? { durationMs, poster } : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
