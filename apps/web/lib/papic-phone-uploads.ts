/**
 * 📲 GUEST PHONE UPLOADS — the rules, pure (guest upload v2; owner 2026-11-13, rulings 2026-11-14 on #7607).
 *
 * A guest picks photos and videos from their phone's gallery and adds them to the event. What decides what may go:
 *
 *   1 · ONLY THE EVENT DAY. A browser cannot filter the phone's picker by date, so the guest picks freely and the
 *       phone reads each file's own TAKEN-DATE after the pick — a photo's EXIF `DateTimeOriginal`, a video's MP4/MOV
 *       `mvhd` creation time. A file taken on another day is left out and named in one line.
 *   2 · NO TAKEN-DATE → NOT ALLOWED (ruling 2, 14 Nov). Screenshots and photos forwarded over chat carry none; they are
 *       left out with no "add anyway". `null` from the readers below means exactly that.
 *   3 · A VIDEO GOES UP AT 3–10 SECONDS (owner 13 Nov: "Max of 10 seconds minimum of 3 seconds"). A longer one is
 *       trimmed ON THE PHONE (ruling 3) so only the chosen part is sent and charged; one under 3 s is left out.
 *   4 · THE PRICE IS THE UPLOAD PRICE — `papicCaptureCost(kind, ms, 'upload')`, the camera price ×
 *       PAPIC_UPLOAD_MULTIPLIER, the SAME function both capture routes bill with. No number is typed here.
 *
 * The server judges rule 1 again on every shot (`phoneShotOnEventDay`, app/api/papic/guest-capture/route.ts) — the
 * screen is a courtesy, the route is the gate.
 */
import { papicCaptureCost } from './papic-cameras-pure';
import { PAPIC_TZ_OFFSET } from './papic-window';

/** Owner 2026-11-13: "Max of 10 seconds minimum of 3 seconds" — a clip goes up at 3 to 10 seconds. */
export const PHONE_CLIP_MIN_MS = 3_000;
export const PHONE_CLIP_MAX_MS = 10_000;
/** A container rounds a 10.0 s recording up a hair; the same tolerance the capture route's 10 s cap is read with. */
export const PHONE_CLIP_TOLERANCE_MS = 400;

/** The `source` a phone upload carries on every call to the guest-capture route. */
export const PHONE_UPLOAD_SOURCE = 'phone' as const;

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000; // PAPIC_TZ_OFFSET — Asia/Manila has no DST.

