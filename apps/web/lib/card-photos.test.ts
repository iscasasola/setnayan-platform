/**
 * 🖼 A CARD'S PHOTOS ARE ONE GALLERY — the list's rules (lib/card-photos.ts), owner 2026-11-13 (DECISION_LOG "CARD MAKER
 * GALLERY UPLOAD APPROVED"). The maker and the server share these, so they can never disagree about which photo is the
 * primary or how many a card holds.
 *
 *   · Set as primary SWAPS: the chosen photo goes first, the old primary moves into the showcase list.
 *   · Delete the primary PROMOTES the next photo (and says which).
 *   · The add tile is gone at the limit — and the limit is the DB CHECK's, read from the migration, plus the primary.
 *   · The server keeps a valid primary and the CHECK whatever is posted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CARD_MAX_PHOTOS,
  CARD_SHOWCASE_MAX_PHOTOS,
  canAddCardPhoto,
  cardPhotoCountLine,
  cardPhotoFields,
  cardPhotoOrder,
  deleteCardPhoto,
  mergeUploadedPhotos,
  setPrimaryPhoto,
} from './card-photos';

const MIGRATION = join(
  __dirname,
  '../../../supabase/migrations/20270502342558_vendor_service_card_pricing_media_discounts.sql',
);

test('the showcase limit IS the database CHECK — read from the migration, never re-typed', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  const m = sql.match(/CHECK\s*\(\s*cardinality\(\s*showcase_photo_r2_keys\s*\)\s*<=\s*(\d+)\s*\)/);
  assert.ok(m, 'the migration still holds the showcase cardinality CHECK');
  assert.equal(CARD_SHOWCASE_MAX_PHOTOS, Number(m[1]));
  assert.equal(CARD_MAX_PHOTOS, Number(m[1]) + 1, 'a card holds the primary + the showcase photos');
});

test('the shipped showcase uploader reads the same constant (no second 5)', () => {
  const src = readFileSync(join(__dirname, '../app/vendor-dashboard/services/_components/showcase-media-fields.tsx'), 'utf8');
  assert.match(src, /maxFiles=\{CARD_SHOWCASE_MAX_PHOTOS\}/);
  assert.doesNotMatch(src, /maxFiles=\{\d+\}/);
});

test('the grid order: the primary first, then the showcase; no blanks, no repeats', () => {
  assert.deepEqual(cardPhotoOrder('r2://a', ['r2://b', 'r2://c']), ['r2://a', 'r2://b', 'r2://c']);
  assert.deepEqual(cardPhotoOrder(null, ['r2://b', '', 'r2://b']), ['r2://b']);
  assert.deepEqual(cardPhotoOrder('r2://a', ['r2://a', 'r2://b']), ['r2://a', 'r2://b']);
  assert.deepEqual(cardPhotoOrder(null, undefined), []);
});

test('Set as primary SWAPS the keys — the old primary moves into the showcase list', () => {
  const order = ['r2://p', 'r2://b', 'r2://c', 'r2://d'];
  const next = setPrimaryPhoto(order, 'r2://c');
  assert.deepEqual(next, ['r2://c', 'r2://p', 'r2://b', 'r2://d']);
  const posted = cardPhotoFields(next[0], next.slice(1));
  assert.equal(posted.primary_photo_r2_key, 'r2://c');
  assert.ok(posted.showcase_photo_r2_keys.includes('r2://p'), 'the old primary is now a showcase photo');
  assert.ok(!posted.showcase_photo_r2_keys.includes('r2://c'), 'the new primary is not also in the showcase');
  assert.equal(posted.showcase_photo_r2_keys.length, order.length - 1, 'no photo was lost in the swap');
  // the primary itself, and a ref that is not there, change nothing
  assert.deepEqual(setPrimaryPhoto(order, 'r2://p'), order);
  assert.deepEqual(setPrimaryPhoto(order, 'r2://zz'), order);
});

test('Delete the primary PROMOTES the next photo, and says which', () => {
  const { order, promoted } = deleteCardPhoto(['r2://p', 'r2://b', 'r2://c'], 'r2://p');
  assert.deepEqual(order, ['r2://b', 'r2://c']);
  assert.equal(promoted, 'r2://b');
  assert.equal(cardPhotoFields(order[0], order.slice(1)).primary_photo_r2_key, 'r2://b');
});

test('Delete another photo promotes nobody; deleting the last photo leaves no primary', () => {
  assert.deepEqual(deleteCardPhoto(['r2://p', 'r2://b'], 'r2://b'), { order: ['r2://p'], promoted: null });
  assert.deepEqual(deleteCardPhoto(['r2://p'], 'r2://p'), { order: [], promoted: null });
  assert.deepEqual(deleteCardPhoto(['r2://p'], 'r2://zz'), { order: ['r2://p'], promoted: null });
});

test('the add tile is HIDDEN at the limit (the primary + 5) and returns after a delete', () => {
  for (let n = 0; n < CARD_MAX_PHOTOS; n++) assert.equal(canAddCardPhoto(n), true, `${n} photos: the add tile shows`);
  assert.equal(canAddCardPhoto(CARD_MAX_PHOTOS), false, 'full: the add tile is gone');
  assert.equal(canAddCardPhoto(CARD_MAX_PHOTOS - 1, 1), false, 'a photo on its way holds a slot');
  const full = Array.from({ length: CARD_MAX_PHOTOS }, (_, i) => `r2://${i}`);
  assert.equal(canAddCardPhoto(deleteCardPhoto(full, 'r2://3').order.length), true, 'delete one and it returns');
});

test('the count line is "N of 6 photos"', () => {
  assert.equal(cardPhotoCountLine(3), `3 of ${CARD_MAX_PHOTOS} photos`);
  assert.equal(cardPhotoCountLine(CARD_MAX_PHOTOS), `${CARD_MAX_PHOTOS} of ${CARD_MAX_PHOTOS} photos`);
});

test('the SERVER keeps a valid primary: showcase photos with no primary promote the first', () => {
  assert.deepEqual(cardPhotoFields(null, ['r2://b', 'r2://c']), {
    primary_photo_r2_key: 'r2://b',
    showcase_photo_r2_keys: ['r2://c'],
  });
  assert.deepEqual(cardPhotoFields(null, []), { primary_photo_r2_key: null, showcase_photo_r2_keys: [] });
});

test('the SERVER keeps the CHECK: never more than 5 showcase photos, the primary never repeated', () => {
  const many = Array.from({ length: 9 }, (_, i) => `r2://s${i}`);
  const out = cardPhotoFields('r2://p', ['r2://p', ...many]);
  assert.equal(out.primary_photo_r2_key, 'r2://p');
  assert.equal(out.showcase_photo_r2_keys.length, CARD_SHOWCASE_MAX_PHOTOS);
  assert.ok(!out.showcase_photo_r2_keys.includes('r2://p'));
  // with no primary posted, the promoted one does not count against the five
  const promoted = cardPhotoFields(null, many);
  assert.equal(promoted.primary_photo_r2_key, 'r2://s0');
  assert.equal(promoted.showcase_photo_r2_keys.length, CARD_SHOWCASE_MAX_PHOTOS);
});

test('the uploader’s set merges into the grid’s order: a swapped primary stays first, new photos append, gone ones leave', () => {
  assert.deepEqual(mergeUploadedPhotos(['r2://c', 'r2://a'], ['r2://a', 'r2://c', 'r2://n']), ['r2://c', 'r2://a', 'r2://n']);
  assert.deepEqual(mergeUploadedPhotos(['r2://c', 'r2://a'], ['r2://a']), ['r2://a']);
});

test('the save path reads both fields through the one list (actions.ts)', () => {
  const src = readFileSync(join(__dirname, '../app/vendor-dashboard/services/actions.ts'), 'utf8');
  assert.match(src, /function parsePrimaryPhoto\(formData: FormData\): string \| null \{\s*return parseCardPhotos\(formData\)\.primary_photo_r2_key;/);
  assert.match(src, /const \{ showcase_photo_r2_keys \} = parseCardPhotos\(formData\);/);
  assert.match(src, /return cardPhotoFields\(primary, showcase\);/);
  assert.doesNotMatch(src, /\.slice\(0, 5\)/, 'no second hand-typed showcase limit');
});
