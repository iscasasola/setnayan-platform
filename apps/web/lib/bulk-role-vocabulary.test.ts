/**
 * The picker and its validator are two halves of ONE decision.
 *
 * They were two literals that drifted into near-inverses: the picker offered
 * the four VIP-family roles and omitted bride/groom; the validator rejected
 * those four and allowed bride/groom. Each half was internally consistent, so
 * no test OF EITHER HALF could have caught it — only a test of the pair.
 *
 * That is what these assertions are: they fail if a role can be OFFERED and
 * not APPLIED, or offered and not storable.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  BULK_ROLE_SECTIONS,
  bulkRoleSectionsFor,
  bulkAssignableRolesFor,
} from './bulk-role-vocabulary';
import { WEDDING_ROLE_SET, resolveRoleSet } from './role-sets';
import type { GuestRole } from './guests';

test('THE REGRESSION: the four VIP-family roles are bulk-assignable', () => {
  // Reported 2026-09-14 from the live roster: picking "Bride's Parents" in
  // Assign role… and hitting Apply bounced with `invalid_role`.
  const allowed = bulkAssignableRolesFor('wedding');
  for (const role of [
    'bride_parents',
    'groom_parents',
    'bride_immediate_family',
    'groom_immediate_family',
  ] as GuestRole[]) {
    assert.ok(allowed.includes(role), `${role} must be bulk-assignable`);
  }
});

test('EVERY role the picker offers is one the validator accepts', () => {
  // The load-bearing assertion. Both sides now read one export, so this holds
  // by construction — it is here to fail loudly if someone re-introduces a
  // second hand-typed list, which is exactly how the bug arrived.
  for (const key of ['wedding', 'wedding_muslim', 'generic', 'simple', null]) {
    const offered = bulkRoleSectionsFor(key).flatMap((s) => s.roles);
    const accepted = bulkAssignableRolesFor(key);
    assert.deepEqual(
      [...offered].sort(),
      [...accepted].sort(),
      `picker and validator disagree for role set "${key}"`,
    );
  }
});

test('every bulk-assignable role is one the EVENT actually offers', () => {
  // A role can be offered by the picker, accepted by the action, and still be
  // invalid for the event type — this pins the third party to the agreement.
  for (const key of ['wedding', 'wedding_muslim', 'generic', 'simple']) {
    const offeredByEvent = resolveRoleSet(key).offeredRoles;
    for (const role of bulkAssignableRolesFor(key)) {
      assert.ok(
        offeredByEvent.includes(role),
        `"${role}" is bulk-assignable for "${key}" but not in its offered roles`,
      );
    }
  }
});

test('bride and groom are offered by NEITHER half', () => {
  // Owner directive 2026-06-03: the couple is set at event creation and is not
  // a role you bulk-assign. The old validator ALLOWED them while the picker
  // never showed them — a hole this fix closes in passing.
  const allowed = bulkAssignableRolesFor('wedding');
  assert.ok(!allowed.includes('bride'), 'bride must not be bulk-assignable');
  assert.ok(!allowed.includes('groom'), 'groom must not be bulk-assignable');
});

test('the retired plain principal_sponsor is offered by NEITHER half', () => {
  // Owner 2026-09-15: "we can now successfully remove the Principal Sponsor
  // role since we already alloted the Ninong and Ninang to each Principal
  // Sponsor. This will be the same rule across all other weddings."
  //
  // The two tests above already pin picker ⊆ role set ⊆ picker, so a
  // half-revert fails there. This one exists for the OTHER direction: a
  // wholesale re-add to both lists would satisfy every other assertion in this
  // file and silently repeal a standing ruling. Here it has to argue with a
  // quote.
  const allowed = bulkAssignableRolesFor('wedding');
  assert.ok(
    !allowed.includes('principal_sponsor' as GuestRole),
    'the plain principal_sponsor is retired — a sponsor is a Ninong or a Ninang',
  );
  // And its two successors are both still there, because retiring the parent
  // is only safe while the children are offered.
  assert.ok(allowed.includes('principal_sponsor_ninong' as GuestRole), 'Ninong must stay offered');
  assert.ok(allowed.includes('principal_sponsor_ninang' as GuestRole), 'Ninang must stay offered');
});

test('a non-wedding event falls back to its own offered roles', () => {
  const generic = bulkAssignableRolesFor('generic');
  assert.deepEqual([...generic].sort(), [...resolveRoleSet('generic').offeredRoles].sort());
});

test('the picker lists no role twice', () => {
  // A duplicate would render the same option in two sections — cosmetic, but
  // it is also the fingerprint of a half-finished copy/paste edit.
  const all = BULK_ROLE_SECTIONS.flatMap((s) => s.roles);
  assert.equal(new Set(all).size, all.length, 'a role appears in two sections');
});

test('the wedding picker covers every offered role except the couple', () => {
  // Anything in the event's role set that is neither the couple nor offered by
  // the picker is a role the host simply cannot bulk-assign — which may be
  // deliberate, but should be a decision, not an omission. Today: exactly the
  // couple, and (for Catholic weddings) nothing else.
  const missing = WEDDING_ROLE_SET.offeredRoles.filter(
    (r) => r !== 'bride' && r !== 'groom' && !bulkAssignableRolesFor('wedding').includes(r),
  );
  assert.deepEqual(missing, [], `not bulk-assignable: ${missing.join(', ')}`);
});
