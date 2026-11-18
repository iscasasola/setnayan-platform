/**
 * W1-B22 (supplier walk, 16 Nov 2026): the Cake category's only service read "Wedding cake" under a Birthday, a
 * Christening and every other event. It shows as "Cake" — display only; the key `wedding_cake` is untouched, and an
 * admin's own rename always wins.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { serviceDisplayName } from './service-display-name';

test('the seeded "Wedding cake" shows as "Cake"', () => {
  assert.equal(serviceDisplayName('wedding_cake', 'Wedding cake'), 'Cake');
  assert.equal(serviceDisplayName('wedding_cake', ' Wedding Cake '), 'Cake');
  assert.equal(serviceDisplayName('wedding_cake', null), 'Cake', 'no row must not fall back to the key’s words');
});

test('an admin’s own name always wins, and other services are untouched', () => {
  assert.equal(serviceDisplayName('wedding_cake', 'Custom cakes'), 'Custom cakes');
  assert.equal(serviceDisplayName('dessert_table', 'Dessert table'), 'Dessert table');
  assert.equal(serviceDisplayName('dessert_table', ''), '', 'a blank name keeps each caller’s own fallback');
});

test('both name readers — the supplier pick list and the couple labels — go through it', () => {
  const cov = readFileSync('lib/vendor-coverages.ts', 'utf8');
  assert.match(cov, /const label = serviceDisplayName\(cs\.canonical_service, displayName\.get\(cs\.canonical_service\)\)/);
  const labels = readFileSync('lib/service-labels.ts', 'utf8');
  assert.match(labels, /const label = serviceDisplayName\(r\.canonical_service, r\.display_name_en\)/);
  assert.match(labels, /labels\[key\] \|\| serviceDisplayName\(key, ''\)/);
});

test('the taxonomy key is not renamed (display only)', () => {
  const tax = readFileSync('lib/taxonomy.ts', 'utf8');
  assert.match(tax, /\bwedding_cake:/, 'the canonical key moved — that belongs to the taxonomy builder, not this fix');
});

test('the wedding_cake correction carries its retirement TODO (owner ruling 6)', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const src = readFileSync(join(process.cwd(), 'lib/service-display-name.ts'), 'utf8');
  assert.match(src, /TODO\(owner ruling 6[^)]*\)[\s\S]{0,300}wedding_cake: \{ seeded: 'Wedding cake', shown: 'Cake' \}/);
});
