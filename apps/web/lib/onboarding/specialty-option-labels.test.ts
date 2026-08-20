/**
 * Every option a customer can be shown must be words, not a key.
 *
 * The owner saw `1st_birthday` and `adult_regular` on the birthday details
 * screen. They were not a rendering bug — the labels did not exist, because a
 * specialty OPTION is a bare string and the type has no slot for one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  SPECIALTY_OPTION_LABELS,
  humaniseOptionKey,
  specialtyOptionLabel,
} from './specialty-option-labels';

const web = process.cwd();
const CATALOG = 'lib/onboarding/specialty-catalog.ts';
const RENDERER = 'app/onboarding/[type]/_components/specialty-fields.tsx';

/** Every option value the shipped catalog can put on a screen. */
function catalogOptionKeys(): string[] {
  const src = readFileSync(join(web, CATALOG), 'utf8');
  const keys = new Set<string>();
  for (const m of src.matchAll(/"options":\s*\[(.*?)\]/gs)) {
    for (const v of m[1]!.matchAll(/"([^"]+)"/g)) keys.add(v[1]!);
  }
  return [...keys];
}

test('the scan finds the catalog’s options (a guard reading nothing passes everything)', () => {
  const keys = catalogOptionKeys();
  assert.ok(keys.length >= 180, `expected the catalog's option set, found ${keys.length}`);
  for (const known of ['1st_birthday', 'adult_regular', 'ninong', 'summa_cum_laude']) {
    assert.ok(keys.includes(known), `${known} must be found by the scan`);
  }
});

test('🚨 no option reaches a customer as a raw key', () => {
  const raw: string[] = [];
  let checked = 0;
  for (const key of catalogOptionKeys()) {
    checked += 1;
    const shown = specialtyOptionLabel(key);
    if (shown === key && /^[a-z0-9]+(_[a-z0-9]+)+$/.test(key)) raw.push(key);
  }
  assert.ok(checked >= 180, `expected to examine the whole catalog, examined ${checked}`);
  assert.deepEqual(raw, [], `these render as code:\n  ${raw.join('\n  ')}`);
});

test('every option the catalog ships has an AUTHORED label, not just a humanised one', () => {
  // The fallback is the safety net, not the plan: a key that only survives
  // because of it is a word nobody chose. Kept as a named, empty bill.
  const unauthored = catalogOptionKeys().filter((k) => !(k in SPECIALTY_OPTION_LABELS));
  assert.deepEqual(
    unauthored,
    [],
    `these fall back to humanised words — give them real names:\n  ${unauthored.join('\n  ')}`,
  );
});

test('the fallback humanises anything the map has never seen', () => {
  // Database-authored specs exist and the code cannot enumerate them, so an
  // unknown key must still be readable.
  assert.equal(humaniseOptionKey('some_new_thing'), 'Some new thing');
  assert.equal(humaniseOptionKey('18th_something'), '18th something');
  assert.equal(specialtyOptionLabel('a_key_nobody_authored'), 'A key nobody authored');
});

test('an already-human option is left alone', () => {
  assert.equal(specialtyOptionLabel('Best man'), 'Best man');
  assert.equal(specialtyOptionLabel('MVP'), 'MVP');
});

test('the two the owner actually saw', () => {
  assert.equal(specialtyOptionLabel('1st_birthday'), 'First birthday');
  assert.equal(specialtyOptionLabel('adult_regular'), 'An adult birthday');
});

test('all three render sites print through the lookup', () => {
  const src = readFileSync(join(web, RENDERER), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const labelled = (src.match(/specialtyOptionLabel\(o\)/g) ?? []).length;
  const rawPrints = (src.match(/^\s*\{o\}$/gm) ?? []).length;
  assert.equal(labelled, 3, `expected all 3 option render sites to label, found ${labelled}`);
  assert.equal(rawPrints, 0, `${rawPrints} render site(s) still print the key`);
});
