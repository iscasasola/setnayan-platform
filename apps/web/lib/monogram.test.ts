/**
 * lib/monogram.test.ts — deriveMonogram's separator regex.
 *
 * The defect (owner, 2026-09-25): "I made A&B Monogram. it showed A&A" for the
 * event `display_name` "amanda & ben". The old regex split on the BARE
 * substring "and" (the old separator pattern), so "am{and}a & ben" cut into
 * "am" / "a" / "ben" and the badge read the first letters of "am" and "a" —
 * both "A". "and" must only match as its OWN WORD, and a hyphen must only
 * split when it has a space on both sides, or a compound first name like
 * "Mary-Anne" gets mistaken for two people.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveMonogram } from './monogram';

test('a name containing the substring "and" is not split on it', () => {
  // The exact defect: "and" inside "amANDa" must not act as a joiner.
  assert.equal(deriveMonogram('amanda & ben'), 'A & B');
});

test('the whole word "and" still joins two names', () => {
  assert.equal(deriveMonogram('Alexandra and Brandon'), 'A & B');
});

test('a tight hyphen inside one name does not split it from its partner', () => {
  // "Mary-Anne" is one person; only the " & " should separate the couple.
  assert.equal(deriveMonogram('Mary-Anne & Jose'), 'M & J');
});

test('a hyphen WITH spaces on both sides still separates two names', () => {
  assert.equal(deriveMonogram('Aira - Boy'), 'A & B');
});

test('names that merely contain "and" as a substring on both sides are unaffected', () => {
  // "Andy" and "Sandy" each contain the letters "and", but never as a
  // standalone word, so only the "&" should split them.
  assert.equal(deriveMonogram('Andy & Sandy'), 'A & S');
});

test('a single name has no partner to pair with', () => {
  assert.equal(deriveMonogram('Setnayan'), 'S');
});

test('a parenthetical annotation is stripped before deriving initials', () => {
  assert.equal(deriveMonogram('Maria & Juan (Demo)'), 'M & J');
});

test('null/undefined/empty all fall back to the neutral "S"', () => {
  assert.equal(deriveMonogram(null), 'S');
  assert.equal(deriveMonogram(undefined), 'S');
  assert.equal(deriveMonogram(''), 'S');
});

test('"+" and "/" still join two names, same as before', () => {
  assert.equal(deriveMonogram('Maria + Juan'), 'M & J');
  assert.equal(deriveMonogram('Maria / Juan'), 'M & J');
});