/** The Manila calendar date (YYYY-MM-DD) of an instant. */
export function manilaDayOfMs(ms: number): string {
  return new Date(ms + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

/** When a file was taken, as far as its own bytes say. */
export type TakenAt = { atMs: number; day: string };

// ── EXIF (a JPEG's APP1, or the Exif item inside a HEIC — both carry "Exif\0\0" + a TIFF header) ───────────────────

function findExifTiff(bytes: Uint8Array): number {
  for (let i = 0; i + 10 < bytes.length; i++) {
    if (
      bytes[i] === 0x45 && bytes[i + 1] === 0x78 && bytes[i + 2] === 0x69 && bytes[i + 3] === 0x66 &&
      bytes[i + 4] === 0 && bytes[i + 5] === 0
    ) {
      const t = i + 6;
      const ii = bytes[t] === 0x49 && bytes[t + 1] === 0x49 && bytes[t + 2] === 0x2a && bytes[t + 3] === 0;
      const mm = bytes[t] === 0x4d && bytes[t + 1] === 0x4d && bytes[t + 2] === 0 && bytes[t + 3] === 0x2a;
      if (ii || mm) return t;
    }
  }
  return -1;
}

function asciiAt(bytes: Uint8Array, at: number, len: number): string | null {
  if (at < 0 || at + len > bytes.length) return null;
  let s = '';
  for (let k = 0; k < len; k++) {
    const c = bytes[at + k]!;
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

/**
 * Pure: the EXIF `DateTimeOriginal` (falling back to `DateTimeDigitized`) and its `OffsetTimeOriginal`, if these bytes
 * hold one. Never the plain `DateTime` (0x0132) — that is when a file was last SAVED, which an edit or a forward moves.
 */
export function exifTakenWall(bytes: Uint8Array): { wall: string; offset: string | null } | null {
  const t = findExifTiff(bytes);
  if (t < 0) return null;
  const le = bytes[t] === 0x49;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (o: number) => (o + 2 <= bytes.length ? dv.getUint16(o, le) : -1);
  const u32 = (o: number) => (o + 4 <= bytes.length ? dv.getUint32(o, le) : -1);

  const readIfd = (ifdAt: number): Map<number, number> => {
    const out = new Map<number, number>(); // tag → the entry's own offset
    const n = u16(ifdAt);
    if (n < 0 || n > 512) return out;
    for (let k = 0; k < n; k++) {
      const e = ifdAt + 2 + k * 12;
      if (e + 12 > bytes.length) break;
      out.set(u16(e), e);
    }
    return out;
  };
  const asciiValue = (entry: number | undefined): string | null => {
    if (entry === undefined) return null;
    const count = u32(entry + 4);
    if (count <= 0 || count > 64) return null;
    const at = count <= 4 ? entry + 8 : t + u32(entry + 8);
    return asciiAt(bytes, at, count);
  };

  const ifd0 = t + u32(t + 4);
  const exifPtr = readIfd(ifd0).get(0x8769);
  if (exifPtr === undefined) return null;
  const exif = readIfd(t + u32(exifPtr + 8));
  const raw = asciiValue(exif.get(0x9003)) ?? asciiValue(exif.get(0x9004));
  const m = raw ? /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim()) : null;
  if (!m || m[1] === '0000') return null;
  const wall = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
  const off = asciiValue(exif.get(0x9011));
  const offset = off && /^[+-]\d{2}:\d{2}$/.test(off.trim()) ? off.trim() : null;
  return { wall, offset };
}

/**
 * Pure: an EXIF wall-clock time as an instant + the day. A camera writes its LOCAL wall clock; with no offset recorded
 * the photo is read as taken in the event's own zone (Manila), which is the day the guest saw on their phone.
 */
export function takenAtFromExif(found: { wall: string; offset: string | null }): TakenAt | null {
  const atMs = Date.parse(`${found.wall}${found.offset ?? PAPIC_TZ_OFFSET}`);
  if (!Number.isFinite(atMs)) return null;
  return { atMs, day: found.offset ? manilaDayOfMs(atMs) : found.wall.slice(0, 10) };
}

// ── MP4 / MOV — the `mvhd` creation time (seconds since 1904-01-01 UTC) ─────────────────────────────────────────────

const MAC_EPOCH_OFFSET_S = 2_082_844_800; // 1904-01-01 → 1970-01-01

/** Pure: the creation instant in an `mvhd` box somewhere in these bytes. Zero (unset) → null. */
export function mvhdCreationMs(bytes: Uint8Array): number | null {
  for (let i = 4; i + 24 <= bytes.length; i++) {
    if (bytes[i] !== 0x6d || bytes[i + 1] !== 0x76 || bytes[i + 2] !== 0x68 || bytes[i + 3] !== 0x64) continue;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const version = bytes[i + 4];
    const p = i + 8;
    const secs = version === 1 ? Number(dv.getBigUint64(p)) : dv.getUint32(p);
    if (!secs || secs <= MAC_EPOCH_OFFSET_S) return null;
    return (secs - MAC_EPOCH_OFFSET_S) * 1000;
  }
  return null;
}

export function takenAtFromMs(atMs: number | null): TakenAt | null {
  return atMs !== null && Number.isFinite(atMs) ? { atMs, day: manilaDayOfMs(atMs) } : null;
}

// ── The event day(s) ────────────────────────────────────────────────────────────────────────────────────────────────

/** The event's days as Manila dates — `event_date` through `event_end_date` (a one-day event: first = last). */
export type EventDays = { first: string; last: string };

export function eventDaysOf(eventDate: string | null | undefined, eventEndDate: string | null | undefined): EventDays | null {
  const first = typeof eventDate === 'string' ? eventDate.slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(first)) return null;
  const end = typeof eventEndDate === 'string' ? eventEndDate.slice(0, 10) : '';
  const last = /^\d{4}-\d{2}-\d{2}$/.test(end) && end >= first ? end : first;
  return { first, last };
}

/** Was this taken on the event's day(s)? Dates compare as strings (YYYY-MM-DD). */
export function onEventDay(day: string, days: EventDays): boolean {
  return day >= days.first && day <= days.last;
}

/** Server: is this shot instant (the phone's taken-time, judged by `judgedShotInstant`) on the event's day(s)? */
export function phoneShotOnEventDay(shotAtMs: number, days: EventDays | null): boolean {
  if (!days) return false;
  return onEventDay(manilaDayOfMs(shotAtMs), days);
}

// ── One picked file's verdict ─────────────────────────────────────────────────────────────────────────────────────────

export type PickVerdict =
  | { go: true; trim: false }
  /** A clip longer than 10 s — it goes only once trimmed on the phone. */
  | { go: true; trim: true }
  | { go: false; why: 'no_date' | 'other_day' | 'too_short' | 'unreadable' };

/** Pure: may this file go, as read? `durationMs` for a clip; null when its length could not be measured. */
export function pickVerdict(input: {
  kind: 'photo' | 'clip';
  taken: TakenAt | null;
  days: EventDays;
  durationMs?: number | null;
}): PickVerdict {
  if (!input.taken) return { go: false, why: 'no_date' };
  if (!onEventDay(input.taken.day, input.days)) return { go: false, why: 'other_day' };
  if (input.kind === 'photo') return { go: true, trim: false };
  const ms = input.durationMs;
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return { go: false, why: 'unreadable' };
  if (ms < PHONE_CLIP_MIN_MS) return { go: false, why: 'too_short' };
  if (ms > PHONE_CLIP_MAX_MS + PHONE_CLIP_TOLERANCE_MS) return { go: true, trim: true };
  return { go: true, trim: false };
}

/** The length a clip is billed and recorded at — never above the 10 s cap the route enforces. */
export function phoneClipBilledMs(durationMs: number): number {
  return Math.max(PHONE_CLIP_MIN_MS, Math.min(PHONE_CLIP_MAX_MS, Math.round(durationMs)));
}

/** What these go-files spend together — each priced by the server's own function at the upload price. */
export function phoneSelectionCost(items: readonly { kind: 'photo' | 'clip'; durationMs?: number | null }[]): number {
  return items.reduce(
    (sum, it) => sum + papicCaptureCost(it.kind, it.kind === 'clip' ? phoneClipBilledMs(it.durationMs ?? PHONE_CLIP_MAX_MS) : null, 'upload'),
    0,
  );
}

/** "Dec 19" / "Dec 19–20" — the day(s) in the sheet's words. */
export function eventDaysWords(days: EventDays): string {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00${PAPIC_TZ_OFFSET}`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
  return days.first === days.last ? fmt(days.first) : `${fmt(days.first)}–${fmt(days.last)}`;
}

/** The phone-side state of a couple's choice. */
export type PhoneUploadsMode = 'live' | 'held';

/** One guest phone upload waiting for the couple's check (read in `papic-phone-uploads.server.ts`). */
export type WaitingPhoneUpload = {
  captureId: string;
  who: string;
  at: string;
  media: 'photo' | 'clip';
  durationMs: number | null;
  url: string | null;
};
