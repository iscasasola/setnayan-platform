/**
 * 📲 GUEST PHONE UPLOADS — the rules that decide what a guest may add from their phone (guest upload v2, owner
 * 2026-11-13; rulings 2026-11-14 on #7607). Every case below is a sentence the owner said.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PHONE_CLIP_MAX_MS,
  PHONE_CLIP_MIN_MS,
  eventDaysOf,
  exifTakenWall,
  manilaDayOfMs,
  mvhdCreationMs,
  phoneClipBilledMs,
  phoneSelectionCost,
  phoneShotOnEventDay,
  pickVerdict,
  takenAtFromExif,
  takenAtFromMs,
} from './papic-phone-uploads';
import { papicCaptureCost } from './papic-cameras-pure';

/** A minimal JPEG with an APP1 Exif segment: IFD0 → ExifIFD → DateTimeOriginal (+ optional OffsetTimeOriginal). */
function jpegWithExif(dateTime: string, offset: string | null, littleEndian = true): Uint8Array {
  const tiff: number[] = [];
  const u16 = (v: number) => (littleEndian ? [v & 0xff, (v >> 8) & 0xff] : [(v >> 8) & 0xff, v & 0xff]);
  const u32 = (v: number) =>
    littleEndian
      ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff]
      : [(v >>> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0)).concat([0]);
  // Header: byte order, 42, IFD0 at 8.
  tiff.push(...(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8));
  // IFD0 (at 8): 1 entry — ExifIFD pointer → 26.
  tiff.push(...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0));
  // ExifIFD (at 26): DateTimeOriginal (+ OffsetTimeOriginal), values after the IFD.
  const n = offset ? 2 : 1;
  const valuesAt = 26 + 2 + n * 12 + 4;
  const dt = ascii(dateTime);
  tiff.push(...u16(n), ...u16(0x9003), ...u16(2), ...u32(dt.length), ...u32(valuesAt));
  const off = offset ? ascii(offset) : [];
  if (offset) tiff.push(...u16(0x9011), ...u16(2), ...u32(off.length), ...u32(valuesAt + dt.length));
  tiff.push(...u32(0), ...dt, ...off);
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = exif.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...exif, 0xff, 0xd9]);
}

/** A minimal moov/mvhd (version 0) carrying a creation time. */
function mvhdWithCreation(unixSeconds: number): Uint8Array {
  const mac = unixSeconds + 2_082_844_800;
  const b = new Uint8Array(8 + 8 + 100);
  const dv = new DataView(b.buffer);
  dv.setUint32(0, b.length);
  b.set([0x6d, 0x6f, 0x6f, 0x76], 4); // moov
  dv.setUint32(8, 108);
  b.set([0x6d, 0x76, 0x68, 0x64], 12); // mvhd
  dv.setUint32(16, 0); // version 0 + flags
  dv.setUint32(20, mac); // creation_time
  return b;
}

const DAY = eventDaysOf('2026-12-19', null)!;

test('a photo taken on the event day goes; one from another day is left out', () => {
  const on = takenAtFromExif(exifTakenWall(jpegWithExif('2026:12:19 16:12:00', null))!);
  const off = takenAtFromExif(exifTakenWall(jpegWithExif('2026:12:18 21:10:00', null))!);
  assert.equal(on?.day, '2026-12-19');
  assert.deepEqual(pickVerdict({ kind: 'photo', taken: on, days: DAY }), { go: true, trim: false });
  assert.deepEqual(pickVerdict({ kind: 'photo', taken: off, days: DAY }), { go: false, why: 'other_day' });
});

test('both byte orders, and the recorded offset decides the Manila day', () => {
  const be = exifTakenWall(jpegWithExif('2026:12:19 08:00:00', null, false));
  assert.equal(be?.wall, '2026-12-19T08:00:00');
  // 23:30 in Los Angeles on the 18th is the 19th in Manila.
  const la = takenAtFromExif(exifTakenWall(jpegWithExif('2026:12:18 23:30:00', '-08:00'))!);
  assert.equal(la?.day, '2026-12-19');
});

test('RULING 2 — no taken-date is not allowed (a screenshot, a forward): no "add anyway"', () => {
  assert.equal(exifTakenWall(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])), null);
  assert.deepEqual(pickVerdict({ kind: 'photo', taken: null, days: DAY }), { go: false, why: 'no_date' });
});

test('a video reads its taken-date from its own mvhd', () => {
  const at = Date.parse('2026-12-19T11:48:00Z'); // 7:48 pm Manila
  const ms = mvhdCreationMs(mvhdWithCreation(at / 1000));
  assert.equal(ms, at);
  assert.equal(takenAtFromMs(ms)?.day, '2026-12-19');
  assert.equal(mvhdCreationMs(mvhdWithCreation(-2_082_844_800)), null, 'an unset (zero) creation time is no date');
});

test('a video goes up at 3–10 s: under 3 is left out, over 10 must be trimmed', () => {
  const taken = { atMs: Date.parse('2026-12-19T11:00:00Z'), day: '2026-12-19' };
  assert.deepEqual(pickVerdict({ kind: 'clip', taken, days: DAY, durationMs: PHONE_CLIP_MIN_MS - 1 }), { go: false, why: 'too_short' });
  assert.deepEqual(pickVerdict({ kind: 'clip', taken, days: DAY, durationMs: 6_000 }), { go: true, trim: false });
  assert.deepEqual(pickVerdict({ kind: 'clip', taken, days: DAY, durationMs: 24_000 }), { go: true, trim: true });
  assert.deepEqual(pickVerdict({ kind: 'clip', taken, days: DAY, durationMs: null }), { go: false, why: 'unreadable' });
  assert.equal(phoneClipBilledMs(10_300), PHONE_CLIP_MAX_MS, 'never billed or recorded past the 10 s cap');
});

test('the price is the UPLOAD price, asked of the function the route charges with', () => {
  const photo = papicCaptureCost('photo', null, 'upload');
  assert.ok(photo > papicCaptureCost('photo', null, 'camera'), 'an upload costs more than a camera shot');
  assert.equal(
    phoneSelectionCost([{ kind: 'photo' }, { kind: 'clip', durationMs: 6_000 }]),
    photo + papicCaptureCost('clip', 6_000, 'upload'),
  );
});

test('the server judges the shot instant in Manila, across a multi-day event', () => {
  const two = eventDaysOf('2026-12-19', '2026-12-20')!;
  assert.equal(manilaDayOfMs(Date.parse('2026-12-18T16:30:00Z')), '2026-12-19');
  assert.ok(phoneShotOnEventDay(Date.parse('2026-12-20T15:00:00Z'), two));
  assert.ok(!phoneShotOnEventDay(Date.parse('2026-12-20T16:30:00Z'), two), '00:30 on the 21st, Manila');
  assert.ok(!phoneShotOnEventDay(Date.now(), null), 'no event date → nothing passes');
});

test('the route charges a phone upload at the upload price and gates it before anything else', () => {
  const src = readFileSync(join(process.cwd(), 'app/api/papic/guest-capture/route.ts'), 'utf8');
  assert.match(src, /isPhoneUpload\(body\) \? 'upload' : 'camera'/);
  assert.match(src, /papic_uploads_open === false\) return \{ res: json\(\{ error: 'uploads_closed' \}/);
  assert.match(src, /if \(held\) patch\.hidden_at = /, 'a held upload is born hidden in the first write');
  assert.match(src, /if \(!held\) await afterVisible/, 'a held upload never reaches the wall');
});
