/**
 * venue-types-have-a-home.test.ts — every venue kind the database allows must
 * either be creatable by an admin, or be excluded ON PURPOSE with a reason.
 *
 * 🔴 THE BUG THIS EXISTS FOR. `venue_directory_type` allows 19 values. The
 * admin's `VENUE_TYPES` offered 13, and `restaurant` was not one of them — so
 * the directory held ZERO restaurants, not because nobody had got round to
 * adding one but because **the form had no such option.** A host could set
 * their venue to "Restaurant" and the marketplace had nothing to show them,
 * permanently, with no error anywhere.
 *
 * It is the same shape as `events.live_media_public` (a column read everywhere
 * with no writer) and `events.papic_face_mode` (a mode with no control): the
 * database permits something the product cannot produce. Nothing throws. The
 * feature simply has no content, forever, and that reads as "nobody uses it".
 *
 * 🔑 SO THE ASSERTION IS TWO-SIDED. A value must be OFFERED or EXPLICITLY
 * EXCLUDED. A new enum value fails this test until someone decides which — and
 * "decides" means writing the reason down, not adding it to a skip list.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { VENUE_TYPES } from './_constants';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Every value of the live `venue_directory_type` enum, read from production on
 * 2026-08-05. Hardcoded because a unit test cannot query the database — the
 * db-test layer is where a catalog comparison belongs. What this list is FOR is
 * forcing a decision when it and the picker disagree.
 */
const DB_ENUM_VALUES = [
  'catholic_church',
  'christian_church',
  'inc_chapel',
  'mosque',
  'cultural_site',
  'civil_registrar',
  'hotel_ballroom',
  'garden',
  'beach',
  'destination_resort',
  'heritage',
  'outdoor_tent',
  'banquet_hall',
  'garden_estate',
  'beach_resort',
  'heritage_hacienda',
  'restaurant',
  'multi_purpose_hall',
  'temple',
] as const;

/**
 * Values an admin deliberately cannot pick, each with the reason.
 *
 * All four are second-era DUPLICATES of a type already offered, and no row in
 * the directory uses any of them. Offering both halves of a pair would let two
 * admins file the same venue under different types and get different results —
 * that is a merge to perform on purpose, not a picker to widen.
 */
const DELIBERATELY_EXCLUDED: Record<string, string> = {
  banquet_hall: 'duplicate of hotel_ballroom',
  garden_estate: 'duplicate of garden',
  beach_resort: 'duplicate of beach',
  heritage_hacienda: 'duplicate of heritage',
};

test('every venue type the database allows is either offered or excluded on purpose', () => {
  const offered = new Set<string>(VENUE_TYPES);
  const homeless = DB_ENUM_VALUES.filter(
    (v) => !offered.has(v) && !(v in DELIBERATELY_EXCLUDED),
  );

  assert.deepEqual(
    homeless,
    [],
    `These venue types exist in the database and NO ADMIN CAN CREATE ONE: ` +
      `${homeless.join(', ')}.\n\n` +
      `That is not a missing row, it is a missing form option — the directory ` +
      `will hold zero of them forever, a host who picks the matching setting ` +
      `gets an empty marketplace, and nothing errors anywhere.\n\n` +
      `Either add it to VENUE_TYPES (and its label in venue-form.tsx and ` +
      `venues-surface.tsx), or add it to DELIBERATELY_EXCLUDED with the reason.`,
  );
});

test('the picker offers nothing the database would reject', () => {
  const allowed = new Set<string>(DB_ENUM_VALUES);
  const invented = VENUE_TYPES.filter((v) => !allowed.has(v));
  assert.deepEqual(
    invented,
    [],
    `The admin form offers ${invented.join(', ')}, which the enum does not ` +
      `allow — an admin would fill the whole form and the save would fail at ` +
      `the database.`,
  );
});

test('an excluded type names a real reason, not a placeholder', () => {
  for (const [value, reason] of Object.entries(DELIBERATELY_EXCLUDED)) {
    assert.ok(
      reason.length > 10 && !/^(tbd|todo|n\/a|later)/i.test(reason),
      `'${value}' is excluded with no real reason ("${reason}"). An exclusion ` +
        `list with placeholder reasons is a skip list, and a skip list is how ` +
        `this bug comes back.`,
    );
  }
});

test('every offered type has a label on both admin surfaces', () => {
  // A type in the list with no label renders blank or raw in one of the two
  // places an admin uses — the create form and the accounts filter.
  const form = readFileSync(join(HERE, '_components', 'venue-form.tsx'), 'utf8');
  const surface = readFileSync(
    join(HERE, '..', 'accounts', '_surfaces', 'venues-surface.tsx'),
    'utf8',
  );
  for (const value of VENUE_TYPES) {
    assert.ok(
      new RegExp(`\\n  ${value}: ['"]`).test(form),
      `venue-form.tsx has no label for '${value}' — the option renders blank.`,
    );
    assert.ok(
      surface.includes(`value: '${value}'`),
      `venues-surface.tsx cannot FILTER by '${value}', so an admin can create ` +
        `one and then not find it.`,
    );
  }
});

test('restaurant and multi-purpose hall specifically have a home now', () => {
  // Named because they are the two that were missing, and because both are
  // ordinary Philippine venues rather than edge cases: a restaurant is where a
  // date, a hangout, a small birthday or a christening reception happens, and a
  // parish or barangay hall is where a very large share of christenings and
  // children's parties happen.
  for (const value of ['restaurant', 'multi_purpose_hall']) {
    assert.ok(
      (VENUE_TYPES as readonly string[]).includes(value),
      `'${value}' lost its home again — the directory can hold none.`,
    );
  }
});
