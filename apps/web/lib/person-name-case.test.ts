/**
 * Owner 2026-08-10: *"Your Name must always have the first letter in capital."*
 *
 * The interesting half of this is what it must NOT do. A naive title-caser
 * lowercases the rest of each word, and that destroys real Filipino names:
 * "de la Cruz" becomes "De La Cruz", "JR" becomes "Jr", "MJ" becomes "Mj".
 * Getting someone's own name wrong is worse than leaving it as they typed it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleCasePersonName } from './person-name-case';

test('the thing that was asked for', () => {
  assert.equal(titleCasePersonName('ana reyes'), 'Ana Reyes');
  assert.equal(titleCasePersonName('juan'), 'Juan');
  assert.equal(titleCasePersonName('  maria   clara  '), 'Maria Clara');
});

test('already-correct names are untouched', () => {
  for (const n of ['Ana Reyes', 'Maria Clara', 'Jose Rizal']) {
    assert.equal(titleCasePersonName(n), n);
  }
});

test('🔑 it does not "fix" casing the vendor chose', () => {
  // Every one of these is a real shape, and every one is damaged by a naive
  // title-caser that lowercases the remainder.
  for (const n of [
    'Juan de la Cruz',
    'Ana dela Peña',
    'Jose del Rosario',
    'Mark Anthony Reyes JR',
    'Ana MJ Reyes',
    'Maria Clara III',
  ]) {
    assert.equal(titleCasePersonName(n), n, `${n} was altered`);
  }
});

test('an all-lowercase name gets every word capitalised', () => {
  // Nobody deliberately types their whole name lower case in a business form,
  // so this is the one case where no intent can be destroyed.
  assert.equal(titleCasePersonName('juan de la cruz'), 'Juan De La Cruz');
});

test('blank and nullish are empty, not "Undefined"', () => {
  assert.equal(titleCasePersonName(''), '');
  assert.equal(titleCasePersonName('   '), '');
  assert.equal(titleCasePersonName(null), '');
  assert.equal(titleCasePersonName(undefined), '');
});

test('leading punctuation keeps its place', () => {
  assert.equal(titleCasePersonName("'nay ising"), "'Nay Ising");
});
