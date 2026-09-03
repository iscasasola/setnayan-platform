/**
 * moodboard-gallery.test.ts — the slot→trade LOOKUP, the server-side cap, and
 * the two rules that decide whether a supplier photo may be shown at all.
 *
 * Every assertion here is about a rule, not about today's list: the map is
 * checked for the properties it must hold (exhaustive, tile-typed, derived
 * canonicals, an honest empty) rather than re-typing the eighteen rows, which
 * would make the test a second copy of the thing it guards.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { MOODBOARD_SLOT_KEYS } from './moodboard-slots';
import { WEDDING_TILE_LABEL } from './taxonomy';
import { canonicalServicesForTile } from './vendor-counts';
import {
  GALLERY_MAX_LIMIT,
  GALLERY_MAX_OFFSET,
  GALLERY_PAGE_SIZE,
  GALLERY_SLOT_KEYS,
  MOODBOARD_SLOT_TRADES,
  canonicalServicesForSlot,
  creditLine,
  normalizeGalleryQuery,
  shapeGalleryPage,
  slotHasSupplierTrade,
  tallySavedGalleryPhotos,
  tradeLabelForCredit,
  tradesForSlot,
  type RawGalleryRow,
} from './moodboard-gallery';

/* ── the map is a lookup over the taxonomy, not a new vocabulary ────────── */

test('every inspiration slot is classified — the Record is the mechanism', () => {
  for (const slot of MOODBOARD_SLOT_KEYS) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(MOODBOARD_SLOT_TRADES, slot),
      `${slot} has no entry — a new slot must be classified, not defaulted`,
    );
  }
  assert.equal(
    Object.keys(MOODBOARD_SLOT_TRADES).length,
    MOODBOARD_SLOT_KEYS.length,
    'the map carries an entry the slot vocabulary does not — one of them is stale',
  );
});

test('every trade named is a REAL taxonomy tile with a label', () => {
  for (const [slot, tiles] of Object.entries(MOODBOARD_SLOT_TRADES)) {
    for (const tile of tiles) {
      assert.ok(
        WEDDING_TILE_LABEL[tile],
        `${slot} → ${tile} has no label in WEDDING_TILE_LABEL`,
      );
    }
  }
});

test('a tile that resolves to NO canonical service would silently empty a picker', () => {
  // The picker's pool is the trades' canonicals. A tile with none is a shelf
  // no shop can ever stock, and it would look exactly like "nobody uploaded".
  for (const [slot, tiles] of Object.entries(MOODBOARD_SLOT_TRADES)) {
    for (const tile of tiles) {
      assert.ok(
        canonicalServicesForTile(tile).length > 0,
        `${slot} → ${tile} covers zero canonical services`,
      );
    }
  }
});

test('`palette` has NO supplying trade, and that is the honest answer', () => {
  assert.deepEqual(MOODBOARD_SLOT_TRADES.palette, []);
  assert.equal(slotHasSupplierTrade('palette'), false);
  assert.equal(canonicalServicesForSlot('palette').length, 0);
  assert.ok(!GALLERY_SLOT_KEYS.includes('palette'));
});

test('GALLERY_SLOT_KEYS is DERIVED from the map, never listed', () => {
  const expected = MOODBOARD_SLOT_KEYS.filter((k) => MOODBOARD_SLOT_TRADES[k].length > 0);
  assert.deepEqual([...GALLERY_SLOT_KEYS], [...expected]);
  assert.ok(GALLERY_SLOT_KEYS.includes('flowers'));
  assert.ok(GALLERY_SLOT_KEYS.includes('cake'));
});

test('canonicalServicesForSlot derives from the tiles and de-dupes', () => {
  const flowers = canonicalServicesForSlot('flowers');
  assert.deepEqual(flowers, canonicalServicesForTile('florist'));
  // `bride` names three tiles that overlap on the Filipiniana canonicals.
  const bride = canonicalServicesForSlot('bride');
  assert.equal(new Set(bride).size, bride.length, 'duplicates leaked through');
  for (const tile of tradesForSlot('bride')) {
    for (const c of canonicalServicesForTile(tile)) assert.ok(bride.includes(c));
  }
});

