/**
 * 📦 DOWNLOAD ALL — ZIPS BY CHAPTER, IN ~2 GB NUMBERED PARTS. Pure, no I/O.
 *
 * ⚖ OWNER 2026-11-03 (DECISION_LOG "THE PHOTO RULE"): originals are kept until 3 months after the event's last day;
 * keep them by the free Google Drive sync or **Download all** — *"zips by chapter, ~2 GB numbered parts, count + sizes
 * shown up front, per-zip ✓"* (*"this is agreed upon"*).
 *
 * The plan is computed here from facts the server read (which photos the HOST sees, which chapters they sit in, each
 * file's measured size) and nothing else, so the page that SHOWS the parts and the route that BUILDS one can never
 * disagree: both call `planDownloadAll` on the same read.
 *
 *   · one zip set per chapter, in the chapters' own order, then "Unsorted" (a photo in no chapter — 2 Nov ruling 6);
 *   · a photo in two chapters is in both chapters' zips (each zip is that chapter, whole);
 *   · each set is cut into numbered parts of at most `PART_TARGET_BYTES`, in capture order; a single file larger than
 *     a part gets a part of its own (never split, never dropped);
 *   · sizes are the MEASURED bytes of the file that goes in (`orig_bytes` / `display_bytes` / `clip_web_bytes`, or the
 *     storage object's own size) — never an estimate. A photo is re-encoded without its location on the way out, so a
 *     part's real size is close to, not exactly, the figure shown: the page says "about".
 */

import { formatCount } from '@/lib/format-number';

/** The owner's "~2 GB" — 2 GiB, the largest a part may plan to be. */
export const PART_TARGET_BYTES = 2 * 1024 * 1024 * 1024;

/** The fixed key of the photos in no chapter. */
export const UNSORTED_KEY = 'unsorted';

export type DownloadFile = {
  /** capture_id / photo_id — stable, so a plan is reproducible. */
  id: string;
  kind: 'photo' | 'clip';
  /** The stored asset that goes into the zip (`r2://bucket/key`). */
  ref: string;
  /** Re-encode without location data before it leaves (a photo original). */
  needsStrip: boolean;
  ext: 'jpg' | 'avif' | 'mp4';
  /** ISO capture time — orders files inside a chapter. */
  at: string | null;
  /** Measured size of `ref`, in bytes. */
  bytes: number;
  /** The chapter ids the host sees this photo in (empty = Unsorted). */
  chapters: readonly string[];
};

export type DownloadChapter = { id: string; label: string };

export type DownloadPart = {
  /** The chapter id, or `UNSORTED_KEY`. */
  chapterKey: string;
  chapterLabel: string;
  /** 1-based. */
  part: number;
  /** How many parts this chapter has. */
  of: number;
  files: DownloadFile[];
  count: number;
  bytes: number;
};

export type DownloadPlan = {
  parts: DownloadPart[];
  /** Distinct photos and clips (a photo in two chapters counts once). */
  count: number;
  /** Bytes of every part added up (a photo in two chapters counts in both — it downloads twice). */
  bytes: number;
};

