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
  subjectHonoreeDependentId,
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

test('“You” with NO saved birthday sorts nothing away — the grid stays whole', () => {
  // The path every account with a blank profile birthday takes. Must remain
  // byte-identical to what shipped before the self read existed.
  assert.deepEqual(hiddenTypesForSubject(buildSelfSubject('Ice'), TODAY), []);
  assert.deepEqual(hiddenTypesForSubject(buildSelfSubject('Ice', null), TODAY), []);
  assert.deepEqual(hiddenTypesForSubject(buildSelfSubject('Ice', { birth_date: null }), TODAY), []);
  assert.deepEqual(hiddenTypesForSubject(buildSelfSubject('Ice', { birth_date: '' }), TODAY), []);
});

test('“Someone else” and no subject at all sort nothing away', () => {
  assert.deepEqual(hiddenTypesForSubject(buildUnspecifiedSubject(), TODAY), []);
  assert.deepEqual(hiddenTypesForSubject(null, TODAY), []);
});

test('every non-person kind folds away every person-only life type', () => {
  const pet = person({ kind: 'pet', name: 'Bantay', birthDate: '2020-01-05' });
  const hidden = hiddenTypesForSubject(pet, TODAY);
  for (const key of ['wedding', 'debut', 'christening', 'graduation', 'gender_reveal']) {
    assert.ok(hidden.includes(key), `expected ${key} folded away for a pet`);
  }
  // A dog's birthday party is an ordinary Filipino celebration — never folded.
  assert.ok(!hidden.includes('birthday'));
  assert.ok(!hidden.includes('anniversary'));
  // The rule is "not a person", not a list of kinds — so the two the owner added
  // (business, item) behave identically WITHOUT another edit here, and so will
  // the next one.
  for (const kind of ['pet', 'business', 'item', 'other'] as const) {
    assert.deepEqual(
      hiddenTypesForSubject(person({ kind, name: 'The Vios', birthDate: '2014-01-05' }), TODAY),
      ['wedding', 'debut', 'christening', 'graduation', 'gender_reveal'],
      `kind=${kind}`,
    );
  }
});

