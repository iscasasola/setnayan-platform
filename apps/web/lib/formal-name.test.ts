/**
 * formal-name.test.ts — the rules every surface of the formal name shares.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  atTag,
  composeFormalName,
  FORMAL_NAME_FIELDS,
  formalNameFromForm,
  isFormalNameEmpty,
  normalizeNamePart,
  placeCardName,
} from './formal-name';

const ICE = {
  name_prefix: 'Mr.',
  first_name: 'Indalecio',
  middle_name: 'Sacdalan',
  last_name: 'Casasola',
  name_suffix: 'II',
};

test('the parts print in order: prefix, first, middle, last, suffix', () => {
  assert.equal(composeFormalName(ICE), 'Mr. Indalecio Sacdalan Casasola II');
  assert.deepEqual([...FORMAL_NAME_FIELDS], [
    'name_prefix',
    'first_name',
    'middle_name',
    'last_name',
    'name_suffix',
  ]);
});

test('a missing part leaves no gap, and nothing at all is null', () => {
  assert.equal(composeFormalName({ first_name: 'Claire', last_name: 'Buanhog' }), 'Claire Buanhog');
  assert.equal(composeFormalName({ first_name: ' ', middle_name: null }), null);
  assert.equal(composeFormalName({}), null);
});

test('a blank part is stored as NULL, never as an empty string', () => {
  assert.equal(normalizeNamePart(''), null);
  assert.equal(normalizeNamePart('   '), null);
  assert.equal(normalizeNamePart(null), null);
  assert.equal(normalizeNamePart('  dela   Cruz '), 'dela Cruz');
  assert.equal(normalizeNamePart('x'.repeat(200))?.length, 80);
});

test('the form read takes all five and nothing else', () => {
  const form = new Map<string, unknown>([
    ['name_prefix', 'Mr.'],
    ['first_name', ' Indalecio '],
    ['last_name', 'Casasola'],
    ['name_suffix', ''],
    ['display_name', 'Ice Casasola'],
  ]);
  assert.deepEqual(formalNameFromForm(form), {
    name_prefix: 'Mr.',
    first_name: 'Indalecio',
    middle_name: null,
    last_name: 'Casasola',
    name_suffix: null,
  });
});

test('empty means every part is blank', () => {
  assert.equal(isFormalNameEmpty({}), true);
  assert.equal(isFormalNameEmpty({ first_name: '  ', last_name: null }), true);
  assert.equal(isFormalNameEmpty({ name_suffix: 'II' }), false);
});

test('the @tag is the slug with its @', () => {
  assert.equal(atTag('ice'), '@ice');
  assert.equal(atTag(''), null);
  assert.equal(atTag(null), null);
});

// ── 🪪 THE PLACE CARD NAME (owner 2026-09-30) ────────────────────────────────
test('placeCardName · the event’s Name style — Full · Middle initial (ONE letter) · Surname first', () => {
  const manuel = { name_prefix: 'Mr.', first_name: 'Manuel', middle_name: 'Cruz', last_name: 'Casasola' };
  // Owner "ok" 2026-09-30 (DECISION_LOG "THE COUPLE PICKS A NAME STYLE" addendum).
  assert.equal(placeCardName(manuel), 'Mr. Manuel Cruz Casasola', 'no style is Full, the event default');
  assert.equal(placeCardName(manuel, 'full'), 'Mr. Manuel Cruz Casasola');
  assert.equal(placeCardName(manuel, 'middle-initial'), 'Mr. Manuel C. Casasola');
  assert.equal(placeCardName({ ...manuel, name_suffix: 'II' }, 'surname-first'), 'Mr. Casasola II, Manuel C.');
  // An initial already typed stays one initial; a suffix keeps its place.
  assert.equal(
    placeCardName({ name_prefix: 'Mr.', first_name: 'Indalecio', middle_name: 'S.', last_name: 'Casasola', name_suffix: 'II' }, 'middle-initial'),
    'Mr. Indalecio S. Casasola II',
  );
  // Several middle words → ONE letter, the first; no prefix → none printed.
  assert.equal(placeCardName({ first_name: 'Ana', middle_name: 'maria clara', last_name: 'Reyes' }, 'middle-initial'), 'Ana M. Reyes');
  assert.equal(placeCardName({ first_name: 'Ana', middle_name: 'de la Cruz', last_name: 'Reyes' }, 'middle-initial'), 'Ana D. Reyes');
  assert.equal(placeCardName({ first_name: 'Ana', last_name: 'Reyes' }, 'surname-first'), 'Reyes, Ana');
  assert.equal(placeCardName({ first_name: 'Ana', last_name: 'Reyes' }), 'Ana Reyes');
});

test('placeCardName · never a bare first name — no last name, no card name', () => {
  assert.equal(placeCardName({ name_prefix: 'Ms.', first_name: 'Ana' }), null);
  assert.equal(placeCardName({ first_name: 'Ana', last_name: '  ' }), null);
  assert.equal(placeCardName({ last_name: 'Reyes' }), null);
  // …in every style.
  for (const style of ['full', 'middle-initial', 'surname-first'] as const) {
    assert.equal(placeCardName({ name_prefix: 'Mr.', first_name: 'Manuel' }, style), null);
  }
});