test('an unknown slot key gets an empty answer, never a guessed one', () => {
  assert.deepEqual([...tradesForSlot('not_a_slot')], []);
  assert.equal(slotHasSupplierTrade('not_a_slot'), false);
});

/* ── the credit line ───────────────────────────────────────────────────── */

test('the trade label comes from the SHOP’s services, not from the slot', () => {
  const floristCanonical = canonicalServicesForTile('florist')[0]!;
  assert.equal(tradeLabelForCredit('flowers', [floristCanonical]), 'Florist');
});

test('⭐ a shop whose trades do not reach the slot gets NO label — never the slot’s first tile', () => {
  // The exact fabrication this refuses: a caterer's photo sitting in `flowers`
  // must not read "· Florist" just because of where it was filed.
  const cateringCanonical = canonicalServicesForTile('catering')[0]!;
  assert.equal(tradeLabelForCredit('flowers', [cateringCanonical]), null);
  assert.equal(creditLine('Bloom & Vine', null), 'Bloom & Vine');
});

test('no services at all → the name alone, which is true', () => {
  assert.equal(tradeLabelForCredit('flowers', []), null);
  assert.equal(tradeLabelForCredit('flowers', null), null);
});

test('the slot’s ORDER decides which of several matched trades is printed', () => {
  // `table` is ['stylist_decorator', 'florist'] — a shop that is both is
  // credited as the stylist, because a stylist dresses the table.
  const stylist = canonicalServicesForTile('stylist_decorator')[0]!;
  const florist = canonicalServicesForTile('florist')[0]!;
  assert.equal(tradeLabelForCredit('table', [florist, stylist]), 'Stylist / Decorator');
});

test('creditLine joins with a middot and survives a blank name', () => {
  assert.equal(creditLine('Bloom & Vine', 'Florist'), 'Bloom & Vine · Florist');
  assert.equal(creditLine('  ', 'Florist'), 'Florist');
});

/* ── the cap. The unbounded query is the thing this session was warned about ── */

test('⭐ THE CAP · a caller asking for a million rows gets GALLERY_MAX_LIMIT', () => {
  const q = normalizeGalleryQuery({ slotKey: 'flowers', limit: 1_000_000 });
  assert.equal(q?.limit, GALLERY_MAX_LIMIT);
});

test('⭐ THE CAP · offset is clamped too, so "show more" cannot walk forever', () => {
  const q = normalizeGalleryQuery({ slotKey: 'flowers', offset: 9_999_999 });
  assert.equal(q?.offset, GALLERY_MAX_OFFSET);
});

test('⭐ THE CAP · a MISSING limit is still a limit', () => {
  // The failure mode that mattered: `limit` absent meaning "no limit".
  const q = normalizeGalleryQuery({ slotKey: 'flowers' });
  assert.equal(q?.limit, GALLERY_PAGE_SIZE);
  assert.equal(q?.offset, 0);
});

test('garbage limits and offsets fall back, never through', () => {
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, 'lots', null, {}]) {
    const q = normalizeGalleryQuery({ slotKey: 'flowers', limit: bad, offset: bad });
    assert.ok(q, `rejected the slot over a bad limit: ${String(bad)}`);
    assert.ok(q!.limit >= 1 && q!.limit <= GALLERY_MAX_LIMIT, String(bad));
    assert.ok(q!.offset >= 0 && q!.offset <= GALLERY_MAX_OFFSET, String(bad));
  }
  assert.equal(normalizeGalleryQuery({ slotKey: 'flowers', limit: -5 })?.limit, 1);
  assert.equal(normalizeGalleryQuery({ slotKey: 'flowers', offset: -5 })?.offset, 0);
});

test('a slot with no supplying trade is REFUSED, not queried empty', () => {
  assert.equal(normalizeGalleryQuery({ slotKey: 'palette' }), null);
  assert.equal(normalizeGalleryQuery({ slotKey: 'not_a_slot' }), null);
  assert.equal(normalizeGalleryQuery({ slotKey: 42 }), null);
  assert.equal(normalizeGalleryQuery({}), null);
});

