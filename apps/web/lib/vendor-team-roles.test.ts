import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VENDOR_ASSIGNABLE_ROLES, VENDOR_TEAM_ROLES } from '@/lib/vendor-team';
import { VENDOR_TIERS } from '@/lib/vendor-tier-caps';
import {
  areExtendedRolesAvailable,
  asVendorTeamRoleExtended,
  assignableRolesForTier,
  canAccessBilling,
  canAssignBookings,
  canReadClientChat,
  canScheduleForTeam,
  isVendorTeamRoleV2,
  LOCKED_TEAM_SEAT_TOTAL,
  lockedTeamSeatTotal,
  parsableRolesForTier,
  seesTeamCalendar,
  VENDOR_TEAM_ROLE_BLURB_EXT,
  VENDOR_TEAM_ROLE_CAPS,
  VENDOR_TEAM_ROLE_LABEL_EXT,
  VENDOR_TEAM_ROLES_EXTENDED,
  vendorRoleCan,
  type VendorTeamCapability,
  type VendorTeamRoleExtended,
} from '@/lib/vendor-team-roles';

/**
 * Vendor team roles — Financial + Secretary (Vendor_Monetization_Model_LOCKED
 * _2026-07-25 § 7). These tests pin three things:
 *   1. the HARD boundary — Financial can never read client chat,
 *   2. every existing role's behaviour is unchanged (byte-identity),
 *   3. flag OFF / below-Pro renders and parses exactly today's role set.
 */

const EXISTING_ROLES = ['owner', 'admin', 'agent', 'viewer'] as const;
const ALL_CAPABILITIES: VendorTeamCapability[] = [
  'store_settings',
  'billing',
  'reports',
  'client_chat',
  'view_schedule',
  'own_calendar',
  'team_calendar',
  'schedule_team',
  'assign_bookings',
  'own_clients',
  'all_clients',
];

// ── 1. THE HARD BOUNDARY ────────────────────────────────────────────────────

test('HARD BOUNDARY: Financial can NEVER read client chat', () => {
  assert.equal(canReadClientChat('financial'), false);
  assert.equal(vendorRoleCan('financial', 'client_chat'), false);
  assert.equal(VENDOR_TEAM_ROLE_CAPS.financial.client_chat, false);
});

test('Financial gets the money surfaces and nothing else', () => {
  assert.equal(canAccessBilling('financial'), true);
  assert.equal(vendorRoleCan('financial', 'reports'), true);
  for (const cap of ALL_CAPABILITIES) {
    const expected = cap === 'billing' || cap === 'reports';
    assert.equal(
      vendorRoleCan('financial', cap),
      expected,
      `financial.${cap} should be ${expected}`,
    );
  }
});

test('every OTHER role that talks to clients still can', () => {
  for (const role of ['owner', 'admin', 'agent', 'secretary'] as const) {
    assert.equal(canReadClientChat(role), true, `${role} keeps client chat`);
  }
  assert.equal(canReadClientChat('viewer'), false); // read-only, never chatted
});

// ── 2. THE ROLE MATRIX (loop over every role × every capability) ────────────

test('Secretary = scheduling + comms across the team, never billing/settings', () => {
  assert.equal(canScheduleForTeam('secretary'), true);
  assert.equal(seesTeamCalendar('secretary'), true);
  assert.equal(canAssignBookings('secretary'), true);
  assert.equal(canReadClientChat('secretary'), true);
  assert.equal(vendorRoleCan('secretary', 'all_clients'), true);
  assert.equal(canAccessBilling('secretary'), false);
  assert.equal(vendorRoleCan('secretary', 'store_settings'), false);
  assert.equal(vendorRoleCan('secretary', 'reports'), false);
});

