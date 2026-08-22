import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitPersonName } from './person-name-split';

test('an ordinary two-word name splits the obvious way', () => {
  assert.deepEqual(splitPersonName('Ana Cruz'), { first: 'Ana', last: 'Cruz' });
});

test('the surname is the LAST word, not the second', () => {
  assert.deepEqual(splitPersonName('Maria Clara Santos'), {
    first: 'Maria Clara',
    last: 'Santos',
  });
});

test('a suffix rides with the surname', () => {
  /* "Jr" alone is nobody's name, and PH guest lists carry these constantly. */
  assert.deepEqual(splitPersonName('Juan Reyes Jr'), { first: 'Juan', last: 'Reyes Jr' });
  assert.deepEqual(splitPersonName('Juan Reyes Jr.'), { first: 'Juan', last: 'Reyes Jr.' });
  assert.deepEqual(splitPersonName('Indalecio Casasola III'), {
    first: 'Indalecio',
    last: 'Casasola III',
  });
  assert.deepEqual(splitPersonName('Ana Maria Cruz Jr'), {
    first: 'Ana Maria',
    last: 'Cruz Jr',
  });
});

test('ONE WORD RETURNS AN EMPTY LAST NAME — it never invents one', () => {
  /*
    The load-bearing assertion. `guests.last_name` is NOT NULL, so the tempting
    fixes are to repeat the word, write a dash, or write "—". All three are a
    made-up surname that then travels onto an invitation and a place card with
    nobody ever seeing the moment it was invented. Empty is a question the
    picker can ask on that row.
  */
  assert.deepEqual(splitPersonName('Madonna'), { first: 'Madonna', last: '' });
  assert.deepEqual(splitPersonName('  Tita  '), { first: 'Tita', last: '' });
});

test('a word plus a suffix keeps one given name and a surname half', () => {
  assert.deepEqual(splitPersonName('Cher Jr'), { first: 'Cher', last: 'Jr' });
});

test('nothing in, nothing out', () => {
  assert.deepEqual(splitPersonName(''), { first: '', last: '' });
  assert.deepEqual(splitPersonName('   '), { first: '', last: '' });
  assert.deepEqual(splitPersonName(undefined as unknown as string), { first: '', last: '' });
});

test('extra whitespace collapses', () => {
  assert.deepEqual(splitPersonName('  Ana   Cruz  '), { first: 'Ana', last: 'Cruz' });
});
