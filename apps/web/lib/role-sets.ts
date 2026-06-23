/**
 * role-sets.ts — iteration 0053 Phase 2 (the per-event-type ROLE SET).
 *
 * A RoleSet bundles everything that varies by event type about guest roles:
 * which roles a picker offers, which a guest may self-claim, which are
 * at-most-one-per-event, and how roles map to the four seating tiers (+ labels).
 * Surfaces resolve it from the Event-Type Profile: resolveRoleSet(profile.roleSetKey).
 *
 * WHY A CODE CONSTANT (not a DB table): guest_role is a closed Postgres ENUM
 * mirrored by the GuestRole union, which already forces compile-time
 * exhaustiveness via Record<GuestRole, …> in lib/guests.ts + lib/role-groups.ts.
 * A DB row would discard that type guard and re-introduce the drift Phase 0's
 * fallbacks were built to avoid. seating.test.ts also pins the wedding tier
 * sets/labels — a code constant keeps that regression gate meaningful. This
 * mirrors how the profile's roleSetKey/templatePackKey/… resolve to code packs.
 *
 * OWNERSHIP NOTE: this module is the single source of the wedding seating-tier
 * data (tier sets + labels). lib/seating.ts imports WEDDING_ROLE_SET from here
 * and re-exports ROLE_TIER_LABELS for back-compat — so there is exactly one set
 * of literals and no copy-paste drift. The import is one-directional
 * (seating → role-sets → guests); role-sets imports ONLY the GuestRole type.
 */
import type { GuestRole } from './guests';

export type RoleSet = {
  key: string;
  /** Roles the add/edit-guest picker offers, in display order. */
  offeredRoles: GuestRole[];
  /** Narrower subset a guest may self-claim when joining via link. */
  selfClaimableRoles: GuestRole[];
  /** At-most-one-per-event roles (DB partial-unique-index-backed). */
  singletonRoles: GuestRole[];
  /** Seating auto-fill rings. Typed as string-sets because the seating
   *  classifiers accept role: string (a free DB value). */
  tier1Roles: ReadonlySet<string>;
  tier2Roles: ReadonlySet<string>;
  /** Roles that map to tier 3 WITHOUT relying on group_category==='family'.
   *  Wedding's is EMPTY (its tier 3 is purely group-category-based), which keeps
   *  the wedding tier mapping byte-identical. */
  tier3Roles: ReadonlySet<string>;
  /** The four seating-tier labels (the priority picker / P-chip). */
  tierLabels: Record<1 | 2 | 3 | 4, string>;
  /** The principal(s) excluded from the auto-seat pool (e.g. the couple). */
  coupleRoles: ReadonlySet<string>;
};

// --- Wedding ---------------------------------------------------------------
// The literal values below are the canonical wedding role data. They reproduce
// EXACTLY the pre-0053 hard-coded constants: ROLE_OPTIONS (the 24-value picker),
// SELECTABLE_ROLES (the 18-value self-claim subset), SINGLETON_GUEST_ROLES, and
// lib/seating.ts's TIER1_ROLES / TIER2_ROLES / ROLE_TIER_LABELS. seating.test.ts
// is the regression gate proving the tier mapping is unchanged.

const WEDDING_OFFERED: GuestRole[] = [
  'guest',
  'bride',
  'groom',
  'bride_parents',
  'groom_parents',
  'bride_immediate_family',
  'groom_immediate_family',
  'maid_of_honor',
  'matron_of_honor',
  'best_man',
  'bridesmaid',
  'groomsman',
  'principal_sponsor',
  'candle_sponsor',
  'veil_sponsor',
  'cord_sponsor',
  'coin_sponsor',
  'ring_bearer',
  'bible_bearer',
  'coin_bearer',
  'flower_girl',
  'officiant',
  'reader_lector',
  'soloist_musician',
];

// Self-claim excludes the couple (bride/groom) + the 4 VIP-family roles.
const WEDDING_SELF_CLAIMABLE: GuestRole[] = [
  'guest',
  'maid_of_honor',
  'matron_of_honor',
  'best_man',
  'bridesmaid',
  'groomsman',
  'principal_sponsor',
  'candle_sponsor',
  'veil_sponsor',
  'cord_sponsor',
  'coin_sponsor',
  'ring_bearer',
  'bible_bearer',
  'coin_bearer',
  'flower_girl',
  'officiant',
  'reader_lector',
  'soloist_musician',
];

export const WEDDING_ROLE_SET: RoleSet = {
  key: 'wedding',
  offeredRoles: WEDDING_OFFERED,
  selfClaimableRoles: WEDDING_SELF_CLAIMABLE,
  singletonRoles: ['bride', 'groom'],
  tier1Roles: new Set<string>([
    'principal_sponsor',
    'officiant',
    'reader_lector',
    'soloist_musician',
    'bride_parents',
    'groom_parents',
    'bride_immediate_family',
    'groom_immediate_family',
  ]),
  tier2Roles: new Set<string>([
    'maid_of_honor',
    'matron_of_honor',
    'best_man',
    'bridesmaid',
    'groomsman',
    'candle_sponsor',
    'veil_sponsor',
    'cord_sponsor',
    'coin_sponsor',
    'ring_bearer',
    'bible_bearer',
    'coin_bearer',
    'flower_girl',
  ]),
  tier3Roles: new Set<string>(), // empty → wedding tier 3 stays group_category-based
  tierLabels: {
    1: 'Family & principal sponsors',
    2: 'Entourage',
    3: 'Extended family',
    4: 'Friends & others',
  },
  coupleRoles: new Set<string>(['bride', 'groom']),
};

// --- Generic ---------------------------------------------------------------
// The neutral default for any non-wedding event type. Uses the additive enum
// values (migration 20270220984328): host/vip/family/helper + the universal
// 'guest'. NOT consumed until a surface threads a generic event's role set
// (Phase 2 PR-2) AND a generic profile row exists; ships inert.

export const GENERIC_ROLE_SET: RoleSet = {
  key: 'generic',
  offeredRoles: ['guest', 'host', 'vip', 'family', 'helper'],
  // Self-claim excludes 'host' (the organizer), mirroring how wedding excludes
  // the couple from self-claim.
  selfClaimableRoles: ['guest', 'family', 'vip', 'helper'],
  singletonRoles: [], // generic roles are all multi-instance
  tier1Roles: new Set<string>(['host', 'vip']),
  tier2Roles: new Set<string>(), // generic has no "entourage" ring
  tier3Roles: new Set<string>(['family']),
  tierLabels: {
    1: 'Guests of honor',
    2: 'Honored guests',
    3: 'Family',
    4: 'Other guests',
  },
  coupleRoles: new Set<string>(), // no couple → no sweetheart exclusion
};

export const ROLE_SETS: Record<string, RoleSet> = {
  wedding: WEDDING_ROLE_SET,
  generic: GENERIC_ROLE_SET,
};

/**
 * Resolve the RoleSet for a profile's roleSetKey. 'wedding' → WEDDING_ROLE_SET;
 * null / 'generic' / unknown → GENERIC_ROLE_SET (the degrade-to-generic default,
 * same spirit as resolveProfile's fallback).
 */
export function resolveRoleSet(roleSetKey: string | null | undefined): RoleSet {
  return (roleSetKey && ROLE_SETS[roleSetKey]) || GENERIC_ROLE_SET;
}