/* ── shaping: two reasons a photo is withheld, both counted ─────────────── */

function row(over: Partial<RawGalleryRow> = {}): RawGalleryRow {
  return {
    asset_id: 'A1',
    label: 'Blush garden bouquet',
    storage_path: 'https://cdn/x.webp',
    vendor_profile_id: 'V1',
    shop: { business_name: 'Bloom & Vine', services: canonicalServicesForTile('florist') },
    ranges: [
      { slot_id: 2, sampled_hex: '#B22222' },
      { slot_id: 1, sampled_hex: '#F8F1E7' },
    ],
    ...over,
  };
}

test('a shapeable row carries its credit and six colours in slot order', () => {
  const { assets, withheld } = shapeGalleryPage('flowers', [row()]);
  assert.equal(withheld, 0);
  assert.equal(assets.length, 1);
  assert.equal(assets[0]!.credit, 'Bloom & Vine · Florist');
  assert.equal(assets[0]!.swatches.length, 6);
  assert.equal(assets[0]!.swatches[0], '#F8F1E7', 'slot_id 1 must lead');
  assert.equal(assets[0]!.swatches[1], '#B22222');
  // Cycled, not padded with invented colour.
  assert.equal(assets[0]!.swatches[2], '#F8F1E7');
});

test('⭐ WITHHELD · a photo whose SHOP is unreadable is never shown uncredited', () => {
  const { assets, withheld } = shapeGalleryPage('flowers', [row({ shop: null })]);
  assert.equal(assets.length, 0);
  assert.equal(withheld, 1);
});

test('⭐ WITHHELD · a shop with a blank business_name is not a credit', () => {
  const { assets, withheld } = shapeGalleryPage('flowers', [
    row({ shop: { business_name: '   ', services: [] } }),
  ]);
  assert.equal(assets.length, 0);
  assert.equal(withheld, 1);
});

test('⭐ WITHHELD · no sampled colours means no invented colours', () => {
  // The board row's six sampled_hex columns are NOT NULL, and the Canvas
  // extractor returns CREAM DEFAULTS on a tainted cross-origin canvas rather
  // than throwing — a fabricated palette that renders like a real one.
  const { assets, withheld } = shapeGalleryPage('flowers', [row({ ranges: [] })]);
  assert.equal(assets.length, 0);
  assert.equal(withheld, 1);
});

test('withholding is counted, not swallowed — a mixed page reports both halves', () => {
  const { assets, withheld } = shapeGalleryPage('flowers', [
    row({ asset_id: 'A1' }),
    row({ asset_id: 'A2', shop: null }),
    row({ asset_id: 'A3', ranges: [] }),
    row({ asset_id: 'A4' }),
  ]);
  assert.deepEqual(
    assets.map((a) => a.assetId),
    ['A1', 'A4'],
  );
  assert.equal(withheld, 2);
});

/* ── the per-shop tally behind the marker ──────────────────────────────── */

test('the tally counts one board row per shop', () => {
  const tally = tallySavedGalleryPhotos([
    { library_asset_id: 'A1', vendor_profile_id: 'V1' },
    { library_asset_id: 'A2', vendor_profile_id: 'V1' },
    { library_asset_id: 'A3', vendor_profile_id: 'V2' },
  ]);
  assert.equal(tally.get('V1'), 2);
  assert.equal(tally.get('V2'), 1);
  assert.equal(tally.get('V3'), undefined, 'an unmentioned shop must be absent, not 0');
});

test('⭐ rows with no provenance and no shop are SKIPPED, never bucketed under a blank key', () => {
  // A '' key would collect every uncredited photo in the event and then print
  // the total against whichever shop happened to have no id.
  const tally = tallySavedGalleryPhotos([
    { library_asset_id: null, vendor_profile_id: null }, // the couple's own upload
    { library_asset_id: 'A9', vendor_profile_id: null }, // asset unreadable
    { library_asset_id: 'A1', vendor_profile_id: 'V1' },
  ]);
  assert.equal(tally.size, 1);
  assert.equal(tally.get('V1'), 1);
  assert.equal(tally.get(''), undefined);
});
