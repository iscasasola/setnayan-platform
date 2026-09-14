/**
 * entourage.test — what a guest may read, in the order an invitation prints it.
 *
 * Three things are worth pinning and the rest is layout:
 *   · THE FENCE. `guests.role` also carries `guest`, `vip`, `family`, `helper`
 *     and both halves of the couple. This list publishes NAMES to everyone who
 *     can open the page, so a role drifting into it is a privacy defect, not a
 *     cosmetic one — and the fence is a allow-list, which is the only shape
 *     that stays closed when a new role is added to the enum.
 *   · THE ORDER, because it is the whole reason this module is not a `map`.
 *   · A LABEL FOR EVERY PUBLISHED ROLE. A published role with no label renders
 *     a name with nothing beside it, which is exactly the "names only" the
 *     owner ruled against.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEntourage,
  roleLabel,
  personName,
  ENTOURAGE_ROLES,
  type EntourageGuestRow,
} from './entourage';

const row = (over: Partial<EntourageGuestRow>): EntourageGuestRow => ({
  display_name: null,
  first_name: 'A',
  last_name: 'B',
  role: 'guest',
  extra_roles: null,
  ...over,
});

test('every published role carries a label', () => {
  const unlabelled = ENTOURAGE_ROLES.filter((r) => roleLabel(r) === null);
  assert.deepEqual(unlabelled, [], `published with no label: ${unlabelled.join(', ')}`);
});

test('the groups print in invitation order — sponsors before the entourage proper', () => {
  const groups = buildEntourage([
    row({ first_name: 'Lito', role: 'groomsman' }),
    row({ first_name: 'Rosa', role: 'principal_sponsor' }),
    row({ first_name: 'Mia', role: 'flower_girl' }),
    row({ first_name: 'Ent', role: 'bride_parents' }),
    row({ first_name: 'Cel', role: 'candle_sponsor' }),
    row({ first_name: 'Ana', role: 'maid_of_honor' }),
    row({ first_name: 'Bea', role: 'bridesmaid' }),
  ]);
  assert.deepEqual(
    groups.map((g) => g.key),
    [
      'parents',
      'principal_sponsors',
      'secondary_sponsors',
      'honour',
      'bridesmaids',
      'groomsmen',
      'bearers',
    ],
  );
});

test('a role nobody holds draws no heading', () => {
  const groups = buildEntourage([row({ first_name: 'Bea', role: 'bridesmaid' })]);
  assert.deepEqual(groups.map((g) => g.key), ['bridesmaids']);
});

test('the fence: plain guests, the couple and the generic roles are never published', () => {
  const groups = buildEntourage([
    row({ first_name: 'Nobody', role: 'guest' }),
    row({ first_name: 'Bride', role: 'bride' }),
    row({ first_name: 'Groom', role: 'groom' }),
    row({ first_name: 'Veep', role: 'vip' }),
    row({ first_name: 'Kin', role: 'family' }),
    row({ first_name: 'Hand', role: 'helper' }),
    row({ first_name: 'Host', role: 'host' }),
  ]);
  assert.deepEqual(groups, []);
});

test('a guest who holds two roles stands in both places', () => {
  const groups = buildEntourage([
    row({ first_name: 'Bea', role: 'bridesmaid', extra_roles: ['candle_sponsor'] }),
  ]);
  assert.deepEqual(
    groups.map((g) => [g.key, g.people.map((p) => `${p.name}:${p.role}`)]),
    [
      ['secondary_sponsors', ['Bea B:candle_sponsor']],
      ['bridesmaids', ['Bea B:bridesmaid']],
    ],
  );
});

test('a row with no usable name is dropped, not printed blank', () => {
  const groups = buildEntourage([
    row({ display_name: '   ', first_name: '', last_name: '', role: 'bridesmaid' }),
    row({ first_name: 'Bea', last_name: 'Reyes', role: 'bridesmaid' }),
  ]);
  assert.deepEqual(groups[0]?.people.map((p) => p.name), ['Bea Reyes']);
});

test('the couple’s chosen display name wins over first + last', () => {
  assert.equal(
    personName({ display_name: 'Tita Rosa', first_name: 'Rosario', last_name: 'Cruz' }),
    'Tita Rosa',
  );
  assert.equal(personName({ first_name: 'Rosario', last_name: 'Cruz' }), 'Rosario Cruz');
  assert.equal(personName({ first_name: null, last_name: null }), null);
});
