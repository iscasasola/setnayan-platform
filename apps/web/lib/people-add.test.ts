/**
 * people-add.test.ts — the spouse rule, and the sentence that must NOT differ
 * between the two server branches.
 *
 * Every assertion here is about a decision a person sees on screen: which chips
 * exist, why one is missing, and what they are told after they press the button.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADD_RELATION_ORDER,
  RELATION_HINT,
  RELATION_LABEL,
  addConfirmation,
  firstNameOf,
  normalizeEmail,
  offerableRelations,
  spouseAbsenceNote,
  spouseIsOfferable,
  type SpouseContext,
} from './people-add';
import { CIVIL_STATUSES } from './profile-personalization';
import { DECLARABLE_RELATIONS } from './people-connections';

const ctx = (over: Partial<SpouseContext> = {}): SpouseContext => ({
  civilStatus: null,
  weddingHasHappened: false,
  ...over,
});

test('a single person is never asked to name a spouse', () => {
  assert.equal(spouseIsOfferable(ctx({ civilStatus: 'single' })), false);
  assert.ok(!offerableRelations(ctx({ civilStatus: 'single' })).includes('spouse'));
});

test('nobody who has said nothing is offered a spouse either — null is not married', () => {
  // Every account in production today is null. The safe direction is OFF: the
  // profile is one tap away, and offering it is the exact ask the owner refused.
  assert.equal(spouseIsOfferable(ctx()), false);
});

test('saying "Married" on the profile opens it — the manual path', () => {
  assert.equal(spouseIsOfferable(ctx({ civilStatus: 'married' })), true);
  assert.ok(offerableRelations(ctx({ civilStatus: 'married' })).includes('spouse'));
});

test('a wedding that has HAPPENED opens it, whatever the profile says', () => {
  // Owner: "they become married after wedding event". A person who never
  // updated their profile still married somebody, and we were there.
  assert.equal(spouseIsOfferable(ctx({ weddingHasHappened: true })), true);
  assert.equal(
    spouseIsOfferable(ctx({ civilStatus: 'single', weddingHasHappened: true })),
    true,
    'the wedding is evidence; a stale profile field is not a veto',
  );
});

test('engaged is NOT married — the day has to pass', () => {
  assert.equal(spouseIsOfferable(ctx({ civilStatus: 'engaged' })), false);
});

test('only the spouse chip is ever withheld — the rest are always offered', () => {
  for (const status of CIVIL_STATUSES) {
    const offered = offerableRelations(ctx({ civilStatus: status }));
    const withheld = ADD_RELATION_ORDER.filter((r) => !offered.includes(r));
    assert.deepEqual(withheld.length === 0 ? [] : withheld, withheld.includes('spouse') ? ['spouse'] : []);
  }
});

test('a missing spouse chip always explains itself', () => {
  // Silence reads as a missing feature. Whoever cannot see the chip is told
  // which door opens it.
  assert.equal(spouseAbsenceNote(ctx({ civilStatus: 'married' })), null);
  assert.equal(spouseAbsenceNote(ctx({ weddingHasHappened: true })), null);
  for (const status of ['single', 'in_a_relationship', 'engaged', 'widowed', 'separated'] as const) {
    const note = spouseAbsenceNote(ctx({ civilStatus: status }));
    assert.ok(note && note.length > 0, `${status} was left with no explanation`);
  }
  assert.match(spouseAbsenceNote(ctx()) ?? '', /profile/i);
});

test('every offered relation is one the database actually accepts', () => {
  for (const r of ADD_RELATION_ORDER) {
    assert.ok(DECLARABLE_RELATIONS.includes(r), `${r} is not declarable`);
    assert.ok(RELATION_LABEL[r], `${r} has no label`);
    assert.ok(RELATION_HINT[r], `${r} has no hint`);
  }
});

test('godchild is not offered — the ceremony or the other side creates it', () => {
  assert.ok(!ADD_RELATION_ORDER.includes('godchild' as never));
});

test('🔒 the confirmation cannot reveal whether that address has an account', () => {
  // The server takes two very different paths (store the claim + notify, or
  // store NOTHING and invite). If the copy could differ, this box would answer
  // "is this email registered?" for anybody who typed one in.
  //
  // The guard is STRUCTURAL, not a word-list: which branch ran is not an input
  // to this function, so no copy edit can leak it. Adding a third parameter is
  // how that would change, and it turns this red.
  assert.equal(
    addConfirmation.length,
    2,
    'addConfirmation gained a parameter — if that parameter is the server branch, the copy became an account-existence oracle',
  );
  const delivered = addConfirmation('Maria', true);
  assert.match(delivered, /Maria/);
  // The caveat about people who are not on Setnayan yet is CONDITIONAL and is
  // shown to everybody — that is what keeps it honest rather than telling.
  assert.match(delivered, /if they’re not on Setnayan yet/i);
  assert.match(delivered, /add them again once they join/i);
  // It must never state the account's existence as a fact, in either direction.
  assert.doesNotMatch(delivered, /(they|maria) (is|are|isn’t|aren’t|has|have)\b[^.]*\b(account|registered)/i);
});

test('a send that failed says so instead of claiming success', () => {
  const failed = addConfirmation('Maria', false);
  assert.match(failed, /couldn’t send/i);
  assert.doesNotMatch(failed, /^Sent/);
});

test('an address is normalised the way the resolver keys on it', () => {
  assert.equal(normalizeEmail('  Maria@Email.COM '), 'maria@email.com');
  assert.equal(normalizeEmail('first_last+tag@sub.example.ph'), 'first_last+tag@sub.example.ph');
  assert.equal(normalizeEmail(''), null);
  assert.equal(normalizeEmail('   '), null);
  assert.equal(normalizeEmail('maria'), null);
  assert.equal(normalizeEmail('@email.com'), null);
  assert.equal(normalizeEmail('maria@'), null);
  assert.equal(normalizeEmail(null), null);
});

test('the invitation greets a first name, never a blank', () => {
  assert.equal(firstNameOf('Ana Marie Cruz'), 'Ana');
  assert.equal(firstNameOf('  Ana  '), 'Ana');
  assert.equal(firstNameOf(''), null);
  assert.equal(firstNameOf(null), null);
});
