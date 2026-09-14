/**
 * A LENS THE EVENT HAS NO ROLES FOR IS NOT A LENS.
 *
 * Owner 2026-09-14: "this guestlist works for weddings. but does not apply to
 * other events."
 *
 * `viewFiltersFor` only ever asked Muslim-or-Catholic, so a BIRTHDAY — whose
 * role set offers guest/host/vip/family/helper and nothing else — was still
 * offered "Groomsmen", "Principal Sponsors", "Bearers & Flower Girl" and
 * "Officiants & Readers". Every one filtered to an empty roster, because no
 * birthday guest can hold those roles. Four dead controls on a live page.
 *
 * 🔑 THE FIX IS DERIVED, WHICH IS WHY THIS TEST IS ABOUT THE DERIVATION.
 * A hand-kept "wedding-only" list is what produced the bug; a second one would
 * reproduce it. The lens survives only if the event's own `offeredRoles`
 * contains a role in that group — so a future event type gets the right lenses
 * the day it is added, with nobody editing a list.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { resolveRoleSet } from '@/lib/role-sets';
import { roleGroupOf } from '@/lib/role-groups';

/** Mirror of the shipped rule — the property, not the implementation. */
function lensSurvives(roleSetKey: string | null, lensKey: string): boolean {
  const offered = resolveRoleSet(roleSetKey).offeredRoles;
  return new Set(offered.map((r) => roleGroupOf(r))).has(lensKey as never);
}

test('THE REGRESSION: a non-wedding event is offered no wedding lens', () => {
  for (const lens of [
    'groomsmen',
    'bridesmaids',
    'principal_sponsors',
    'secondary_sponsors',
    'bearers_flower_girl',
    'vip_family',
  ]) {
    assert.equal(
      lensSurvives('generic', lens),
      false,
      `a generic event still offers "${lens}" — it filters to an empty roster`,
    );
    assert.equal(lensSurvives('simple', lens), false, `a simple event still offers "${lens}"`);
  }
});

test('a wedding keeps every lens it has roles for', () => {
  for (const lens of [
    'groomsmen',
    'bridesmaids',
    'principal_sponsors',
    'secondary_sponsors',
    'bearers_flower_girl',
    'officiants',
    'vip_family',
  ]) {
    assert.equal(lensSurvives('wedding', lens), true, `a wedding lost its "${lens}" lens`);
  }
});

test('the split lenses are BOTH real on a wedding — neither is decorative', () => {
  // If the Groomsmen/Bridesmaids split ever collapsed back to one group, one of
  // these would go false while the UI kept showing two chips.
  assert.equal(lensSurvives('wedding', 'groomsmen'), true);
  assert.equal(lensSurvives('wedding', 'bridesmaids'), true);
});

test('the Nikah lens belongs to the Muslim set and not the Catholic one', () => {
  assert.equal(lensSurvives('wedding_muslim', 'muslim_principals'), true);
  assert.equal(lensSurvives('wedding', 'muslim_principals'), false);
});

test('the rule is not vacuous — a role set with roles yields SOME lens', () => {
  // A derivation over an empty list would pass every assertion above forever.
  for (const key of ['wedding', 'wedding_muslim', 'generic', 'simple']) {
    assert.ok(
      resolveRoleSet(key).offeredRoles.length > 0,
      `${key} offers no roles at all — every lens assertion above is vacuous`,
    );
  }
});
