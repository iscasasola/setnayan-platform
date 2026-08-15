/**
 * event-type-search.test.ts — the occasion axis of the marketplace search.
 *
 * Two halves, and the second is the one that matters:
 *   1. The matcher does what it says (a typed word finds the right kind).
 *   2. The HANDLES exist. The whole reason this module was written is that the
 *      `?event_type=` filter shipped complete and unreachable for months, so a
 *      test that only checked the matcher would be testing the easy half of the
 *      bug. The source-level assertions below fail if the picker, the chips or
 *      the wiring are removed — see `gates-have-handles.test.ts` for the family
 *      of defect this belongs to.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveEventTypeKeysForToken,
  MIN_TOKEN_LENGTH,
  type EventTypeSearchOption,
} from './event-type-search';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..'); // apps/web
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/**
 * A stand-in for the live roster. Deliberately NOT imported from the fallback
 * constant: this module's contract is "whatever the admin has launched", and a
 * test pinned to today's sixteen would go red for the wrong reason the next
 * time somebody adds a kind of celebration.
 */
const VOCAB: EventTypeSearchOption[] = [
  { key: 'wedding', label: 'Wedding' },
  { key: 'debut', label: 'Debut' },
  { key: 'gender_reveal', label: 'Gender Reveal' },
  { key: 'birthday', label: 'Birthday' },
  { key: 'christening', label: 'Christening' },
  { key: 'anniversary', label: 'Anniversary' },
  { key: 'date', label: 'Date' },
];

// ── The matcher ────────────────────────────────────────────────────────────

test('a typed occasion finds its key', () => {
  assert.deepEqual(resolveEventTypeKeysForToken('debut', VOCAB), ['debut']);
  assert.deepEqual(resolveEventTypeKeysForToken('birthday', VOCAB), ['birthday']);
});

test('a prefix finds it too — people type as they think', () => {
  assert.deepEqual(resolveEventTypeKeysForToken('chris', VOCAB), ['christening']);
  assert.deepEqual(resolveEventTypeKeysForToken('anniv', VOCAB), ['anniversary']);
});

test('a multi-word kind is found from either word AND from the run-together spelling', () => {
  // The caller strips tokens to [a-z0-9] and splits on whitespace, so all three
  // of these are real things a person produces by typing "gender reveal".
  assert.deepEqual(resolveEventTypeKeysForToken('gender', VOCAB), ['gender_reveal']);
  assert.deepEqual(resolveEventTypeKeysForToken('reveal', VOCAB), ['gender_reveal']);
  // This is the one the underscore would have eaten. Without normaliseKey the
  // key is `gender_reveal`, the token is `genderreveal`, and nothing matches.
  assert.deepEqual(resolveEventTypeKeysForToken('genderreveal', VOCAB), [
    'gender_reveal',
  ]);
});

test('short fragments name nothing — the floor is higher than the service axis', () => {
  // `at` sits inside `date` and `an` sits inside `anniversary`. On a 192-item
  // service taxonomy a two-letter hit stays rare; on a list of whole categories
  // of celebration it is always an accident.
  assert.equal(MIN_TOKEN_LENGTH, 3);
  assert.deepEqual(resolveEventTypeKeysForToken('at', VOCAB), []);
  assert.deepEqual(resolveEventTypeKeysForToken('an', VOCAB), []);
  // …and the three-letter word that IS a kind still works.
  assert.deepEqual(resolveEventTypeKeysForToken('wed', VOCAB), ['wedding']);
});

test('the label is matched, not just the key — admins rename, keys are frozen', () => {
  // 🔴 THIS TEST EXISTS BECAUSE A MUTATION RUN FOUND ITS ABSENCE. Deleting the
  // label half of the match left every other assertion GREEN, because in the
  // roster above every label is just its key title-cased, so the key half
  // covered them all. That is a test suite agreeing with itself.
  //
  // The divergence is real and permanent: `event_type_vocab.event_type` is the
  // frozen identifier a shop's rows are keyed on, while `label_en` is what an
  // admin edits at /admin/event-types with zero deploys. The moment somebody
  // renames a kind, the word a visitor TYPES is the label and the key is a
  // word nobody has ever seen.
  const renamed: EventTypeSearchOption[] = [
    { key: 'celebration', label: 'Party' },
  ];
  assert.deepEqual(resolveEventTypeKeysForToken('party', renamed), [
    'celebration',
  ]);
  // …and the frozen key still works for anyone who types the old word.
  assert.deepEqual(resolveEventTypeKeysForToken('celebration', renamed), [
    'celebration',
  ]);
});

test('an ordinary word names no occasion', () => {
  for (const token of ['tagaytay', 'photographer', 'catering', 'manila']) {
    assert.deepEqual(
      resolveEventTypeKeysForToken(token, VOCAB),
      [],
      `"${token}" should not resolve to a kind of celebration`,
    );
  }
});

test('an empty roster resolves nothing rather than throwing', () => {
  // The degraded path: a vocab read that fell over. The search must lose the
  // occasion axis, not the whole query.
  assert.deepEqual(resolveEventTypeKeysForToken('debut', []), []);
});

test('results come back in the roster order they were given', () => {
  const keys = resolveEventTypeKeysForToken('e', [
    ...VOCAB,
  ]);
  // 'e' is below the floor, so this is empty — but the ordering contract is
  // asserted on a token that DOES hit several rows:
  assert.deepEqual(keys, []);
  const many = resolveEventTypeKeysForToken('day', [
    { key: 'birthday', label: 'Birthday' },
    { key: 'day_after', label: 'Day After' },
  ]);
  assert.deepEqual(many, ['birthday', 'day_after']);
});

