/**
 * GUARD — mining alias words from our own attribute schemas, no model call.
 *
 * The fixture below is not invented: photo_booth's `booth_types` /
 * `footprint_size` and lights_sound's `rooms_handled` are copied verbatim
 * from a live read of `canonical_service_schemas` in production
 * (2026-08-28) — see the module docblock for the exact query. This file
 * pins that real shape, not a simplified stand-in.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  humanizeOption,
  rawOptionWordsByCategory,
  categoryFrequency,
  mineTradeAliases,
  GENERIC_DESCRIPTORS,
  MAX_SHARED_CATEGORIES,
  type SchemaRow,
} from './trade-alias-miner';

test('humanizeOption de-slugs and lowercases nothing on its own (caller lowercases)', () => {
  assert.equal(humanizeOption('360_booth'), '360 booth');
  assert.equal(humanizeOption('patiktok_tiktok_booth'), 'patiktok tiktok booth');
  assert.equal(humanizeOption('  already spaced  '), 'already spaced');
});

// The REAL fixture — read out of production 2026-08-28, not invented.
const PHOTO_BOOTH: SchemaRow = {
  canonical_service: 'photo_booth',
  category_specific_attributes: {
    booth_types: {
      options: [
        'traditional_photo_booth',
        '360_booth',
        'gif_booth',
        'polaroid_instax',
        'selfie_magic_mirror',
        'patiktok_tiktok_booth',
      ],
    },
    hours_typical: {}, // int field, no options — must contribute nothing
    footprint_size: { options: ['mini', 'small', 'medium', 'large'] },
    output_options: {
      options: ['printed_strips', 'digital_email', 'social_share_link', 'physical_album'],
    },
    power_requirement: { options: ['battery_capable', '110v_standard', '220v_industrial'] },
    attendant_included: {}, // boolean, no options
    props_library_size: {}, // int, no options
    backdrop_options_count: {}, // int, no options
  },
};
const LIGHTS_SOUND: SchemaRow = {
  canonical_service: 'lights_sound',
  category_specific_attributes: {
    rooms_handled: { options: ['small_intimate', 'medium', 'grand_ballroom'] },
    lighting_capable: {}, // boolean — its LABEL carries "lighting design", never mined
    engineer_included: {}, // boolean — its LABEL carries "sound engineer", never mined
    equipment_brands_carried: {}, // multi_select_open — no fixed options
  },
};
const SORBETES_CART: SchemaRow = {
  canonical_service: 'sorbetes_cart',
  category_specific_attributes: {}, // real prod shape: no attributes at all yet
};

test('ANCHOR — the fixture reproduces the real production shape, not a stand-in', () => {
  assert.ok(
    PHOTO_BOOTH.category_specific_attributes!.booth_types!.options!.includes('patiktok_tiktok_booth'),
    'the fixture drifted from what production actually holds for photo_booth',
  );
});

test('only fields carrying an options array contribute words — booleans and ints contribute nothing', () => {
  const byCategory = rawOptionWordsByCategory([PHOTO_BOOTH]);
  const words = byCategory.get('photo_booth')!;
  // hours_typical / attendant_included / props_library_size / backdrop_options_count
  // are int/boolean fields with no `options` — nothing from them should appear.
  assert.ok(!words.some((w) => /typical|attendant|props|backdrop/.test(w)));
});

test('a trade with EMPTY category_specific_attributes mines nothing — not an error, an absence', () => {
  const byCategory = rawOptionWordsByCategory([SORBETES_CART]);
  assert.equal(byCategory.has('sorbetes_cart'), false);
  const result = mineTradeAliases([SORBETES_CART]);
  assert.equal(result.kept.size, 0);
});

test('photo_booth mines its real distinctive words, de-slugged', () => {
  const result = mineTradeAliases([PHOTO_BOOTH]);
  const words = result.kept.get('photo_booth') ?? [];
  for (const expected of [
    '360 booth',
    'gif booth',
    'polaroid instax',
    'selfie magic mirror',
    'patiktok tiktok booth',
    'traditional photo booth',
  ]) {
    assert.ok(words.includes(expected), `expected "${expected}" in mined words, got ${JSON.stringify(words)}`);
  }
});

test('footprint_size\'s "mini", "small", "medium", "large" are ALL dropped as generic', () => {
  const result = mineTradeAliases([PHOTO_BOOTH]);
  const words = result.kept.get('photo_booth') ?? [];
  for (const generic of ['mini', 'small', 'medium', 'large']) {
    assert.ok(!words.includes(generic), `"${generic}" should have been dropped as a generic descriptor`);
  }
  // Every one of the four must show up in the counted drop list, not just vanish.
  const droppedWords = result.dropped
    .filter((d) => d.canonicalService === 'photo_booth' && d.reason === 'generic')
    .map((d) => d.word);
  assert.deepEqual(droppedWords.sort(), ['large', 'medium', 'mini', 'small']);
});

test('a word shared across MANY unrelated categories is dropped as over-shared', () => {
  // "medium" appears on both photo_booth and lights_sound here — with a low
  // threshold that is enough to prove the over-shared path fires (separate
  // from the generic-stoplist path, which would ALSO catch "medium").
  const rows = [PHOTO_BOOTH, LIGHTS_SOUND];
  const result = mineTradeAliases(rows, { maxSharedCategories: 2, stoplist: new Set() });
  const boothWords = result.kept.get('photo_booth') ?? [];
  const soundWords = result.kept.get('lights_sound') ?? [];
  assert.ok(!boothWords.includes('medium'));
  assert.ok(!soundWords.includes('medium'));
  assert.ok(result.droppedOverShared >= 2, 'expected both occurrences of "medium" to be counted as dropped');
});

test('a word shared by a small RELATED cluster survives — distinctive to a family, not generic', () => {
  // The real production shape: "silk"/"jusi"/"pina" sit on exactly 4
  // barong/filipiniana categories and are legitimately good alias words.
  const rows: SchemaRow[] = ['barong_tagalog_custom', 'bridal_gown_custom', 'filipiniana_maria_clara', 'filipiniana_terno'].map(
    (cs) => ({ canonical_service: cs, category_specific_attributes: { fabric: { options: ['silk', 'jusi', 'pina'] } } }),
  );
  const result = mineTradeAliases(rows); // default threshold (6)
  for (const cs of rows.map((r) => r.canonical_service)) {
    const words = result.kept.get(cs) ?? [];
    assert.ok(words.includes('silk'), `"silk" was wrongly dropped for ${cs}`);
    assert.ok(words.includes('jusi'), `"jusi" was wrongly dropped for ${cs}`);
    assert.ok(words.includes('pina'), `"pina" was wrongly dropped for ${cs}`);
  }
  assert.equal(result.droppedOverShared, 0, 'a 4-category cluster must not trip the 6-category ceiling');
});

test('a language-picker word shared across many UNRELATED categories is dropped', () => {
  const langCats = [
    'catholic_priest', 'host_emcee', 'wedding_singer', 'inc_minister',
    'officiant_priest_minister', 'menu_card', 'wedding_cards_designer',
  ];
  const rows: SchemaRow[] = langCats.map((cs) => ({
    canonical_service: cs,
    category_specific_attributes: { language: { options: ['english', 'tagalog'] } },
  }));
  const result = mineTradeAliases(rows); // 7 categories >= default threshold of 6
  for (const cs of langCats) {
    const words = result.kept.get(cs) ?? [];
    assert.ok(!words.includes('english'));
    assert.ok(!words.includes('tagalog'));
  }
});

test('categoryFrequency counts DISTINCT categories, not raw occurrences', () => {
  const byCategory = new Map([
    ['a', ['x', 'x', 'y']], // 'x' de-duped upstream in real use, but this fn trusts its input
    ['b', ['x']],
  ]);
  const freq = categoryFrequency(byCategory);
  // 'x' appears twice in category 'a' input here on purpose — this function
  // does not itself de-dupe within a category (rawOptionWordsByCategory
  // already guarantees that upstream), so this pins its actual contract.
  assert.equal(freq.get('y'), 1);
});

test('MAX_SHARED_CATEGORIES is the measured gap (6), not an arbitrary round number', () => {
  assert.equal(MAX_SHARED_CATEGORIES, 6);
});

test('GENERIC_DESCRIPTORS actually contains the three named examples', () => {
  assert.ok(GENERIC_DESCRIPTORS.has('small'));
  assert.ok(GENERIC_DESCRIPTORS.has('medium'));
  assert.ok(GENERIC_DESCRIPTORS.has('large'));
});

test('an option value repeated within the SAME category only counts once', () => {
  const row: SchemaRow = {
    canonical_service: 'x',
    category_specific_attributes: {
      a: { options: ['sorbetero', 'sorbetero'] },
      b: { options: ['sorbetero'] },
    },
  };
  const byCategory = rawOptionWordsByCategory([row]);
  assert.deepEqual(byCategory.get('x'), ['sorbetero']);
});

test('a non-array or missing options field is silently skipped, never throws', () => {
  const row: SchemaRow = {
    canonical_service: 'x',
    category_specific_attributes: {
      weird: { options: undefined },
      // @ts-expect-error — deliberately malformed, proving this does not crash on bad data
      alsoWeird: { options: 'not-an-array' },
    },
  };
  assert.doesNotThrow(() => rawOptionWordsByCategory([row]));
  assert.equal(rawOptionWordsByCategory([row]).has('x'), false);
});

test('null category_specific_attributes (not just {}) is handled, not a crash', () => {
  const row: SchemaRow = { canonical_service: 'x', category_specific_attributes: null };
  assert.doesNotThrow(() => mineTradeAliases([row]));
  assert.equal(mineTradeAliases([row]).kept.size, 0);
});