test('a business and an item become their own subjects, not “something else”', () => {
  const subjects = dependentSubjects(
    [
      { dependent_id: 'biz', name: 'Aling Nena’s Store', dependent_kind: 'business', birth_date: '2014-01-05', sex: null },
      { dependent_id: 'car', name: 'The Vios', dependent_kind: 'item', birth_date: '2019-06-01', sex: null },
      { dependent_id: 'huh', name: 'Mystery', dependent_kind: 'not_a_kind', birth_date: null, sex: null },
    ],
    'u1',
  );
  const [biz, car, huh] = subjects;
  assert.equal(biz?.kind, 'business');
  assert.equal(biz?.subtitle, 'Alaga · business');
  assert.equal(car?.kind, 'item');
  assert.equal(car?.subtitle, 'Alaga · something you own');
  // A business's founding date is NOT a birthdate — it must never reach the
  // human ladder, so it is dropped at the subject boundary like a pet's.
  assert.equal(biz?.birthDate, null);
  assert.equal(car?.birthDate, null);
  // An unrecognised kind falls back to person: the stricter reading (it keeps the
  // human types on offer rather than folding them away for a row we misread).
  assert.equal(huh?.kind, 'person');
  assert.equal(huh?.subtitle, 'Alaga · person');
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

test('picking an alaga also carries WHICH record — the key that beats a spelling', () => {
  assert.equal(subjectHonoreeDependentId(person({ id: 'dep-9' })), 'dep-9');
  // Every non-person alaga carries one too: a pet has a birthday party, and its
  // record is just as much the thing being celebrated.
  assert.equal(subjectHonoreeDependentId(person({ id: 'dep-9', kind: 'pet' })), 'dep-9');
});

test('“You” and “Someone else” carry NO link — symmetric with the label', () => {
  // Load-bearing: the unlabeled/unlinked slot has always meant the account
  // holder, and "You" is a users row, not a dependents row. Stamping anything
  // here would open a second slot beside every event they already created.
  assert.equal(subjectHonoreeDependentId(buildSelfSubject('Ice')), null);
  assert.equal(subjectHonoreeDependentId(buildUnspecifiedSubject()), null);
  assert.equal(subjectHonoreeDependentId(null), null);
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

// ── the account holder's OWN birthday (owner-directed 2026-07-30) ────────────

test('“You” now reads the account’s own saved birthday', () => {
  // "their birthdays shows based from their account" — the read the previous
  // pass deliberately skipped, pending exactly this decision.
  const me = buildSelfSubject('Ice', { birth_date: '1990-04-02' });
  assert.equal(me.kind, 'self');
  assert.equal(me.birthDate, '1990-04-02');
});

test('“You”, measured, folds the same way a person alaga does', () => {
  // A 36-year-old is nowhere near a debut and long past the binyag window, so
  // both MEASURED life types fold. It stays a fold — "show all" is one tap away.
  const hidden = hiddenTypesForSubject(buildSelfSubject('Ice', { birth_date: '1990-04-02' }), TODAY);
  assert.ok(hidden.includes('debut'));
  assert.ok(hidden.includes('christening'));
  // An adult's own wedding is never folded — wedding is not a measured type and
  // the marriage floor only bites under 18.
  assert.ok(!hidden.includes('wedding'));
  // Unmeasured types are never touched by a birthdate.
  assert.ok(!hidden.includes('birthday'));
  assert.ok(!hidden.includes('graduation'));
});

test('a self approaching her own debut keeps debut on her own grid', () => {
  // Turns 18 on 2027-03-04, inside the 548-day debut horizon. The shipped
  // promise — "an 18-year-old CAN plan her own debut" — must survive the read.
  const hidden = hiddenTypesForSubject(buildSelfSubject('Nina', { birth_date: '2009-03-04' }), TODAY);
  assert.ok(!hidden.includes('debut'));
});

test('self reads sex only when supplied, and omitting it folds LESS', () => {
  // The create page deliberately does NOT read users.sex (its own RA 10173
  // consent stamp; the owner directed birthdays). Without it both 18 and 21 are
  // checked, so a subject is MORE likely to be "concerned" → less folding. That
  // is the documented fail-open direction and this pins it.
  const male21 = { birth_date: '2005-03-04' }; // turns 21 on 2026-03-04… past
  const soon21 = { birth_date: '2006-03-04' }; // turns 21 on 2027-03-04 — inside
  assert.equal(buildSelfSubject('A', soon21).sex, null);
  assert.ok(!hiddenTypesForSubject(buildSelfSubject('A', soon21), TODAY).includes('debut'));
  // With sex='female' the 21 check is dropped, so the same date folds debut.
  assert.ok(
    hiddenTypesForSubject(buildSelfSubject('A', { ...soon21, sex: 'female' }), TODAY).includes('debut'),
  );
  // A garbage sex is ignored rather than trusted.
  assert.equal(buildSelfSubject('A', { ...male21, sex: 'other' }).sex, null);
});

test('a malformed profile birthday narrows nothing rather than being coerced', () => {
  for (const bad of ['not-a-date', '1990-4-2', '02/04/1990', '1990-04-02T00:00:00Z']) {
    assert.equal(buildSelfSubject('Ice', { birth_date: bad }).birthDate, null, bad);
    assert.deepEqual(hiddenTypesForSubject(buildSelfSubject('Ice', { birth_date: bad }), TODAY), []);
  }
});

test('gridHiddenTypes: an unmeasured “You” keeps the household reading, a measured one replaces it', () => {
  const account = ['debut', 'christening'];
  // No saved birthday → byte-identical to today.
  assert.deepEqual(gridHiddenTypes(buildSelfSubject('Ice'), account, TODAY), account);
  // A saved birthday is strictly more precise than the household, exactly like a
  // named alaga — so it replaces it. Here: a 17-year-old self, whose own debut is
  // imminent, un-folds the debut the household reading had folded away.
  const teen = gridHiddenTypes(buildSelfSubject('Nina', { birth_date: '2009-03-04' }), account, TODAY);
  assert.ok(!teen.includes('debut'));
  // …and the marriage floor still bites on her own grid.
  assert.ok(teen.includes('wedding'));
});

test('with no clock, a measured “You” still falls back to the household', () => {
  const me = buildSelfSubject('Ice', { birth_date: '1990-04-02' });
  assert.deepEqual(gridHiddenTypes(me, ['debut'], ''), ['debut']);
});
