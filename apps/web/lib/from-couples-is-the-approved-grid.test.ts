/**
 * from-couples-is-the-approved-grid.test.ts — "FROM COUPLES" LOOKS LIKE THE APPROVED DESIGN (2026-11-06).
 *
 * The design is the For Suppliers prototype approved on 6 Nov 2026 (`Setnayan-specs`,
 * `prototypes/for_suppliers_2026-11-06/index.html`, the "Photos from couples" sample gallery: `.sgal` / `.sgrid` /
 * `.vbm` / `.appr`). PR #7316 shipped the photos as a sideways strip of 96 px thumbnails with a 9 px terracotta mark
 * and the shop's answer as text rows with Approve · Decline under them — the owner's audit found it did not look like
 * the prototype. This pins the two halves to the design:
 *
 *   · the couple's card (`service-card-view.tsx`): a THREE-COLUMN grid of large square photos, the green
 *     "✓ Verified booking" pill ON the photo, at the public floor of 12 px (the design's 9.3 px is below it);
 *   · the shop's own view (`couple-photos-list.tsx`): the same grid, and the answer ON the photo — the white plate
 *     "Shared by the couple · Approve" — through the SHIPPED action (`couplePhotoShare`, op 'answer'), never a new one.
 *
 * Every assertion reads the code with comments stripped (a comment naming the rule must not satisfy it).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

/** The JSX between an anchor and the next `) : null}` — one conditional block. */
function block(src: string, anchor: string): string {
  const at = src.indexOf(anchor);
  assert.ok(at >= 0, `${anchor} is gone`);
  const end = src.indexOf(') : null}', at);
  assert.ok(end > at, `${anchor}'s block could not be read`);
  return src.slice(at, end);
}

/** Every `text-[Npx]` below the 12 px floor. */
const tiny = (src: string) => [...src.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)].map((m) => Number(m[1])).filter((n) => n < 12);

const CARD = read('app/_components/service-card-view.tsx');
// 12 Nov 2026 (ONE SERVICE CARD, EVERYWHERE): the card FACE no longer carries photos; "From couples" lives in the
// Service card grown, which the face opens. The grid's design is pinned there.
const GROWN = read('app/v/[slug]/_components/service-details-sheet.tsx');
const SHOP = read('app/vendor-dashboard/shop/_components/couple-photos-list.tsx');

test('▦ the couple’s card: "From couples" is a three-column grid of large square photos, not a strip of thumbnails', () => {
  const looks = block(GROWN, 'data-grown-couple-looks=""');
  assert.match(looks, /From couples/);
  assert.match(looks, /<ul className="[^"]*\bgrid grid-cols-3 gap-1\b[^"]*">/, 'the photos are not the design’s 3-column grid');
  assert.match(looks, /aspect-square[^"]*rounded-lg\b/, 'a photo is not the design’s square, rounded tile');
  assert.match(looks, /look\.verifiedBooking === true \? <VerifiedBookingMark \/> : null/, 'the mark is not drawn on the photo');
  assert.doesNotMatch(looks, /overflow-x-auto/, 'the photos went back to a sideways strip');
  assert.doesNotMatch(looks, /\b[hw]-24\b/, 'the photos went back to 96 px thumbnails');
  assert.deepEqual(tiny(looks), [], 'text below the 12 px public floor in "From couples"');
});

test('✓ the pill: green, on the photo, "✓ Verified booking", never below 12 px', () => {
  const at = CARD.indexOf('export function VerifiedBookingMark');
  assert.ok(at >= 0, 'VerifiedBookingMark is gone');
  const mark = CARD.slice(at, CARD.indexOf('\n}', at));
  assert.match(mark, /className="[^"]*\babsolute\b[^"]*\bbottom-1\b[^"]*\bleft-1\b/, 'the pill is not on the photo');
  assert.match(mark, /\bbg-cream\/95\b/, 'the pill lost its white plate (the design’s rgba(255,255,255,.92))');
  assert.match(mark, /\btext-\[rgb\(var\(--color-ok\)\)\]/, 'the pill is not the house ok-green (--color-ok)');
  assert.match(mark, /\btext-\[12px\]/, 'the pill is not at the 12 px floor');
  assert.deepEqual(tiny(mark), [], 'the pill dropped below 12 px');
  assert.match(mark, />\s*✓ Verified booking\s*</, 'the pill’s words changed');
});

test('▦ the shop’s own view: the same grid, the answer ON the photo — "Shared by the couple · Approve"', () => {
  assert.match(SHOP, /<ul className="grid grid-cols-3 gap-1" data-couple-photo-grid="">/, 'the shop’s photos are not the 3-column grid');
  assert.doesNotMatch(SHOP, /divide-y/, 'the shop’s answer went back to text rows');
  const plate = block(SHOP, "{r.state === 'waiting' ? (\n                <div");
  assert.match(plate, /absolute inset-x-1 bottom-1\b/, 'the approve plate is not on the photo');
  assert.match(plate, /data-couple-photo-answer=\{r\.shareId\}/);
  assert.match(plate, />Shared by the couple</, 'the plate lost "Shared by the couple"');
  assert.match(plate, /<ActionButton tone="brand" main icon=\{Check\} label="Approve"[^>]*onClick=\{\(\) => void act\(r, true\)\}/, 'Approve is not the plate’s filled verb');
  // Decline / Take off stay — the shop never loses the way to say no.
  assert.match(SHOP, /label="Decline"[^>]*onClick=\{\(\) => void act\(r, false\)\}/, 'Decline is gone');
  assert.match(SHOP, /label="Take off"[^>]*onClick=\{\(\) => void act\(r, false\)\}/, 'Take off is gone');
  assert.deepEqual(tiny(SHOP), [], 'text below 12 px in the shop’s grid');
});

test('🔌 the answer is the SHIPPED action — one op, no new door', () => {
  assert.match(SHOP, /await couplePhotoShare\(\{ op: 'answer', shareId: row\.shareId, approve \}\)/, 'the grid answers through something else');
  const server = read('app/vendor-dashboard/shop/_components/couple-photos.tsx');
  assert.match(server, /import \{ couplePhotoShare \} from '@\/app\/_actions\/couple-photo-share-actions';/);
  assert.match(server, /<CouplePhotosList photos=\{photos\} couplePhotoShare=\{couplePhotoShare\} \/>/, 'the page no longer hands the grid the shipped action');
});
