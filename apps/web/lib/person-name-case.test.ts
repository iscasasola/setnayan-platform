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
import { displayFirstName, displayPersonName, titleCasePersonName } from './person-name-case';

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

test('an all-lowercase name gets every word capitalised — the STORAGE rule (a supplier saving their own name)', () => {
  // Nobody deliberately types their whole name lower case in a business form,
  // so this is the one case where no intent can be destroyed.
  // ⚖ SUPERSEDED FOR DISPLAY (owner 2026-10-21, "Yes to all" on
  // guest_page_fixes_2_4_2026-10-21.html, fix 3): a name SHOWN to anyone goes
  // through `displayPersonName`, which keeps a particle after the first word
  // lower case — "Juan de la Cruz". This helper still writes "Juan De La Cruz"
  // where a name is saved cased (open-shop), because storage was not ruled on.
  assert.equal(titleCasePersonName('juan de la cruz'), 'Juan De La Cruz');
  assert.equal(displayPersonName('juan de la cruz'), 'Juan de la Cruz', 'the display rule no longer supersedes the storage rule');
});

test('🪪 displayPersonName — the prototype’s table, row for row (fix 3)', () => {
  const TABLE: readonly [typed: string, shows: string][] = [
    ['pamela labriaga', 'Pamela Labriaga'],
    ['maria dela cruz', 'Maria dela Cruz'],
    ['jose de los santos', 'Jose de los Santos'],
    ['ana santos y reyes', 'Ana Santos y Reyes'],
    ['dela cruz', 'Dela Cruz'],
    ['McArthur', 'McArthur'],
    ['Ana MJ Reyes', 'Ana MJ Reyes'],
    ['Juan de la Cruz III', 'Juan de la Cruz III'],
    ['mary-ann reyes', 'Mary-Ann Reyes'],
    ['juan san jose', 'Juan San Jose'],
    ['tita cora ng', 'Tita Cora Ng'],
    ['mcarthur', 'Mcarthur'],
  ];
  for (const [typed, shows] of TABLE) assert.equal(displayPersonName(typed), shows, `"${typed}"`);
  // The shipped helper, for the row the table calls out: "Shipped helper today: Maria Dela Cruz."
  assert.equal(titleCasePersonName('maria dela cruz'), 'Maria Dela Cruz');
});

test('🪪 displayPersonName — the edges the table implies', () => {
  // Every particle that is not a Filipino surname word stays lower after the first word…
  for (const p of ['de', 'del', 'dela', 'delos', 'la', 'los', 'van', 'von', 'y']) {
    assert.equal(displayPersonName(`ana ${p} reyes`), `Ana ${p} Reyes`, p);
  }
  // …and the ones that ARE surname words are capitalised, with or without their period.
  for (const [p, shown] of [['san', 'San'], ['santa', 'Santa'], ['santo', 'Santo'], ['sta.', 'Sta.'], ['sto.', 'Sto.'], ['mac', 'Mac'], ['mc', 'Mc'], ['ng', 'Ng']] as const) {
    assert.equal(displayPersonName(`ana ${p} reyes`), `Ana ${shown} Reyes`, p);
  }
  // A middle initial is a letter and a period — "e." is Esguerra, not the particle "e".
  assert.equal(displayPersonName('juan e. reyes'), 'Juan E. Reyes');
  // A particle inside a hyphenated married surname stays lower too ("Sacdalan-dela Rosa").
  assert.equal(displayPersonName('ana sacdalan-dela rosa'), 'Ana Sacdalan-dela Rosa');
  assert.equal(displayFirstName('pamela labriaga'), 'Pamela');
  assert.equal(displayPersonName(null), '');
  assert.equal(displayPersonName('   '), '');
  assert.equal(displayPersonName("'nay ising"), "'Nay Ising");
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
