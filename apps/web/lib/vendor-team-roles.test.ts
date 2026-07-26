import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VENDOR_ASSIGNABLE_ROLES, VENDOR_TEAM_ROLES } from '@/lib/vendor-team';
import { VENDOR_TIERS } from '@/lib/vendor-tier-caps';
import {
  areExtendedRolesAvailable,
  asVendorTeamRoleExtended,
  assignableRolesForTier,
  isVendorTeamRoleExtended,
  isVendorTeamRoleV2,
  LOCKED_TEAM_SEAT_TOTAL,
  lockedTeamSeatTotal,
  parsableRoleSet,
  parsableRolesForTier,
  rolesForRow,
  VENDOR_TEAM_CAPABILITIES,
  VENDOR_TEAM_ROLE_BLURB_EXT,
  VENDOR_TEAM_ROLE_CAPS,
  VENDOR_TEAM_ROLE_LABEL_EXT,
  VENDOR_TEAM_ROLES_EXTENDED,
  VENDOR_TEAM_ROLES_V2,
  vendorRoleCan,
  type VendorTeamRoleExtended,
} from '@/lib/vendor-team-roles';

/**
 * Vendor team roles — Secretary (Vendor_Monetization_Model_LOCKED_2026-07-25
 * § 7). `financial` was DESCOPED 2026-07-26: its "no client chat" boundary is
 * not expressible in the single-scalar `current_vendor_ids` rank, so it is not
 * shipped at all. These tests pin:
 *   1. that Financial really is gone from every surface,
 *   2. that `vendorRoleCan` fails CLOSED for a non-member,
 *   3. every existing role's behaviour is unchanged (byte-identity),
 *   4. flag OFF / below-Pro renders and parses exactly today's role set.
 */

const EXISTING_ROLES = ['owner', 'admin', 'agent', 'viewer'] as const;
const ALL_CAPABILITIES = VENDOR_TEAM_CAPABILITIES;

// ── 1. FINANCIAL IS DESCOPED — it must not exist anywhere ───────────────────

test('DESCOPED: `financial` is not a role this module knows about', () => {
  assert.equal(isVendorTeamRoleExtended('financial'), false);
  assert.equal(isVendorTeamRoleV2('financial'), false);
  assert.ok(!VENDOR_TEAM_ROLES_EXTENDED.includes('financial' as VendorTeamRoleExtended));
  assert.ok(!(VENDOR_TEAM_ROLES_V2 as readonly string[]).includes('financial'));
  assert.equal(
    Object.prototype.hasOwnProperty.call(VENDOR_TEAM_ROLE_CAPS, 'financial'),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(VENDOR_TEAM_ROLE_LABEL_EXT, 'financial'),
    false,
  );
});

test('DESCOPED: `financial` holds NO capability, including the ones it was meant to have', () => {
  for (const cap of ALL_CAPABILITIES) {
    assert.equal(vendorRoleCan('financial', cap), false, `financial.${cap}`);
  }
});

test('DESCOPED: `financial` can never be offered or parsed, on any tier, flag ON', () => {
  for (const tier of VENDOR_TIERS) {
    assert.ok(
      !assignableRolesForTier({ tier, enabled: true }).includes(
        'financial' as VendorTeamRoleExtended,
      ),
      `assignable on ${tier}`,
    );
    assert.ok(
      !parsableRolesForTier({ tier, enabled: true }).includes(
        'financial' as VendorTeamRoleExtended,
      ),
      `parsable on ${tier}`,
    );
    assert.equal(parsableRoleSet({ tier, enabled: true }).has('financial'), false, tier);
  }
});

// ── 2. FAIL-CLOSED authorization (adversarial review defect 2) ──────────────

test('FAIL-CLOSED: an unknown / absent role holds NO capability at all', () => {
  const nonMembers = [null, undefined, '', 'customer', 'ADMIN', 'superuser', 'Secretary', 'financial'];
  for (const raw of nonMembers) {
    for (const cap of ALL_CAPABILITIES) {
      assert.equal(
        vendorRoleCan(raw, cap),
        false,
        `${String(raw)}.${cap} must be false — a non-member is not a viewer`,
      );
    }
  }
});

