/**
 * 📁 PIECE 3b — a supplier's files for one event: the pure rules + the source anchors that keep the board honest.
 * The schema half (no copy on share · same hash counts once · window · approval · Hide) is
 * tests/db/a-supplier-files-an-event-under-its-quoted-services.db.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileKindOf, hubCountLine, photoWindowState, readExifTakenAt, shopStateOf, shopStateWords } from './supplier-files';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('photos and videos build a service; anything else is a document for This booking', () => {
  assert.equal(fileKindOf('image/jpeg'), 'photo');
  assert.equal(fileKindOf('video/mp4'), 'video');
  assert.equal(fileKindOf('application/pdf'), 'document');
  assert.equal(fileKindOf('', 'menu.docx'), 'document');
  assert.equal(fileKindOf('', 'IMG_1.HEIC'), 'photo');
});

test('the window is the day before → the day after, in Manila days; undated is its own answer', () => {
  const day = '2027-03-15';
  assert.equal(photoWindowState(null, day), 'undated');
  assert.equal(photoWindowState('2027-03-14T00:10:00+08:00', day), 'in');
  assert.equal(photoWindowState('2027-03-16T23:59:00+08:00', day), 'in');
  assert.equal(photoWindowState('2027-03-13T23:59:00+08:00', day), 'out');
  // 17:30 UTC on the 13th is 01:30 on the 14th in Manila — inside.
  assert.equal(photoWindowState('2027-03-13T17:30:00Z', day), 'in');
  assert.equal(photoWindowState('2027-03-15T10:00:00+08:00', null), 'out');
});

test('a photo’s state mirrors the view: linked never counts, outside beats the couple’s yes, then their choice', () => {
  const base = { grp: 'service' as const, counts: true, couple_decision: 'waiting' as const, taken_at: '2027-03-15T10:00:00+08:00' };
  assert.equal(shopStateOf(base, '2027-03-15'), 'waiting');
  assert.equal(shopStateOf({ ...base, couple_decision: 'shown' }, '2027-03-15'), 'shown');
  assert.equal(shopStateOf({ ...base, couple_decision: 'shown', taken_at: '2026-01-01T10:00:00+08:00' }, '2027-03-15'), 'outside');
  assert.equal(shopStateOf({ ...base, counts: false, couple_decision: 'shown' }, '2027-03-15'), 'linked');
  assert.equal(shopStateOf({ ...base, couple_decision: 'hidden' }, '2027-03-15'), 'hidden');
  assert.equal(shopStateOf({ ...base, grp: 'linked' }, '2027-03-15'), 'linked');
  assert.equal(shopStateOf({ ...base, grp: 'booking' }, '2027-03-15'), null);
  assert.equal(shopStateWords('waiting', 'Ana & Miguel'), 'Waiting for Ana & Miguel');
  assert.equal(hubCountLine(['waiting', 'shown', 'shown', 'outside', 'hidden', 'linked', null]), '1 waiting · 2 shown · 2 kept private · 1 linked');
});

/** A minimal JPEG: SOI · APP1 Exif · TIFF (II) · IFD0 → ExifIFD → DateTimeOriginal (+ optional OffsetTimeOriginal). */
function jpegWithDate(date: string, offset?: string): ArrayBuffer {
  const tiff: number[] = [];
  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0)).concat([0]);
  // header: II, 42, IFD0 at 8
  tiff.push(0x49, 0x49, ...u16(42), ...u32(8));
  // IFD0: 1 entry (ExifIFD pointer) → exif IFD at 8 + 2 + 12 + 4 = 26
  tiff.push(...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0));
  const entries = offset ? 2 : 1;
  const dataAt = 26 + 2 + entries * 12 + 4;
  const d = ascii(date);
  tiff.push(...u16(entries), ...u16(0x9003), ...u16(2), ...u32(d.length), ...u32(dataAt));
  const o = offset ? ascii(offset) : [];
  if (offset) tiff.push(...u16(0x9011), ...u16(2), ...u32(o.length), ...u32(dataAt + d.length));
  tiff.push(...u32(0), ...d, ...o);
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const bytes = [0xff, 0xd8, 0xff, 0xe1, ((app1.length + 2) >> 8) & 0xff, (app1.length + 2) & 0xff, ...app1, 0xff, 0xd9];
  return new Uint8Array(bytes).buffer;
}

