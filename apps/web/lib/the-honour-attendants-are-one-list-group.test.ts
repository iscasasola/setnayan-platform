/**
 * 👯 THE HONOUR ATTENDANTS ARE ONE GROUP ON GUESTS › LIST (owner 2026-11-01, DECISION_LOG "GUESTS › LIST: DRAG TO
 * CHANGE ROLE · HONOUR ATTENDANTS GET THEIR OWN GROUP", verbatim: *"there should be a dedicated group for best woman,
 * best man, maid of honor and matron of honor and man of honor because right now they are on the grooms crew and brides
 * crew"*).
 *
 * Held, by RUNNING the List's own sectioning (`rosterSections`, the Role view):
 *   1. the five honour roles share ONE section, "Honour attendants", drawn above both crews and not split by side;
 *      the crews keep only their own members;
 *   2. a guest is sectioned by their MOST important role — a best man who is also a principal sponsor stands where
 *      that role ranks him, as every other guest does;
 *   3. the section head's ＋ adds one of the five; the crews no longer offer them;
 *   4. the List's role SORT ranks Honour attendants above both crews (`ROLE_SECTION_ORDER`);
 *   5. the five are the dress code's honour roles (`HONOUR_ROW_OF`) — one fact, not two lists that drift;
 *   6. the Groomsmen / Bridesmaids views (`filterByRoleGroup`) hold only their crews; "honour_attendants" holds the five.
 *
 * SABOTAGE, seen red: `roleBucket` without the honour check → (1) · the section dropped from `ROLE_ORDER` → (1) ·
 * the honour set missing `man_of_honor` → (3) and (5) · the crews' views counting the honour roles again → (6).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { rosterSections } from './guest-roster-view';
import { sectionHeadDoors } from './guest-section-head';
import { HONOUR_ATTENDANT_ROLES, HONOUR_ATTENDANTS_LABEL } from './role-groups';
import { HONOUR_ROW_OF } from './attire-rows';
import type { GuestRole, GuestRow } from './guests';
import { ROLE_SECTION_ORDER } from '../app/dashboard/[eventId]/guests/_components/role-section-order';

const FACTS = { roleNames: null, hasSides: true, groupsOf: () => [], tableOf: () => null };
let n = 0;
const guest = (role: GuestRole, side: 'bride' | 'groom', extra: GuestRole[] = []) =>
  ({ guest_id: `g${++n}`, role, extra_roles: extra, side, first_name: role, last_name: side, rsvp_status: 'attending' }) as unknown as GuestRow;

const LIST = [
  guest('bride', 'bride'),
  guest('groom', 'groom'),
  guest('groomsman', 'groom'),
  guest('best_man', 'groom'),
  guest('best_woman', 'groom'),
  guest('bridesmaid', 'bride'),
  guest('maid_of_honor', 'bride'),
  guest('matron_of_honor', 'bride'),
  guest('man_of_honor', 'bride'),
  guest('guest', 'bride'),
];

test('1 · the five honour roles are ONE section, above both crews, both sides together', () => {
  const sections = rosterSections(LIST, 'role', FACTS);
  const keys = sections.map((s) => s.key);
  console.log(`sections: ${sections.map((s) => `${s.label} (${s.guests.length})`).join(' · ')}`);
  const honour = sections.find((s) => s.key === 'role:honour_attendants');
  assert.ok(honour, 'there is no Honour attendants section');
  assert.equal(honour!.label, HONOUR_ATTENDANTS_LABEL);
  assert.deepEqual(new Set(honour!.guests.map((g) => g.role)), new Set(HONOUR_ATTENDANT_ROLES), 'the section does not hold exactly the five');
  assert.deepEqual(new Set(honour!.guests.map((g) => g.side)), new Set(['bride', 'groom']), 'the section is split by side');
  for (const crew of ['role:groomsmen', 'role:bridesmaids']) {
    const at = keys.indexOf(crew);
    assert.ok(at > keys.indexOf('role:honour_attendants'), `${crew} is drawn above Honour attendants`);
    const roles = sections[at]!.guests.map((g) => g.role);
    assert.ok(roles.length > 0 && roles.every((r) => !HONOUR_ATTENDANT_ROLES.includes(r)), `${crew} still holds an honour attendant: ${roles.join(', ')}`);
  }
});

test('2 · a guest is sectioned by their most important role', () => {
  const sponsorBestMan = guest('principal_sponsor_ninong', 'groom', ['best_man']);
  const honourAlsoSponsor = guest('best_man', 'groom', ['candle_sponsor']);
  const sections = rosterSections([sponsorBestMan, honourAlsoSponsor], 'role', FACTS);
  const of = (id: string) => sections.find((s) => s.guests.some((g) => g.guest_id === id))!.key;
  // The best man ranks above a principal sponsor in the importance order, so he is in Honour attendants either way.
  assert.equal(of(honourAlsoSponsor.guest_id), 'role:honour_attendants');
  assert.equal(of(sponsorBestMan.guest_id), 'role:honour_attendants');
});

test('3 · the section head adds one of the five; the crews no longer offer them', () => {
  const offeredRoles = ['bride', 'groom', 'best_man', 'best_woman', 'groomsman', 'maid_of_honor', 'matron_of_honor', 'man_of_honor', 'bridesmaid', 'guest'] as GuestRole[];
  const ctx = { groups: [], offeredRoles };
  const honour = sectionHeadDoors('role:honour_attendants', ctx);
  assert.deepEqual(honour.add, { roles: HONOUR_ATTENDANT_ROLES.filter((r) => offeredRoles.includes(r)) });
  assert.equal(honour.rename, null, 'a category heading offers a rename');
  assert.deepEqual(sectionHeadDoors('role:groomsmen', ctx).add, { roles: ['groomsman'] });
  assert.deepEqual(sectionHeadDoors('role:bridesmaids', ctx).add, { roles: ['bridesmaid'] });
});

test('4 · the role sort ranks Honour attendants above both crews', () => {
  const at = ROLE_SECTION_ORDER.indexOf(HONOUR_ATTENDANTS_LABEL);
  assert.ok(at >= 0, 'the role sort has no Honour attendants');
  assert.ok(at < ROLE_SECTION_ORDER.indexOf('Groomsmen') && at < ROLE_SECTION_ORDER.indexOf('Bridesmaids'));
});

test('5 · the five are the dress code’s honour roles — one fact', () => {
  assert.deepEqual(new Set(HONOUR_ATTENDANT_ROLES), new Set(Object.keys(HONOUR_ROW_OF)));
});

test('6 · the Groomsmen and Bridesmaids views no longer hold the honour attendants (owner 2026-11-01: yes)', async () => {
  const { filterByRoleGroup } = await import('./role-groups');
  const names = (view: string) => filterByRoleGroup(LIST, view).map((g) => g.role).sort();
  assert.deepEqual(names('groomsmen'), ['groomsman'], 'the Groomsmen view still holds an honour attendant');
  assert.deepEqual(names('bridesmaids'), ['bridesmaid'], 'the Bridesmaids view still holds an honour attendant');
  assert.deepEqual(new Set(names('honour_attendants')), new Set(HONOUR_ATTENDANT_ROLES), 'the Honour attendants view does not hold exactly the five');
  // A guest with a crew role AND an honour role still answers to the crew (their crew role is not an honour one).
  const both = guest('best_man', 'groom', ['groomsman']);
  assert.equal(filterByRoleGroup([both], 'groomsmen').length, 1);
  // Other views are untouched.
  assert.deepEqual(filterByRoleGroup(LIST, 'all').length, LIST.length);
});