test('Agent = own clients + own calendar only (unchanged shape)', () => {
  assert.equal(vendorRoleCan('agent', 'own_clients'), true);
  assert.equal(vendorRoleCan('agent', 'own_calendar'), true);
  assert.equal(vendorRoleCan('agent', 'client_chat'), true);
  assert.equal(vendorRoleCan('agent', 'team_calendar'), false);
  assert.equal(vendorRoleCan('agent', 'all_clients'), false);
  assert.equal(vendorRoleCan('agent', 'schedule_team'), false);
  assert.equal(vendorRoleCan('agent', 'assign_bookings'), false);
  assert.equal(canAccessBilling('agent'), false);
});

test('Owner/Admin hold every capability, and are identical to each other', () => {
  for (const cap of ALL_CAPABILITIES) {
    assert.equal(vendorRoleCan('owner', cap), true, `owner.${cap}`);
    assert.equal(vendorRoleCan('admin', cap), true, `admin.${cap}`);
  }
  assert.deepEqual(VENDOR_TEAM_ROLE_CAPS.owner, VENDOR_TEAM_ROLE_CAPS.admin);
});

test('Viewer is read-only: view_schedule and nothing else', () => {
  for (const cap of ALL_CAPABILITIES) {
    assert.equal(
      vendorRoleCan('viewer', cap),
      cap === 'view_schedule',
      `viewer.${cap}`,
    );
  }
});

test('every role declares every capability explicitly (no undefined holes)', () => {
  for (const role of VENDOR_TEAM_ROLES_EXTENDED) {
    for (const cap of ALL_CAPABILITIES) {
      assert.equal(
        typeof VENDOR_TEAM_ROLE_CAPS[role][cap],
        'boolean',
        `${role}.${cap} must be a boolean`,
      );
    }
  }
});

test('store_settings stays Owner/Admin-only across the whole matrix', () => {
  for (const role of VENDOR_TEAM_ROLES_EXTENDED) {
    const expected = role === 'owner' || role === 'admin';
    assert.equal(vendorRoleCan(role, 'store_settings'), expected, `${role}`);
  }
});

// ── 3. NORMALIZATION — unknown input is least privilege ─────────────────────

test('unknown / null / empty role → viewer (least privilege), never a crash', () => {
  for (const raw of [null, undefined, '', 'ADMIN', 'superuser', 'Financial']) {
    assert.equal(asVendorTeamRoleExtended(raw), 'viewer', `${String(raw)}`);
    assert.equal(canReadClientChat(raw), false);
    assert.equal(canAccessBilling(raw), false);
    assert.equal(vendorRoleCan(raw, 'store_settings'), false);
  }
});

test('isVendorTeamRoleV2 recognises exactly the two new scopes', () => {
  assert.equal(isVendorTeamRoleV2('financial'), true);
  assert.equal(isVendorTeamRoleV2('secretary'), true);
  for (const r of EXISTING_ROLES) assert.equal(isVendorTeamRoleV2(r), false);
  assert.equal(isVendorTeamRoleV2(null), false);
});

// ── 4. BYTE-IDENTITY of the existing four ──────────────────────────────────

test('the extended union is a strict SUPERSET of today’s roles, in order', () => {
  assert.deepEqual(VENDOR_TEAM_ROLES_EXTENDED.slice(0, VENDOR_TEAM_ROLES.length), [
    ...VENDOR_TEAM_ROLES,
  ]);
  assert.deepEqual(VENDOR_TEAM_ROLES_EXTENDED.slice(VENDOR_TEAM_ROLES.length), [
    'financial',
    'secretary',
  ]);
});

test('labels + blurbs for the existing four are UNCHANGED verbatim', () => {
  assert.equal(VENDOR_TEAM_ROLE_LABEL_EXT.owner, 'Admin');
  assert.equal(VENDOR_TEAM_ROLE_LABEL_EXT.admin, 'Admin');
  assert.equal(VENDOR_TEAM_ROLE_LABEL_EXT.agent, 'Agent');
  assert.equal(VENDOR_TEAM_ROLE_LABEL_EXT.viewer, 'Viewer');
  assert.equal(
    VENDOR_TEAM_ROLE_BLURB_EXT.admin,
    'Top role — manages the whole store, including team and roles.',
  );
  assert.equal(
    VENDOR_TEAM_ROLE_BLURB_EXT.agent,
    'Assigned to specific services; sees only their own work.',
  );
  assert.equal(
    VENDOR_TEAM_ROLE_BLURB_EXT.viewer,
    'Read-only access to the schedule and bookings.',
  );
});

