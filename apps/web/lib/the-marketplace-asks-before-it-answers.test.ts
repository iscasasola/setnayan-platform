/**
 * The marketplace landing asks a question. It does not shout twenty answers.
 *
 * ── WHY (owner, 2026-09-08) ────────────────────────────────────────────────
 * `/explore` opened with four service chips over sixteen occasion chips, a
 * "Browse all 192 categories" link and a sort row — before the visitor had said
 * anything. *"we don't need to show as many buttons up front. we want it simple
 * and clean and easy to search. not bombarded with a lot of choices."*
 *
 * ── WHAT MUST SURVIVE, AND WHY IT IS NOT OPTIONAL ─────────────────────────
 * Both filters stay reachable. The occasion row's own note recorded that
 * `?event_type=` had shipped since Iteration 0041 with **nothing on any public
 * surface able to set it** — the filter drawer does not render on this landing.
 * Deleting the row outright would have re-orphaned a filter that took a
 * deliberate act to give a home. A `<select>` is the smaller surface that keeps
 * it reachable.
 *
 * 🔑 SIMPLIFYING A SCREEN IS NOT THE SAME AS REMOVING WHAT IT COULD DO. These
 * tests hold the second half: fewer targets, same reach.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const hero = stripComments(
  readFileSync(
    resolve(HERE, '../app/(shell)/explore/_components/explore-search-hero.tsx'),
    'utf8',
  ),
);

test('neither filter is rendered as a wall of chips any more', () => {
  assert.ok(
    !/chips\.map\([\s\S]{0,120}<Link/.test(hero),
    'the service chips are back as a row of links',
  );
  assert.ok(
    !/occasionChips\.map\([\s\S]{0,120}<Link/.test(hero),
    'the occasion chips are back as a row of links',
  );
});

test('BOTH filters are still reachable from the landing', () => {
  // The whole point of the occasion row: `?event_type=` has no other public
  // setter on this page.
  assert.match(hero, /name="category"/, 'the category filter lost its control');
  assert.match(hero, /name="event_type"/, 'the occasion filter lost its control — it has no other public setter here');
});

test('each control offers an explicit "any" — a filter you can turn off', () => {
  assert.match(hero, /<option value="">Any category<\/option>/, 'category cannot be cleared');
  assert.match(hero, /<option value="">Any occasion<\/option>/, 'occasion cannot be cleared');
});

test('they are NATIVE selects in a GET form, not a JS-only widget', () => {
  // Submits without JavaScript, keyboard- and screen-reader-native, and on a
  // phone it opens the platform picker instead of a twenty-target tap area.
  assert.match(hero, /<select\b/, 'the filters stopped being native selects');
  assert.match(hero, /method="get"[\s\S]{0,80}action="\/explore"/, 'the filter form stopped being a plain GET to /explore');
});

test('services and occasions stay SEPARATE questions', () => {
  // One merged list would read as though "Debut" and "Florists" were
  // alternatives. They answer different questions.
  const selects = hero.match(/<select\b/g) ?? [];
  assert.ok(
    selects.length >= 2,
    `expected a control per question, found ${selects.length}`,
  );
});
