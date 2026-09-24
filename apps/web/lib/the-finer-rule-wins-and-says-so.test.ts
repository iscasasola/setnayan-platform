/**
 * the-finer-rule-wins-and-says-so.test.ts
 *
 * Two properties, and the second is the one that will be forgotten.
 *
 * 1. A role's own rule beats its group's. A couple who wrote something for
 *    ninang specifically meant it.
 * 2. 🛑 AND THE EDITOR IS TOLD WHICH ROLES WILL IGNORE IT. Precedence applied
 *    silently is its own failure: the couple writes "barong, ecru" on
 *    `principal_sponsors`, saves, and ninang does not change. Nothing is wrong
 *    and nothing says so — correct behaviour and a broken feature rendering
 *    identically, which is this codebase's signature defect.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLE_GROUPS_IN_ORDER,
  groupOverrides,
  resolveAttireFor,
  sanitizeGroupAttire,
} from './role-group-dress-code';
import { ROLE_GROUP_LABELS } from './role-groups';
import type { RoleAttireMap } from './role-dress-code';

const GROUP = { principal_sponsors: { style: 'filipiniana', note: 'barong, ecru' } } as const;

test('⛔ a role rule BEATS its group rule, and the winner names itself', () => {
  const roles = { principal_sponsor_ninang: { style: 'long_gown', note: 'her own gown' } } as RoleAttireMap;
  const g = sanitizeGroupAttire(GROUP);

  const ninang = resolveAttireFor('principal_sponsor_ninang', roles, g);
  assert.equal(ninang?.source, 'role', 'the group overwrote a rule the couple wrote for her');
  assert.equal(ninang?.rule.note, 'her own gown');

  // A sibling in the same group with no rule of her own falls to the group.
  const ninong = resolveAttireFor('principal_sponsor_ninong', roles, g);
  assert.equal(ninong?.source, 'group');
  assert.equal(ninong?.rule.note, 'barong, ecru');
});

test('⛔ tiers do not MERGE — one author answers, never two', () => {
  // A role rule with no call time must NOT borrow the group's, or a couple
  // editing the group changes half of what she reads and not the other half.
  const roles = { principal_sponsor_ninang: { style: 'long_gown' } } as RoleAttireMap;
  const g = sanitizeGroupAttire({ principal_sponsors: { style: 'filipiniana', callTime: '07:30' } });
  const r = resolveAttireFor('principal_sponsor_ninang', roles, g);
  assert.equal(r?.source, 'role');
  assert.equal(r?.rule.callTime, undefined, 'the call time leaked across tiers');
});

test('🛑 the editor is told exactly which roles will ignore the group', () => {
  const roles = {
    principal_sponsor_ninang: { style: 'long_gown' },
    principal_sponsor_ninong: { style: 'filipiniana' },
    flower_girl: { style: 'cocktail_dress' },
  } as RoleAttireMap;

  var o = groupOverrides('principal_sponsors', roles);
  assert.equal(o.length, 2, 'both overridden sponsors must be named before the couple types');
  assert.ok(o.every((n) => typeof n === 'string' && n.length > 0));
  // Labels a person recognises, not role keys.
  assert.ok(!o.some((n) => n.includes('_')), 'raw role keys reached a couple: ' + o.join(', '));
  // A role from another group must not be reported here.
  assert.ok(!groupOverrides('principal_sponsors', roles).some((n) => /flower/i.test(n)));
  // And a group nobody has overridden says so with an empty list, not a guess.
  assert.deepEqual(groupOverrides('officiants', roles), []);
});

test('⛔ a stored value this product did not write is DROPPED, never repaired', () => {
  assert.deepEqual(sanitizeGroupAttire(null), {});
  assert.deepEqual(sanitizeGroupAttire([{ style: 'long_gown' }]), {});
  assert.deepEqual(sanitizeGroupAttire({ not_a_group: { style: 'long_gown' } }), {});
  assert.deepEqual(sanitizeGroupAttire({ officiants: { style: 'Long Gown' } }), {}, 'a near-miss style was repaired');
  // A half-read call time is worse than none — somebody sets an alarm by it.
  var out = sanitizeGroupAttire({ officiants: { style: 'long_gown', callTime: '7' } });
  assert.equal(out.officiants?.callTime, undefined, '"7" survived as a call time');
  assert.equal(out.officiants?.style, 'long_gown', 'the rest of the rule should still stand');
});

test('🔑 the twelve come from the exhaustive Record, so they cannot fall out of date', () => {
  assert.equal(ROLE_GROUPS_IN_ORDER.length, 12);
  assert.deepEqual(
    [...ROLE_GROUPS_IN_ORDER].sort(),
    Object.keys(ROLE_GROUP_LABELS).sort(),
    'the list and the Record disagree — one of them was retyped',
  );
  // 'guest' is NOT a role group. ROLE_GROUP_CHIP/TEXT carry it as a 13th key,
  // and a byRole record copied from either shape would file a dress code under
  // a key that belongs to nobody.
  assert.ok(!(ROLE_GROUPS_IN_ORDER as readonly string[]).includes('guest'));
});

test('⛔ a plain guest gets no personal answer from either tier', () => {
  const g = sanitizeGroupAttire(GROUP);
  assert.equal(resolveAttireFor('guest', {}, g), null);
  assert.equal(resolveAttireFor(null, {}, g), null);
  assert.equal(resolveAttireFor(undefined, {}, g), null);
});