// ── 5. FLAG-OFF byte-identity of the pickers, over EVERY tier ──────────────

test('flag OFF: the assignable role list is exactly today’s, for every tier', () => {
  for (const tier of VENDOR_TIERS) {
    assert.deepEqual(
      assignableRolesForTier({ tier, enabled: false }),
      VENDOR_ASSIGNABLE_ROLES,
      `assignable roles must not change on ${tier} while the flag is OFF`,
    );
    assert.deepEqual(
      parsableRolesForTier({ tier, enabled: false }),
      VENDOR_TEAM_ROLES,
      `parsable roles must not change on ${tier} while the flag is OFF`,
    );
  }
  // …and for garbage / absent tiers too.
  for (const tier of [null, undefined, 'nonsense']) {
    assert.deepEqual(assignableRolesForTier({ tier, enabled: false }), VENDOR_ASSIGNABLE_ROLES);
    assert.deepEqual(parsableRolesForTier({ tier, enabled: false }), VENDOR_TEAM_ROLES);
  }
});

test('flag ON but tier below Pro: still exactly today’s role set', () => {
  for (const tier of ['free', 'verified', 'solo', null, undefined, 'nonsense']) {
    assert.equal(areExtendedRolesAvailable(tier), false, `${String(tier)} is below Pro`);
    assert.deepEqual(assignableRolesForTier({ tier, enabled: true }), VENDOR_ASSIGNABLE_ROLES);
    assert.deepEqual(parsableRolesForTier({ tier, enabled: true }), VENDOR_TEAM_ROLES);
  }
});

test('flag ON + Pro/Enterprise/Custom: the two new scopes are offered', () => {
  for (const tier of ['pro', 'enterprise', 'custom']) {
    assert.equal(areExtendedRolesAvailable(tier), true, `${tier} is Pro+`);
    const assignable = assignableRolesForTier({ tier, enabled: true });
    assert.deepEqual(assignable, [
      ...VENDOR_ASSIGNABLE_ROLES,
      'financial',
      'secretary',
    ]);
    const parsable = parsableRolesForTier({ tier, enabled: true });
    assert.deepEqual(parsable, [...VENDOR_TEAM_ROLES, 'financial', 'secretary']);
    // `owner` stays parsable so the "Owner role is retired" message still fires
    // instead of the generic "Unknown role."
    assert.ok(parsable.includes('owner'));
    // …but is never OFFERED.
    assert.ok(!assignable.includes('owner' as VendorTeamRoleExtended));
  }
});

// ── 6. SEATS (locked model § 7 totals — recorded, not enforced) ────────────

test('locked seat totals: Free/Solo 1 · Pro 3 · Enterprise 10', () => {
  assert.equal(lockedTeamSeatTotal('free'), 1);
  assert.equal(lockedTeamSeatTotal('verified'), 1);
  assert.equal(lockedTeamSeatTotal('solo'), 1);
  assert.equal(lockedTeamSeatTotal('pro'), 3);
  assert.equal(lockedTeamSeatTotal('enterprise'), 10);
  assert.equal(lockedTeamSeatTotal('custom'), 10);
  assert.equal(lockedTeamSeatTotal(null), 1); // unknown → most restrictive
  assert.equal(lockedTeamSeatTotal('nonsense'), 1);
});

test('every tier in VENDOR_TIERS has a locked seat total (no holes)', () => {
  for (const tier of VENDOR_TIERS) {
    assert.equal(typeof LOCKED_TEAM_SEAT_TOTAL[tier], 'number', tier);
  }
});
