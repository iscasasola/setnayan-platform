/**
 * my-loved-ones.test.ts — the Loved ones count equals the Loved ones list, for
 * every kind in your care (a child, an elder, a pet, a business), and nobody
 * else's row is either (owner's People page, 2026-09-29: "Loved ones 1" above
 * "No loved ones yet." — another user's business, visible only because the
 * owner is an admin).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { belongsOnMyPeoplePage, lovedOnesInMyCare, myLovedOnes, spouseIdSet } from './my-loved-ones';

const ME = 'u-me';
const SPOUSE = 'u-spouse';
const STRANGER = 'u-stranger';

type Row = {
  dependent_id: string;
  name: string;
  dependent_kind: 'person' | 'pet' | 'business' | 'other';
  owner_user_id: string | null;
  handed_over_by_user_id: string | null;
  shared_with_spouse: boolean | null;
  handed_over_at: string | null;
};

const row = (over: Partial<Row> & Pick<Row, 'dependent_id' | 'name'>): Row => ({
  dependent_kind: 'person',
  owner_user_id: ME,
  handed_over_by_user_id: null,
  shared_with_spouse: false,
  handed_over_at: null,
  ...over,
});

/** What an ADMIN's RLS read returns: everyone's rows, mine among them. */
const ADMIN_READ: Row[] = [
  row({ dependent_id: 'd1', name: 'Liam', dependent_kind: 'person' }),
  row({ dependent_id: 'd2', name: 'Bantay', dependent_kind: 'pet' }),
  row({ dependent_id: 'd3', name: 'Amara’s Kitchen', dependent_kind: 'business' }),
  row({ dependent_id: 'd4', name: 'Lola Nena', dependent_kind: 'person', owner_user_id: SPOUSE, shared_with_spouse: true }),
  row({ dependent_id: 'd5', name: 'Bea', owner_user_id: 'u-bea', handed_over_by_user_id: ME, handed_over_at: '2026-09-01T00:00:00Z' }),
  // Not mine — the admin sees them only through RLS.
  row({ dependent_id: 'x1', name: 'Indigo Caterers', dependent_kind: 'business', owner_user_id: STRANGER, shared_with_spouse: true }),
  row({ dependent_id: 'x2', name: 'Spouse’s private', owner_user_id: SPOUSE, shared_with_spouse: false }),
  row({ dependent_id: 'x3', name: 'Stranger’s child', owner_user_id: STRANGER }),
];

test('🔴 the count IS the list — every in-your-care kind, a Business included', () => {
  const spouses = spouseIdSet([SPOUSE]);
  const listed = myLovedOnes(ADMIN_READ, ME, spouses);
  const counted = myLovedOnes(ADMIN_READ, ME, spouses).length;
  assert.equal(counted, listed.length);
  assert.deepEqual(
    listed.map((d) => d.dependent_id),
    ['d1', 'd2', 'd3', 'd4', 'd5'],
    'mine (person · pet · business) · my spouse’s shared · the one I handed over',
  );
  assert.ok(
    listed.some((d) => d.dependent_kind === 'business' && d.owner_user_id === ME),
    'my own Business row is listed — and therefore counted',
  );
});

test('🔴 another user’s Business ("Indigo Caterers") is neither listed nor counted — even for an admin', () => {
  const listed = myLovedOnes(ADMIN_READ, ME, spouseIdSet([SPOUSE]));
  assert.ok(!listed.some((d) => d.name === 'Indigo Caterers'));
  assert.ok(!listed.some((d) => d.dependent_id === 'x2'), 'a spouse’s row they did NOT share');
  assert.ok(!listed.some((d) => d.dependent_id === 'x3'));
  // The owner's real case: no registered spouse at all.
  const noSpouse = myLovedOnes(ADMIN_READ, ME, spouseIdSet([]));
  assert.ok(!noSpouse.some((d) => d.owner_user_id === STRANGER || d.owner_user_id === SPOUSE));
  assert.equal(noSpouse.length, 4);
});

test('the rows still IN MY CARE (for the guest list) leave out the one I handed over', () => {
  const inCare = lovedOnesInMyCare(ADMIN_READ, ME, spouseIdSet([SPOUSE]));
  assert.deepEqual(inCare.map((d) => d.dependent_id), ['d1', 'd2', 'd3', 'd4']);
});

test('nobody signed in sees nothing; the spouse set takes only strings', () => {
  assert.equal(belongsOnMyPeoplePage(ADMIN_READ[0]!, '', spouseIdSet([SPOUSE])), false);
  assert.deepEqual([...spouseIdSet([SPOUSE, 7, null, { id: 'x' }])], [SPOUSE]);
  assert.equal(spouseIdSet(null).size, 0);
});
