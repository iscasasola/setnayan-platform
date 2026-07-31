/**
 * WHO-first create step — unit tests for the pure half.
 *
 * The two things worth asserting: what a subject folds away from the type grid
 * (and that "You" folds away NOTHING), and that picking "You" keeps the
 * unlabeled honoree slot — stamping a name there would silently re-open the
 * one-in-planning cap for every event the account already created unlabeled.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSelfSubject,
  buildUnspecifiedSubject,
  dependentSubjects,
  gridHiddenTypes,
  hiddenTypesForSubject,
  subjectHonoreeLabel,
  type CreateSubject,
} from './create-subjects';

const TODAY = '2026-07-31';

function person(over: Partial<CreateSubject> = {}): CreateSubject {
  return {
    id: 'dep-1',
    kind: 'person',
    name: 'Nina',
    subtitle: 'Alaga · person',
    birthDate: null,
    sex: null,
    ...over,
  };
}

test('“You” sorts nothing away — your own grid stays whole', () => {
  assert.deepEqual(hiddenTypesForSubject(buildSelfSubject('Ice'), TODAY), []);
});

test('“Someone else” and no subject at all sort nothing away', () => {
  assert.deepEqual(hiddenTypesForSubject(buildUnspecifiedSubject(), TODAY), []);
  assert.deepEqual(hiddenTypesForSubject(null, TODAY), []);
});

test('a pet or a business folds away every person-only life type', () => {
  const pet = person({ kind: 'pet', name: 'Bantay', birthDate: '2020-01-05' });
  const hidden = hiddenTypesForSubject(pet, TODAY);
  for (const key of ['wedding', 'debut', 'christening', 'graduation', 'gender_reveal']) {
    assert.ok(hidden.includes(key), `expected ${key} folded away for a pet`);
  }
  // A dog's birthday party is an ordinary Filipino celebration — never folded.
  assert.ok(!hidden.includes('birthday'));
  assert.ok(!hidden.includes('anniversary'));
  assert.deepEqual(hiddenTypesForSubject(person({ kind: 'other', name: 'The Vios' }), TODAY), [
    'wedding',
    'debut',
    'christening',
    'graduation',
    'gender_reveal',
  ]);
});

test('a person alaga with no birthdate on file sorts nothing — fail open', () => {
  assert.deepEqual(hiddenTypesForSubject(person(), TODAY), []);
});

test('a six-year-old folds away wedding and debut, keeps christening', () => {
  // Born 2020 → 6 on 2026-07-31. Under 18 (Family Code Art. 5) and nowhere near
  // a debut; still inside the PH binyag window (under 8).
  const hidden = hiddenTypesForSubject(person({ birthDate: '2020-03-04', sex: 'female' }), TODAY);
  assert.ok(hidden.includes('wedding'));
  assert.ok(hidden.includes('debut'));
  assert.ok(!hidden.includes('christening'));
});

test('a seventeen-year-old keeps debut and still cannot be married', () => {
  // Born 2009-03-04 → turns 18 on 2009+18 = 2027-03-04, inside the 548-day debut
  // horizon, so debut is a real concern. Wedding stays folded until she is 18.
  const hidden = hiddenTypesForSubject(person({ birthDate: '2009-03-04', sex: 'female' }), TODAY);
  assert.ok(!hidden.includes('debut'));
  assert.ok(hidden.includes('wedding'));
});

test('an elder alaga folds away debut and christening, never wedding', () => {
  const hidden = hiddenTypesForSubject(person({ name: 'Lola Rosa', birthDate: '1947-02-11', sex: 'female' }), TODAY);
  assert.ok(hidden.includes('debut'));
  assert.ok(hidden.includes('christening'));
  assert.ok(!hidden.includes('wedding'));
});

test('picking “You” keeps the UNLABELED honoree slot', () => {
  // Load-bearing: the unlabeled slot has always meant the account holder. A name
  // here would open a second slot beside every unlabeled event already created.
  assert.equal(subjectHonoreeLabel(buildSelfSubject('Ice')), '');
  assert.equal(subjectHonoreeLabel(buildUnspecifiedSubject()), '');
  assert.equal(subjectHonoreeLabel(null), '');
});

test('picking an alaga carries their first name as the honoree key', () => {
  assert.equal(subjectHonoreeLabel(person({ name: '  Nina  ' })), 'Nina');
  assert.equal(subjectHonoreeLabel(person({ name: 'x'.repeat(200) })).length, 80);
});

test('dependentSubjects drops what it cannot honestly offer', () => {
  const subjects = dependentSubjects(
    [
      { dependent_id: 'a', name: 'Nina', dependent_kind: 'person', birth_date: '2020-03-04', sex: 'female' },
      { dependent_id: 'b', name: '   ', dependent_kind: 'person', birth_date: null, sex: null },
      { dependent_id: 'c', name: 'Handed over', dependent_kind: 'person', birth_date: null, sex: null, handed_over_at: '2026-01-01' },
      { dependent_id: 'd', name: 'Me, claimed', dependent_kind: 'person', birth_date: null, sex: null, claimed_user_id: 'u1' },
      { dependent_id: 'e', name: 'Bantay', dependent_kind: 'pet', birth_date: '2020-01-05', sex: 'female' },
    ],
    'u1',
  );
  assert.deepEqual(
    subjects.map((s) => s.id),
    ['a', 'e'],
  );
  // A pet carries no sensitive human fields even when the row has them.
  const pet = subjects.find((s) => s.id === 'e')!;
  assert.equal(pet.kind, 'pet');
  assert.equal(pet.birthDate, null);
  assert.equal(pet.sex, null);
});

test('dependentSubjects tolerates a missing / empty read', () => {
  assert.deepEqual(dependentSubjects(null, 'u1'), []);
  assert.deepEqual(dependentSubjects([], 'u1'), []);
});

test('“You” and “someone else” keep the account’s existing household measurement', () => {
  // The grid must stay byte-identical to today for the two answers that carry
  // no data of their own — the who step may sort, it may never UN-hide.
  const account = ['debut', 'christening'];
  assert.deepEqual(gridHiddenTypes(buildSelfSubject('Ice'), account, TODAY), account);
  assert.deepEqual(gridHiddenTypes(buildUnspecifiedSubject(), account, TODAY), account);
  assert.deepEqual(gridHiddenTypes(null, account, TODAY), account);
});

test('a named alaga replaces the household measurement with their own', () => {
  const nina = person({ birthDate: '2020-03-04', sex: 'female' });
  const hidden = gridHiddenTypes(nina, ['graduation'], TODAY);
  // The household's "graduation" fold does not apply to Nina; her own does.
  assert.ok(!hidden.includes('graduation'));
  assert.ok(hidden.includes('wedding'));
});

test('with no clock, the grid falls back rather than folding away MORE', () => {
  // An unparseable "today" makes every date comparison false, which reads as
  // "nothing concerns them" — i.e. it would hide more, not less.
  const nina = person({ birthDate: '2020-03-04', sex: 'female' });
  assert.deepEqual(gridHiddenTypes(nina, ['debut'], ''), ['debut']);
});

test('the self row never invents a name', () => {
  assert.equal(buildSelfSubject(null).name, 'You');
  assert.equal(buildSelfSubject('   ').name, 'You');
  assert.equal(buildSelfSubject('Ice').name, 'Ice');
});
