/**
 * 📁 A SUPPLIER'S FILES FOR ONE EVENT — pure rules (Piece 3b · DECISION_LOG 2026-11-12; prototype
 * `Build_Files_Hub_Forms_2026-11-12/quote-maker-polish.html` legend rows 139–143 · 149 · 150).
 *
 * Storage (migration 20271339773560): `supplier_media` = ONE stored copy per file per shop (content hash);
 * `event_supplier_files` = what the shop filed for one event, by group; the view `event_supplier_photos_listed` = the
 * ONE rule for what lists on the shop. Everything here mirrors that schema in plain data — no client, no DOM — so the
 * board, the actions and the tests read ONE copy of the words.
 */
import { formatCount } from '@/lib/format-number';

export type FileGroup = 'service' | 'booking' | 'linked' | 'unfiled' | 'links';
export type FileKind = 'photo' | 'video' | 'document' | 'link';
export type CoupleDecision = 'waiting' | 'shown' | 'hidden';

/** Photo and video build a SERVICE's collection; anything else is a document for "This booking". */
export function fileKindOf(mime: string | null | undefined, name = ''): Exclude<FileKind, 'link'> {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return 'photo';
  if (m.startsWith('video/')) return 'video';
  if (!m && /\.(jpe?g|png|webp|heic|gif|avif)$/i.test(name)) return 'photo';
  if (!m && /\.(mp4|mov|m4v|webm)$/i.test(name)) return 'video';
  return 'document';
}

/** "Upload new" asks first: for a service (photo/video → a quoted service) or for this booking (→ This booking). */
export const UPLOAD_FOR = [
  { key: 'service', label: 'For a service', line: 'A photo or a video — then pick which quoted service' },
  { key: 'booking', label: 'For this booking', line: 'A contract, PDF, menu or receipt — kept with this booking' },
] as const;

/** The day before → the day after the event (setup · event · teardown), Manila calendar days. */
export function photoWindowState(takenAt: string | null | undefined, eventDate: string | null | undefined): 'undated' | 'in' | 'out' {
  if (!takenAt) return 'undated';
  const t = new Date(takenAt);
  if (Number.isNaN(t.getTime()) || !eventDate) return 'out';
  const manilaDay = new Date(t.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
  const ev = new Date(`${eventDate}T00:00:00Z`);
  const lo = new Date(ev.getTime() - 86400_000).toISOString().slice(0, 10);
  const hi = new Date(ev.getTime() + 86400_000).toISOString().slice(0, 10);
  return manilaDay >= lo && manilaDay <= hi ? 'in' : 'out';
}

export type ShopState = 'waiting' | 'shown' | 'outside' | 'linked' | 'hidden';

/**
 * A photo's state on the shop, as the supplier reads it (legend 149). Mirrors the view exactly: a mapped or
 * already-stored copy is "linked" (never counts), out of the window is kept private whatever the couple says, then
 * the couple's choice.
 */
export function shopStateOf(
  f: { grp: FileGroup; counts: boolean; couple_decision: CoupleDecision; taken_at: string | null },
  eventDate: string | null,
): ShopState | null {
  if (f.grp === 'linked') return 'linked';
  if (f.grp !== 'service') return null;
  if (!f.counts) return 'linked';
  if (photoWindowState(f.taken_at, eventDate) === 'out') return 'outside';
  if (f.couple_decision === 'hidden') return 'hidden';
  if (f.couple_decision === 'shown') return 'shown';
  return 'waiting';
}

export function shopStateWords(s: ShopState, coupleName: string): string {
  switch (s) {
    case 'waiting':
      return `Waiting for ${coupleName}`;
    case 'shown':
      return 'Shown on your shop';
    case 'outside':
      return 'Not from this event’s dates · kept private';
    case 'linked':
      return 'Already in your portfolio · linked';
    case 'hidden':
      return 'Kept private · their choice';
  }
}

/** The (i) beside "On your shop" — the three rules in plain words. */
export const SHOP_RULES_LINE =
  'A photo lists on your shop as from this event only when the couple says yes, its own date is the day before to the day after the event (or it has no date), and the same photo is not already on your portfolio or another event.';

/** The Hub's "Event photos" count line: "2 waiting · 4 shown · 1 kept private · 3 linked". */
export function hubCountLine(states: readonly (ShopState | null)[]): string {
  const n = (k: ShopState | ShopState[]) => states.filter((s) => s !== null && (Array.isArray(k) ? k.includes(s) : s === k)).length;
  return [
    `${formatCount(n('waiting'))} waiting`,
    `${formatCount(n('shown'))} shown`,
    `${formatCount(n(['outside', 'hidden']))} kept private`,
    `${formatCount(n('linked'))} linked`,
  ].join(' · ');
}

// ── EXIF: the photo's OWN taken-date, read before upload (no library — one tag) ───────────────────────────────────
/**
 * `DateTimeOriginal` (0x9003) from a JPEG's APP1 EXIF block, as an ISO string. The tag carries no zone, so
 * `OffsetTimeOriginal` (0x9011) is used when present, else Manila (+08:00) — the platform's one calendar.
 * Returns null for anything that is not a JPEG with that tag (PNG, HEIC, a stripped photo): "no date on the photo".
 */
export function readExifTakenAt(buf: ArrayBuffer): string | null {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;
  let p = 2;
  while (p + 4 <= v.byteLength) {
    const marker = v.getUint16(p);
    const len = v.getUint16(p + 2);
    if (marker === 0xffe1 && p + 10 <= v.byteLength && v.getUint32(p + 4) === 0x45786966) {
      return readTiffDate(v, p + 10, Math.min(v.byteLength, p + 2 + len));
    }
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null;
    p += 2 + len;
  }
  return null;
}

function readTiffDate(v: DataView, tiff: number, end: number): string | null {
  if (tiff + 8 > end) return null;
  const little = v.getUint16(tiff) === 0x4949;
  const u16 = (o: number) => v.getUint16(o, little);
  const u32 = (o: number) => v.getUint32(o, little);
  const ascii = (o: number, n: number) => {
    let s = '';
    for (let i = 0; i < n && o + i < end; i++) {
      const c = v.getUint8(o + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  };
  const entries = (ifd: number) => {
    const out = new Map<number, { type: number; count: number; at: number }>();
    if (ifd + 2 > end) return out;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (e + 12 > end) break;
      out.set(u16(e), { type: u16(e + 2), count: u32(e + 4), at: e + 8 });
    }
    return out;
  };
  const str = (e: { count: number; at: number } | undefined) =>
    e ? (e.count <= 4 ? ascii(e.at, e.count) : ascii(tiff + u32(e.at), e.count)) : '';
  const ifd0 = entries(tiff + u32(tiff + 4));
  const exifPtr = ifd0.get(0x8769);
  if (!exifPtr) return null;
  const exif = entries(tiff + u32(exifPtr.at));
  const raw = str(exif.get(0x9003));
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(raw);
  if (!m) return null;
  const off = str(exif.get(0x9011));
  const zone = /^[+-]\d{2}:\d{2}$/.test(off) ? off : '+08:00';
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${zone}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}