// ── The handles ────────────────────────────────────────────────────────────
//
// 🔴 These are the assertions that would have caught the original defect. The
// filter was correct, tested and complete; what was missing was anything a
// person could touch. Do not weaken one to go green — if a control genuinely
// moves, re-point the assertion at its new home.

test('the marketplace search actually passes the roster to the matcher', () => {
  const page = read('app/explore/page.tsx');
  // Both call sites — the main query AND the broadened-count query. Missing the
  // second lets the empty state offer to widen a search that was already wider.
  //
  // Anchored on the assignment, not on the bare name: a plain
  // `/applyMarketplaceTextSearch\(/` also matches the function's own
  // DEFINITION, so it counted three and this assertion was wrong on its first
  // run. A guard that miscounts its own subject is the family of defect the
  // repo already knows as "an unmeasured mutation proves nothing".
  const calls = page.match(/=\s*applyMarketplaceTextSearch\(/g) ?? [];
  assert.equal(calls.length, 2, 'expected exactly two search call sites');
  const withRoster =
    page.match(/=\s*applyMarketplaceTextSearch\([^;]*?eventTypeSearchOptions/gs) ?? [];
  assert.equal(
    withRoster.length,
    2,
    'every applyMarketplaceTextSearch call must pass eventTypeSearchOptions — ' +
      'an omitted roster silently drops the occasion axis and nothing errors',
  );
});

test('the filter drawer offers a real occasion control, not a hidden input', () => {
  const drawer = read('app/explore/_components/filter-drawer.tsx');
  // A <select> named event_type. Anchored on the select so a hidden input
  // preserving the value cannot satisfy this — a hidden input is exactly what
  // shipped for months and it is what "no handle" looks like.
  assert.match(
    drawer,
    /<select\b[^>]*\n?[^>]*name="event_type"/s,
    'the drawer must render a <select name="event_type"> a visitor can change',
  );
  assert.match(
    drawer,
    /Any occasion/,
    'the occasion select needs its clear-the-narrow option',
  );
});

test('the drawer is given the roster to populate that control', () => {
  const page = read('app/explore/page.tsx');
  assert.match(
    page,
    /eventTypeOptions:\s*eventTypeVocab\.map/,
    'the drawer must receive the live vocab — a hardcoded list here would be a ' +
      'second vocabulary drifting from the admin-managed one',
  );
});

test('the landing page has an occasion handle of its own', () => {
  // Catalog mode renders NO FilterDrawer, so the drawer above cannot be the
  // only handle: without this row a visitor on a bare /explore has no way to
  // ask for their kind of celebration.
  const page = read('app/explore/page.tsx');
  assert.match(
    page,
    /occasionChips[^\n]*=/,
    'the catalog landing must build occasion chips',
  );
  assert.match(
    page,
    /occasionChips=\{occasionChips\}/,
    '…and must actually pass them to the hero',
  );
  const hero = read('app/explore/_components/explore-search-hero.tsx');
  assert.match(
    hero,
    /occasionChips\.map\(/,
    'the hero must render the occasion chips it is handed',
  );
});

test('the occasion chips are not silently capped', () => {
  const page = read('app/explore/page.tsx');
  const block = page.slice(
    page.indexOf('const occasionChips'),
    page.indexOf('const occasionChips') + 400,
  );
  assert.ok(block.length > 0, 'occasionChips block not found');
  assert.doesNotMatch(
    block,
    /\.slice\(/,
    'a slice here decides in a source file which celebrations are worth ' +
      'showing and hides the rest behind nothing — there is no "all occasions" ' +
      'page to send anyone to. Which kinds appear is the `enabled` lever in ' +
      '/admin/event-types.',
  );
});

test('"occasions" is NOT smuggled into the public search promise', () => {
  // 🛑 THIS TEST IS THE OPPOSITE OF THE ONE I FIRST WROTE, and the reversal is
  // the point.
  //
  // The first cut hardcoded `placeholder="Search suppliers, occasions, stories
  // and guides"` — written against a base that was one commit stale. An hour
  // earlier another session had made that placeholder DERIVED from
  // `PUBLIC_SEARCH_NOUNS` (#4458), so shipping the literal would have silently
  // reverted a guard whose whole purpose is that the promise and the mechanism
  // cannot drift apart.
  //
  // 🔑 And once the mechanism was actually READ, the addition was wrong on its
  // own terms too. Those nouns are RESULT KINDS: every one has a resolver that
  // emits hits stamped with that noun, and the coverage test refuses a noun
  // with nothing behind it. An occasion is an INPUT, not an output — nobody
  // ever gets back "an occasion", they get back suppliers. Listing it beside
  // suppliers / stories / guides would have promised a fourth kind of result
  // that does not exist.
  //
  // Discovery is carried instead by the two handles this PR builds: the
  // Occasion chip row on the landing and the Occasion select in the drawer.
  const nouns = read('lib/public-search-nouns.ts');
  assert.doesNotMatch(
    nouns,
    /'occasions'/,
    'an occasion is something you TYPE, not something the box returns — it does ' +
      'not belong in a list of result kinds, and PUBLIC_SEARCH_NOUNS has a ' +
      'coverage test that would (correctly) refuse it',
  );
});
