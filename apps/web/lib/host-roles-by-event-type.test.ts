/**
 * The per-event-type host role list.
 *
 * As with the category ladder, the FIRST assertion is the one that matters
 * most: the wedding list must not shrink. Weddings are the only event type with
 * real hosts in production, so a narrowing bug that ate a wedding role would be
 * strictly worse than the breadth defect being fixed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ROLE_SUBTYPES,
  HOST_ROLES_BY_EVENT_TYPE,
  hostRolesForEventType,
  isRoleSubtype,
} from './host-roles';

const WEDDING_13 = [
  'bride',
  'groom',
  'partner1',
  'partner2',
  'parent_of_bride',
  'parent_of_groom',
  'maid_of_honor',
  'best_man',
  'wedding_planner_external',
  'ninong',
  'ninang',
  'family_helper',
  'viewer',
];

test('the wedding list is exactly the original 13, in the original order', () => {
  assert.deepEqual([...hostRolesForEventType('wedding')], WEDDING_13);
});

test('a missing event type is treated as a wedding, like the rest of the dashboard', () => {
  assert.deepEqual([...hostRolesForEventType(null)], WEDDING_13);
  assert.deepEqual([...hostRolesForEventType(undefined)], WEDDING_13);
});

test('an unknown event type fails OPEN — every role, never an empty picker', () => {
  const roles = hostRolesForEventType('a_type_invented_next_year');
  assert.deepEqual([...roles], [...ROLE_SUBTYPES]);
});

test('no non-wedding event type offers wedding vocabulary', () => {
  // The whole point of the phase. `ninong`/`ninang` are deliberately exempt:
  // they are genuine christening roles, not wedding-only words.
  const weddingOnly = [
    'bride',
    'groom',
    'parent_of_bride',
    'parent_of_groom',
    'maid_of_honor',
    'best_man',
    'wedding_planner_external',
  ];
  for (const [type, roles] of Object.entries(HOST_ROLES_BY_EVENT_TYPE)) {
    if (type === 'wedding') continue;
    for (const w of weddingOnly) {
      assert.ok(
        !roles.includes(w as (typeof roles)[number]),
        `${type} still offers the wedding role "${w}"`,
      );
    }
  }
});

test('christening keeps the godparents — they are its own roles, not borrowed ones', () => {
  const roles = hostRolesForEventType('christening');
  assert.ok(roles.includes('ninong'));
  assert.ok(roles.includes('ninang'));
  assert.ok(roles.includes('celebrant'));
  assert.ok(roles.includes('parent'));
});

test('every event type can name whoever is running it', () => {
  for (const [type, roles] of Object.entries(HOST_ROLES_BY_EVENT_TYPE)) {
    if (type === 'wedding') continue;
    const canOrganise =
      roles.includes('host') || roles.includes('partner1') || roles.includes('celebrant');
    assert.ok(canOrganise, `${type} has nobody who can be recorded as running it`);
  }
});

test('every event type can at least be watched read-only', () => {
  for (const [type, roles] of Object.entries(HOST_ROLES_BY_EVENT_TYPE)) {
    assert.ok(roles.includes('viewer'), `${type} cannot admit a read-only viewer`);
  }
});

test('no role set is empty, and none contains a duplicate', () => {
  for (const [type, roles] of Object.entries(HOST_ROLES_BY_EVENT_TYPE)) {
    assert.ok(roles.length > 0, `${type} offers no roles at all`);
    assert.equal(
      new Set(roles).size,
      roles.length,
      `${type} lists the same role twice: ${roles.join(', ')}`,
    );
  }
});

test('every mapped role is a real member of the vocabulary', () => {
  for (const [type, roles] of Object.entries(HOST_ROLES_BY_EVENT_TYPE)) {
    for (const r of roles) {
      assert.ok(isRoleSubtype(r), `${type} lists "${r}", which is not a legal role`);
    }
  }
});

test('a two-person date is not offered a crew', () => {
  const roles = hostRolesForEventType('date');
  assert.ok(!roles.includes('family_helper'), 'a dinner date does not need a family helper');
  assert.ok(roles.includes('partner1') && roles.includes('partner2'));
});

test('work events are not given family vocabulary', () => {
  for (const type of ['corporate', 'tournament', 'gala_night', 'simple_event']) {
    const roles = hostRolesForEventType(type);
    assert.ok(!roles.includes('family_helper'), `${type} offers "family helper"`);
    assert.ok(!roles.includes('parent'), `${type} offers "parent"`);
  }
});
