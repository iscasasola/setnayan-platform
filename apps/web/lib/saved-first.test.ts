/**
 * 🔖 Saved suppliers go first in line — only when the venue is in their reach AND they are free on the date.
 * Owner, 20 Nov 2026: *"they show if they match the requirements of the place. you are within the are and you are
 * available on that date."*
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { savedFirst, savedGoesFirst } from '@/lib/saved-first';

const WEB = join(import.meta.dirname, '..');
const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

test('first in line needs saved AND in reach AND free — unknown is never true', () => {
  assert.equal(savedGoesFirst({ saved: true, inReach: true, freeOnDate: true }), true);
  assert.equal(savedGoesFirst({ saved: true, inReach: false, freeOnDate: true }), false, 'out of reach → normal order');
  assert.equal(savedGoesFirst({ saved: true, inReach: true, freeOnDate: false }), false, 'busy → normal order');
  assert.equal(savedGoesFirst({ saved: true, inReach: null, freeOnDate: true }), false, 'reach unknown → normal order');
  assert.equal(savedGoesFirst({ saved: true, inReach: true, freeOnDate: null }), false, 'no date / no calendar → normal');
  assert.equal(savedGoesFirst({ saved: false, inReach: true, freeOnDate: true }), false, 'not saved → normal order');
});

test('the partition is stable: qualifying rows lead in their order, the rest keep the normal order', () => {
  const rows = ['a', 'B', 'c', 'D', 'e'];
  assert.deepEqual(savedFirst(rows, (r) => r === r.toUpperCase()), ['B', 'D', 'a', 'c', 'e']);
  assert.deepEqual(savedFirst(rows, () => false), rows, 'nobody qualifies → unchanged');
});

test('★ Chosen (locked) stays first, then saved, then the rest — saved-first never pushes the Chosen card down', () => {
  type R = { id: string; locked: boolean; saved: boolean };
  const rows: R[] = [
    { id: 'chosen', locked: true, saved: false },
    { id: 'a', locked: false, saved: false },
    { id: 'saved', locked: false, saved: true },
    { id: 'b', locked: false, saved: false },
  ];
  const out = savedFirst(rows, (r) => r.saved, (r) => r.locked).map((r) => r.id);
  assert.deepEqual(out, ['chosen', 'saved', 'a', 'b']);
  // A locked row that is also saved is still kept with the Chosen, not moved.
  const both = savedFirst([{ id: 'x', locked: false, saved: true }, { id: 'c', locked: true, saved: true }], (r) => r.saved, (r) => r.locked);
  assert.deepEqual(both.map((r) => r.id), ['c', 'x']);
});

test('Find (bench rail) and the category search both use the one rule, fed by the shipped reach + date reads', () => {
  const find = src('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');
  assert.match(find, /savedFirst\(\s*sortWithReasons\(/, 'the Find rail no longer puts saved suppliers first');
  assert.match(
    find,
    /\(\{ v \}\) => benchSavedGoesFirst\(v\),[\s\S]{0,120}\(\{ v \}\) => v\.status === 'locked',/,
    'saved-first no longer keeps the ★ Chosen card ahead',
  );
  // No venue pin: "More to compare" must not print a distance measured from the region centroid.
  assert.match(find, /distance=\{mallEvent\.askVenue \? null : aboutKmLine\(v\.distanceKm\)\}/, 'More to compare shows a distance with no venue');
  assert.doesNotMatch(find, /distance=\{aboutKmLine\(v\.distanceKm\)\}/, 'an ungated distance line came back');
  assert.match(find, /function benchSavedGoesFirst[\s\S]{0,700}resolveReachBadge\([\s\S]{0,400}dateFit === 'free'/);

  const search = src('app/dashboard/[eventId]/vendors/_actions/category-search.ts');
  assert.match(search, /s\._depth === 1 &&\s*savedGoesFirst\(/, 'the search no longer gates saved suppliers on reach + date');
  assert.match(search, /inReach: s\.distanceKm !== null \? s\.withinRadius : null/);
  assert.match(search, /freeOnDate: fitScope !== null \? s\.serviceDateAvailable : null/);
});
