/**
 * 🖼 THE INSPIRATION BOX IS OPEN TO EVERY TRADE (owner 2026-11-02, supplier gate: "creating services, service cards and
 * inspiration box"; audit G5 — it refused every shop whose trade supplies no inspiration part).
 *
 * Held, on the live rule (`libraryUploadVerdict`, `uploadableSlotsForShop`, `moodboardLibraryAccessForProfile`):
 *   1 · a shop whose services supply NO shelf is allowed in, offered every supplier shelf, and may upload into one;
 *   2 · a shop whose services DO supply a shelf keeps the trade rule — a gown designer is not offered the cake shelf;
 *   3 · a shelf no supplier fills (a part with no supplying trade, e.g. the palette) stays refused for everyone;
 *   4 · the upload and the import actually ask the library rule, and a couple's suggestion keeps the trade rule.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fallbackInspirationParts, partCategories, inspirationPart } from './inspiration-parts';
import { libraryUploadVerdict, slotUploadVerdict, uploadableSlotsForShop, shopSuppliesAnyShelf } from './moodboard-gallery-upload';
import { moodboardLibraryAccessForProfile } from './moodboard-library-access';
import { stripComments } from './strip-comments';
import type { VendorProfileRow } from './vendor-profile';

const parts = fallbackInspirationParts();
const NO_SHELF = ['lights_and_sounds_trade_with_no_part'];
const profile = (services: string[]) => ({ services }) as unknown as VendorProfileRow;

/** Every supplier shelf in the snapshot, as the slot list names them. */
const supplierShelves = uploadableSlotsForShop(NO_SHELF, parts).map((s) => s.key);

test('1 · a trade with no shelf is let in, offered every supplier shelf, and its upload is allowed', () => {
  assert.equal(shopSuppliesAnyShelf(NO_SHELF, parts), false);
  const access = moodboardLibraryAccessForProfile(profile(NO_SHELF), parts);
  assert.equal(access.allowed, true, 'the box must open for a trade that supplies no part yet');
  assert.ok(supplierShelves.length >= 3, `only ${supplierShelves.length} shelves offered — the fallback did not open`);
  for (const key of supplierShelves) {
    assert.equal(libraryUploadVerdict(key, NO_SHELF, parts).allowed, true, `${key} must accept the upload`);
    assert.equal(slotUploadVerdict(key, NO_SHELF, parts).allowed, false, `${key}: the strict trade rule is unchanged`);
  }
  // A shop with no services at all is the same case.
  assert.equal(moodboardLibraryAccessForProfile(profile([]), parts).allowed, true);
});

test('2 · a trade that supplies a shelf keeps the trade rule — not every shelf', () => {
  const gown = ['bridal_gown_custom'];
  assert.equal(shopSuppliesAnyShelf(gown, parts), true);
  const own = uploadableSlotsForShop(gown, parts).map((s) => s.key);
  assert.ok(own.length > 0 && own.length < supplierShelves.length, 'a gown designer must see its own shelves only');
  const foreign = supplierShelves.find((k) => !own.includes(k))!;
  assert.equal(libraryUploadVerdict(foreign, gown, parts).allowed, false, `a gown designer must not file under ${foreign}`);
});

test('3 · a shelf no supplier fills stays refused, even for a trade with no shelf', () => {
  const nobodys = parts.parts.map((p) => p.slotKey).filter((k) => partCategories(inspirationPart(parts, k)).length === 0);
  for (const key of nobodys) {
    assert.equal(libraryUploadVerdict(key, NO_SHELF, parts).allowed, false, `${key} has no supplying trade — never a shelf`);
    assert.ok(!supplierShelves.includes(key));
  }
});

test('4 · the library upload and import ask the library rule; a suggestion keeps the trade rule', () => {
  const src = stripComments(readFileSync(join(__dirname, '../app/vendor-dashboard/moodboard-library/actions.ts'), 'utf8'));
  const library = src.match(/libraryUploadVerdict\(/g)?.length ?? 0;
  assert.ok(library >= 2, `the upload and the import must both call libraryUploadVerdict (found ${library})`);
  assert.match(src, /slotUploadVerdict\(sugg\.slot_key/, 'a couple’s suggestion is still routed by the trade rule');
});