function byCaptureTime(a: DownloadFile, b: DownloadFile): number {
  const ta = a.at ? Date.parse(a.at) : Number.POSITIVE_INFINITY;
  const tb = b.at ? Date.parse(b.at) : Number.POSITIVE_INFINITY;
  if (ta !== tb) return ta - tb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Cut one chapter's files into parts of at most `target` bytes, in order. */
export function cutIntoParts(files: readonly DownloadFile[], target: number = PART_TARGET_BYTES): DownloadFile[][] {
  const parts: DownloadFile[][] = [];
  let current: DownloadFile[] = [];
  let size = 0;
  for (const f of files) {
    const b = Math.max(0, f.bytes);
    if (current.length > 0 && size + b > target) {
      parts.push(current);
      current = [];
      size = 0;
    }
    current.push(f);
    size += b;
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

export function planDownloadAll(
  files: readonly DownloadFile[],
  chapters: readonly DownloadChapter[],
  target: number = PART_TARGET_BYTES,
): DownloadPlan {
  const known = new Set(chapters.map((c) => c.id));
  const groups = new Map<string, DownloadFile[]>();
  for (const c of chapters) groups.set(c.id, []);
  groups.set(UNSORTED_KEY, []);
  for (const f of files) {
    const inKnown = f.chapters.filter((id) => known.has(id));
    if (inKnown.length === 0) groups.get(UNSORTED_KEY)!.push(f);
    for (const id of inKnown) groups.get(id)!.push(f);
  }
  const labels = new Map(chapters.map((c) => [c.id, c.label] as const));
  labels.set(UNSORTED_KEY, 'Unsorted');

  const parts: DownloadPart[] = [];
  for (const [key, list] of groups) {
    if (list.length === 0) continue;
    const cut = cutIntoParts([...list].sort(byCaptureTime), target);
    cut.forEach((chunk, i) => {
      parts.push({
        chapterKey: key,
        chapterLabel: labels.get(key) ?? 'A chapter',
        part: i + 1,
        of: cut.length,
        files: chunk,
        count: chunk.length,
        bytes: chunk.reduce((s, f) => s + Math.max(0, f.bytes), 0),
      });
    });
  }
  return {
    parts,
    count: new Set(files.map((f) => f.id)).size,
    bytes: parts.reduce((s, p) => s + p.bytes, 0),
  };
}

/** The part a request names, or null when the plan no longer has it (photos changed since the page was drawn). */
export function findPart(plan: DownloadPlan, chapterKey: string, part: number): DownloadPart | null {
  return plan.parts.find((p) => p.chapterKey === chapterKey && p.part === part) ?? null;
}

/**
 * A fingerprint of one part's contents — which files, how big. The page sends it back with the request, and the
 * route refuses a part whose fingerprint moved ("This part changed — refresh"), so a ✓ is always for the zip the
 * host saw listed. Not a secret; FNV-1a, 8 hex.
 */
export function partFingerprint(part: Pick<DownloadPart, 'files'>): string {
  let h = 0x811c9dc5;
  const s = part.files.map((f) => `${f.id}:${f.bytes}`).join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** "1.9 GB" · "412 MB" · "88 KB" — a size as a person reads it (1 GB = 1024³ bytes, like a phone's own storage). */
export function formatBytes(bytes: number): string {
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
  let v = Math.max(0, bytes);
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  const digits = u >= 3 && v < 10 ? 1 : 0;
  return `${v.toFixed(digits)} ${units[u]}`;
}

/** "412 photos and clips" · "1 photo" · "3 clips". */
export function formatFileCount(files: readonly Pick<DownloadFile, 'kind'>[]): string {
  const photos = files.filter((f) => f.kind === 'photo').length;
  const clips = files.length - photos;
  const n = (k: number, one: string, many: string) => `${k.toLocaleString('en-PH')} ${k === 1 ? one : many}`;
  if (clips === 0) return n(photos, 'photo', 'photos');
  if (photos === 0) return n(clips, 'clip', 'clips');
  return `${files.length.toLocaleString('en-PH')} photos and clips`;
}

/** The zip's file name: "Maria & Jose — Ceremony — part 1 of 2.zip" (characters a phone's files app refuses, removed). */
export function partFileName(eventName: string, part: Pick<DownloadPart, 'chapterLabel' | 'part' | 'of'>): string {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  const name = clean(eventName) || 'Setnayan';
  const chapter = clean(part.chapterLabel) || 'Photos';
  const of = part.of > 1 ? ` — part ${formatCount(part.part)} of ${formatCount(part.of)}` : '';
  return `${name} — ${chapter}${of}.zip`;
}

/** The name of one file inside a zip: capture day, its place in the part, and its id (never a guest's name). */
export function entryName(file: Pick<DownloadFile, 'id' | 'at' | 'ext'>, index: number): string {
  const day = (file.at ?? '').slice(0, 10) || 'photo';
  return `${day}-${String(index + 1).padStart(4, '0')}-${file.id}.${file.ext}`;
}

/**
 * WHICH FILE GOES INTO THE ZIP — moved here, unchanged, from the gallery-zip route so the one-zip route and the
 * chapter parts can never disagree (owner 2026-07-16 "Download all stays FULL-RESOLUTION"; RA 10173 — no location
 * data leaves the server):
 *   · a photo: its full-res original while it exists, re-encoded without metadata (`.jpg`); after the 3-month drop the
 *     720p web copy (`.avif`); a dropped flag with a key still recorded is stripped too, never served raw;
 *   · a clip: the raw video while it exists (`.mp4`), else its web copy.
 * Returns which stored size column measures the chosen file, so the plan's size is the real one.
 */
export type DownloadSource = Pick<DownloadFile, 'ref' | 'needsStrip' | 'ext'> & {
  measuredBy: 'orig_bytes' | 'display_bytes' | 'clip_web_bytes' | 'none';
};

export function pickDownloadSource(
  orig: string | null,
  display: string | null,
  dropped: string | null,
  isClip: boolean,
  clipWeb: string | null,
): DownloadSource | null {
  if (isClip) {
    // Raw clip while present; its size is not stored (orig_bytes is left NULL for clips), so storage is asked.
    if (orig && !dropped) return { ref: orig, needsStrip: false, ext: 'mp4', measuredBy: 'none' };
    if (clipWeb) return { ref: clipWeb, needsStrip: false, ext: 'mp4', measuredBy: 'clip_web_bytes' };
    if (orig) return { ref: orig, needsStrip: false, ext: 'mp4', measuredBy: 'none' };
    return null;
  }
  if (orig && !dropped) return { ref: orig, needsStrip: true, ext: 'jpg', measuredBy: 'orig_bytes' };
  if (display) return { ref: display, needsStrip: false, ext: 'avif', measuredBy: 'display_bytes' };
  if (orig) return { ref: orig, needsStrip: true, ext: 'jpg', measuredBy: 'orig_bytes' };
  return null;
}