test('EXIF: the photo’s own taken-date is read before upload; Manila when the photo names no zone', () => {
  assert.equal(readExifTakenAt(jpegWithDate('2027:03:15 18:42:07')), '2027-03-15T18:42:07+08:00');
  assert.equal(readExifTakenAt(jpegWithDate('2027:03:15 18:42:07', '-05:00')), '2027-03-15T18:42:07-05:00');
  assert.equal(readExifTakenAt(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer), null, 'a PNG has no date — "no date on the photo"');
  assert.equal(readExifTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer), null);
});

test('the board hashes BEFORE it uploads, so the same bytes are never uploaded twice', () => {
  const board = read('app/vendor-dashboard/clients/[eventId]/_components/event-files-board.tsx');
  const known = board.indexOf("kfd.set('op', 'known')");
  const upload = board.indexOf("fetch('/api/upload'");
  assert.ok(known > 0 && upload > known, 'the upload no longer asks “is this already stored?” first');
  assert.match(board, /crypto\.subtle\.digest\('SHA-256', buf\)/);
  assert.match(board, /if \(known\.status === 'known' && known\.mediaId\) \{\s*fd\.set\('media_id', known\.mediaId\);/, 'a known file is uploaded again');
});

test('the Hub shows the filed service groups only; Upload new asks For a service / For this booking first', () => {
  const board = read('app/vendor-dashboard/clients/[eventId]/_components/event-files-board.tsx');
  assert.match(board, /if \(p\.mode === 'hub' && !\(f\.grp === 'service' \|\| \(f\.grp === 'linked' && f\.serviceId && quotedIds\.has\(f\.serviceId\)\)\)\) return false;/, 'unfiled chat photos reach the Hub');
  assert.match(board, /uploadStep === 'for' \?\s*\(\s*UPLOAD_FOR\.map/, 'Upload new no longer asks what it is for first');
  const act = read('app/_actions/event-files-actions.ts');
  assert.match(act, /if \(grp === 'service' && kind === 'document'\) return/, 'a document can be filed under a service');
});

test('a share maps the shop’s OWN photos only, and the couple’s Hide posts a line in the supplier’s chat', () => {
  const act = read('app/_actions/event-files-actions.ts');
  assert.match(act, /\.filter\(\(r\) => own\.has\(r\)\)/, 'a “portfolio” ref from the phone is trusted without reading the shop’s own portfolio');
  assert.match(act, /grp: 'linked'/);
  assert.doesNotMatch(act.slice(act.indexOf("if (op === 'map')"), act.indexOf("if (op === 'filechat')")), /supplier_media/, 'a share wrote a stored copy');
  assert.match(act, /`\$\{who\} hid \$\{photos\} · taken off your shop`/);
});

test('the server measures the hash and the date from the bytes — never the phone’s word', () => {
  const act = read('app/_actions/event-files-actions.ts');
  const fileOp = act.slice(act.indexOf("if (op === 'file')"), act.indexOf("if (op === 'map')"));
  assert.match(fileOp, /r2GetBytes\(\{ bucket: at\.bucket, key: at\.key \}\)/, 'the stored copy is no longer read back');
  assert.match(fileOp, /sha = createHash\('sha256'\)\.update\(bytes\)\.digest\('hex'\)/);
  assert.match(fileOp, /takenAt = readExifTakenAt\(/);
  assert.doesNotMatch(fileOp, /fd\.get\('sha256'\)|fd\.get\('taken_at'\)/, 'the phone’s hash or date is trusted when storing a copy');
});