test('FAIL-CLOSED: view_schedule specifically — the cap that used to leak', () => {
  // `asVendorTeamRoleExtended` still normalizes unknown → 'viewer' for DISPLAY,
  // and 'viewer' does hold view_schedule. vendorRoleCan must NOT go through it.
  assert.equal(asVendorTeamRoleExtended(null), 'viewer');
  assert.equal(vendorRoleCan('viewer', 'view_schedule'), true);
  for (const raw of [null, undefined, '', 'customer']) {
    assert.equal(vendorRoleCan(raw, 'view_schedule'), false, String(raw));
  }
});

test('TIER-AWARE: a Pro+ scope evaporates when the store is no longer Pro+', () => {
  // No tier argument → the raw matrix (unchanged behaviour for existing callers).
  assert.equal(vendorRoleCan('secretary', 'client_chat'), true);
  // Tier supplied → read-time lapse, the pattern the repo uses for entitlements.
  for (const tier of ['pro', 'enterprise', 'custom']) {
    assert.equal(vendorRoleCan('secretary', 'client_chat', tier), true, tier);
  }
  for (const tier of ['free', 'verified', 'solo', null, 'nonsense']) {
    for (const cap of ALL_CAPABILITIES) {
      assert.equal(
        vendorRoleCan('secretary', cap, tier),
        false,
        `secretary.${cap} on ${String(tier)} must lapse`,
      );
    }
  }
  // The built-in four are NOT tier-gated — an Agent stays an Agent on Free.
  assert.equal(vendorRoleCan('agent', 'client_chat', 'free'), true);
  assert.equal(vendorRoleCan('admin', 'billing', 'free'), true);
  assert.equal(vendorRoleCan('viewer', 'view_schedule', 'free'), true);
});

// ── 3. THE ROLE MATRIX (descriptive) ───────────────────────────────────────

test('Secretary = scheduling + comms across the team, never billing/settings', () => {
  assert.equal(vendorRoleCan('secretary', 'schedule_team'), true);
  assert.equal(vendorRoleCan('secretary', 'team_calendar'), true);
  assert.equal(vendorRoleCan('secretary', 'assign_bookings'), true);
  assert.equal(vendorRoleCan('secretary', 'client_chat'), true);
  assert.equal(vendorRoleCan('secretary', 'all_clients'), true);
  assert.equal(vendorRoleCan('secretary', 'billing'), false);
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
  assert.equal(vendorRoleCan('agent', 'billing'), false);
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
    assert.equal(vendorRoleCan('viewer', cap), cap === 'view_schedule', `viewer.${cap}`);
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

test('billing + store_settings stay Owner/Admin-only across the whole matrix', () => {
  for (const role of VENDOR_TEAM_ROLES_EXTENDED) {
    const expected = role === 'owner' || role === 'admin';
    assert.equal(vendorRoleCan(role, 'store_settings'), expected, `${role}.store_settings`);
    assert.equal(vendorRoleCan(role, 'billing'), expected, `${role}.billing`);
  }
});

test('isVendorTeamRoleV2 recognises exactly the new scope', () => {
  assert.equal(isVendorTeamRoleV2('secretary'), true);
  for (const r of EXISTING_ROLES) assert.equal(isVendorTeamRoleV2(r), false);
  assert.equal(isVendorTeamRoleV2(null), false);
});

// ── 4. BYTE-IDENTITY of the existing four ──────────────────────────────────

test('the extended union is a strict SUPERSET of today’s roles, in order', () => {
  assert.deepEqual(VENDOR_TEAM_ROLES_EXTENDED.slice(0, VENDOR_TEAM_ROLES.length), [
    ...VENDOR_TEAM_ROLES,
  ]);
  assert.deepEqual(VENDOR_TEAM_ROLES_EXTENDED.slice(VENDOR_TEAM_ROLES.length), ['secretary']);
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

// ── 5. FLAG-OFF byte-identity of the pickers + THE PARSE SET ───────────────
//
// `parsableRoleSet` is exactly what `team/actions.ts` gates `parseRole` on. It
// lives in this (pure) module precisely so the flag-OFF guarantee is pinned by
// a test — a `'use server'` module cannot be imported by the unit runner.

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
  for (const tier of [null, undefined, 'nonsense']) {
    assert.deepEqual(assignableRolesForTier({ tier, enabled: false }), VENDOR_ASSIGNABLE_ROLES);
    assert.deepEqual(parsableRolesForTier({ tier, enabled: false }), VENDOR_TEAM_ROLES);
  }
});

test('flag OFF: the PARSE SET is exactly today’s four values, for every tier', () => {
  for (const tier of [...VENDOR_TIERS, null, undefined, 'nonsense']) {
    const set = parsableRoleSet({ tier, enabled: false });
    assert.deepEqual(
      [...set].sort(),
      [...VENDOR_TEAM_ROLES].sort(),
      `parse set changed on ${String(tier)} while the flag is OFF`,
    );
    assert.equal(set.has('secretary'), false, `secretary parsable on ${String(tier)} with flag OFF`);
    assert.equal(set.has('financial'), false, `financial parsable on ${String(tier)}`);
    // `owner` stays parsable so the "Owner role is retired" message still fires.
    assert.equal(set.has('owner'), true);
  }
});

test('flag ON + Pro+: the PARSE SET gains exactly `secretary`', () => {
  for (const tier of ['pro', 'enterprise', 'custom']) {
    const set = parsableRoleSet({ tier, enabled: true });
    assert.deepEqual([...set].sort(), [...VENDOR_TEAM_ROLES, 'secretary'].sort(), tier);
  }
  for (const tier of ['free', 'verified', 'solo']) {
    const set = parsableRoleSet({ tier, enabled: true });
    assert.equal(set.has('secretary'), false, `${tier} is below Pro`);
  }
});

test('flag ON but tier below Pro: still exactly today’s role set', () => {
  for (const tier of ['free', 'verified', 'solo', null, undefined, 'nonsense']) {
    assert.equal(areExtendedRolesAvailable(tier), false, `${String(tier)} is below Pro`);
    assert.deepEqual(assignableRolesForTier({ tier, enabled: true }), VENDOR_ASSIGNABLE_ROLES);
    assert.deepEqual(parsableRolesForTier({ tier, enabled: true }), VENDOR_TEAM_ROLES);
  }
});

test('flag ON + Pro/Enterprise/Custom: the new scope is offered', () => {
  for (const tier of ['pro', 'enterprise', 'custom']) {
    assert.equal(areExtendedRolesAvailable(tier), true, `${tier} is Pro+`);
    const assignable = assignableRolesForTier({ tier, enabled: true });
    assert.deepEqual(assignable, [...VENDOR_ASSIGNABLE_ROLES, 'secretary']);
    const parsable = parsableRolesForTier({ tier, enabled: true });
    assert.deepEqual(parsable, [...VENDOR_TEAM_ROLES, 'secretary']);
    assert.ok(parsable.includes('owner'));
    assert.ok(!assignable.includes('owner' as VendorTeamRoleExtended));
  }
});

// ── 6. rolesForRow — a held role is never silently dropped ─────────────────

test('rolesForRow keeps a role the picker no longer offers', () => {
  const offered = assignableRolesForTier({ tier: 'pro', enabled: false }); // admin/agent/viewer
  // A Secretary member left over from when the flag was on must stay selectable
  // — otherwise the <select> falls back to its first option (Admin) and a plain
  // label edit PROMOTES them.
  assert.deepEqual(rolesForRow(offered, 'secretary'), [...offered, 'secretary']);
  // Already-offered roles pass straight through (same array identity).
  assert.equal(rolesForRow(offered, 'agent'), offered);
});

// ── 7. SEATS (locked model § 7 totals — recorded, not enforced) ────────────

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
