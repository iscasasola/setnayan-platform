/**
 * vendor-team-roles.ts — the two NEW vendor team scopes (Financial · Secretary)
 * and the capability matrix for ALL of them.
 *
 * Spec: Vendor_Monetization_Model_LOCKED_2026-07-25.md § 7 —
 *   Owner/Admin  all, incl. billing + settings
 *   Agent        own clients + own calendar
 *   Financial    billing / payments / reports, **NO client chat**
 *   Secretary    scheduling + comms across the team
 *   Seats: Free/Solo 1 (owner only) · Pro 3 · Enterprise 10.
 *   Roles + agent scheduling are **Pro+**.
 *
 * DESIGN — this EXTENDS `lib/vendor-team.ts`, it does not replace it. The
 * existing `VendorTeamRole` union (owner/admin/agent/viewer) is left BYTE-
 * IDENTICAL: every `Record<VendorTeamRole, …>` in the codebase (nav ranks, role
 * tones, labels) keeps compiling untouched. The two new scopes live in a WIDER
 * union here, so consumers opt in explicitly.
 *
 * PURE by construction — no env reads, no clock, no I/O. The env flag lives in
 * `lib/vendor-team-roles-flag.ts`; the notification side-effect lives in
 * `lib/vendor-team-assignment-notify.ts`.
 */

import {
  VENDOR_ASSIGNABLE_ROLES,
  VENDOR_TEAM_ROLES,
  type VendorTeamRole,
} from '@/lib/vendor-team';
import { isTierAtLeast, type VendorTier } from '@/lib/vendor-tier-caps';

/** The two scopes added by the 2026-07-25 locked model. */
export const VENDOR_TEAM_ROLES_V2 = ['financial', 'secretary'] as const;
export type VendorTeamRoleV2 = (typeof VENDOR_TEAM_ROLES_V2)[number];

/** Existing four + the two new scopes. Superset of `VendorTeamRole`. */
export type VendorTeamRoleExtended = VendorTeamRole | VendorTeamRoleV2;

export const VENDOR_TEAM_ROLES_EXTENDED: ReadonlyArray<VendorTeamRoleExtended> = [
  ...VENDOR_TEAM_ROLES,
  ...VENDOR_TEAM_ROLES_V2,
];

export function isVendorTeamRoleV2(role: string | null | undefined): role is VendorTeamRoleV2 {
  return (VENDOR_TEAM_ROLES_V2 as readonly string[]).includes(role ?? '');
}

/** Normalize an arbitrary string to an extended role; unknown → 'viewer' (least privilege). */
export function asVendorTeamRoleExtended(
  raw: string | null | undefined,
): VendorTeamRoleExtended {
  return (VENDOR_TEAM_ROLES_EXTENDED as readonly string[]).includes(raw ?? '')
    ? (raw as VendorTeamRoleExtended)
    : 'viewer';
}

// ── Labels + blurbs ─────────────────────────────────────────────────────────
// The four existing entries repeat `lib/vendor-team.ts` VERBATIM so swapping a
// consumer over to the extended map is a no-op for today's roles.

export const VENDOR_TEAM_ROLE_LABEL_EXT: Record<VendorTeamRoleExtended, string> = {
  owner: 'Admin', // legacy rows surface as Admin
  admin: 'Admin',
  agent: 'Agent',
  viewer: 'Viewer',
  financial: 'Financial',
  secretary: 'Secretary',
};

export const VENDOR_TEAM_ROLE_BLURB_EXT: Record<VendorTeamRoleExtended, string> = {
  owner: 'Top role — manages the whole store, including team and roles.',
  admin: 'Top role — manages the whole store, including team and roles.',
  agent: 'Assigned to specific services; sees only their own work.',
  viewer: 'Read-only access to the schedule and bookings.',
  financial:
    'Billing, payments and reports. Cannot open client chats or messages.',
  secretary:
    'Scheduling and messages across the whole team. No billing or settings.',
};

// ── Capability matrix ───────────────────────────────────────────────────────

/**
 * The capability axes § 7 distinguishes. Deliberately small and behavioural —
 * each one answers a question a surface actually asks.
 */
export type VendorTeamCapability =
  /** Store settings, plan/tier, team management. Owner/Admin only. */
  | 'store_settings'
  /** Billing, payments, invoices. Owner/Admin + Financial. */
  | 'billing'
  /** Financial reports + payouts. Owner/Admin + Financial. */
  | 'reports'
  /** Read/send CLIENT chat + messages. HARD-FALSE for Financial. */
  | 'client_chat'
  /** See the schedule at all (read-only counts). */
  | 'view_schedule'
  /** Has an own calendar they work out of. */
  | 'own_calendar'
  /** Sees the UNIFIED team calendar (everyone's bookings). */
  | 'team_calendar'
  /** May schedule/reschedule on behalf of the whole team. */
  | 'schedule_team'
  /** May assign a booking to a team member (fires the assignment notice). */
  | 'assign_bookings'
  /** Sees only their OWN assigned clients. */
  | 'own_clients'
  /** Sees EVERY client of the store. */
  | 'all_clients';

const ALL_CAPS: Record<VendorTeamCapability, boolean> = {
  store_settings: true,
  billing: true,
  reports: true,
  client_chat: true,
  view_schedule: true,
  own_calendar: true,
  team_calendar: true,
  schedule_team: true,
  assign_bookings: true,
  own_clients: true,
  all_clients: true,
};

const NO_CAPS: Record<VendorTeamCapability, boolean> = {
  store_settings: false,
  billing: false,
  reports: false,
  client_chat: false,
  view_schedule: false,
  own_calendar: false,
  team_calendar: false,
  schedule_team: false,
  assign_bookings: false,
  own_clients: false,
  all_clients: false,
};

/**
 * Role → capability. `owner` and `admin` are identical (owner is the legacy
 * value kept for old rows — see isVendorAdminRole).
 */
export const VENDOR_TEAM_ROLE_CAPS: Record<
  VendorTeamRoleExtended,
  Record<VendorTeamCapability, boolean>
> = {
  owner: { ...ALL_CAPS },
  admin: { ...ALL_CAPS },
  // Agent — "own clients + own calendar". Chats with THEIR clients; never sees
  // the team calendar, billing, or anyone else's clients.
  agent: {
    ...NO_CAPS,
    client_chat: true,
    view_schedule: true,
    own_calendar: true,
    own_clients: true,
  },
  // Viewer — read-only schedule + bookings (unchanged from today's blurb).
  viewer: { ...NO_CAPS, view_schedule: true },
  // Financial — "billing/payments/reports, NO client chat". client_chat is the
  // HARD boundary of this role: it is the reason the role exists (a bookkeeper
  // gets the money surfaces without reading couples' private conversations).
  financial: { ...NO_CAPS, billing: true, reports: true },
  // Secretary/Coordinator — "scheduling + comms across the team". Sees every
  // client + the unified calendar, may reschedule and assign work. Explicitly
  // NOT billing and NOT store settings.
  secretary: {
    ...NO_CAPS,
    client_chat: true,
    view_schedule: true,
    own_calendar: true,
    team_calendar: true,
    schedule_team: true,
    assign_bookings: true,
    all_clients: true,
  },
};

/** THE predicate. Unknown/absent role → least privilege (viewer). */
export function vendorRoleCan(
  role: string | null | undefined,
  capability: VendorTeamCapability,
): boolean {
  return VENDOR_TEAM_ROLE_CAPS[asVendorTeamRoleExtended(role)][capability];
}

/**
 * HARD BOUNDARY (locked model § 7): the Financial role must NEVER be able to
 * read client chat. Kept as its own named predicate — not an inline
 * `vendorRoleCan(role, 'client_chat')` — so the rule is greppable and the test
 * that pins it can never be "refactored away" by accident.
 */
export function canReadClientChat(role: string | null | undefined): boolean {
  if (asVendorTeamRoleExtended(role) === 'financial') return false; // belt AND braces
  return vendorRoleCan(role, 'client_chat');
}

export function canAccessBilling(role: string | null | undefined): boolean {
  return vendorRoleCan(role, 'billing');
}

export function canScheduleForTeam(role: string | null | undefined): boolean {
  return vendorRoleCan(role, 'schedule_team');
}

export function canAssignBookings(role: string | null | undefined): boolean {
  return vendorRoleCan(role, 'assign_bookings');
}

export function seesTeamCalendar(role: string | null | undefined): boolean {
  return vendorRoleCan(role, 'team_calendar');
}

// ── Tier gate + seats ───────────────────────────────────────────────────────

/**
 * Roles (beyond the built-in four) + agent scheduling are a **Pro+**
 * capability. Rank-derived via isTierAtLeast so `custom` — which runs as
 * Enterprise — inherits automatically.
 */
export function areExtendedRolesAvailable(tier: string | null | undefined): boolean {
  return isTierAtLeast(tier, 'pro');
}

/**
 * TOTAL team seats per the locked model § 7 — "Free/Solo 1 (owner only) · Pro 3
 * · Enterprise 10", i.e. INCLUDING the founding admin.
 *
 * ⚠ This is NOT the same number as `tierCaps().agentAccounts`, which counts
 * seats BEYOND the founding admin (free 0 · verified 0 · solo 1 · pro 3 ·
 * enterprise 10). Read literally, the two disagree for Solo (model: 1 total =
 * owner only; caps: 1 extra = 2 total) and for Pro/Enterprise (model 3/10 total
 * vs caps 3/10 extra = 4/11 total). Nothing here is wired into the seat-cap
 * enforcement — `team/actions.ts` still enforces `tierCaps().agentAccounts`
 * exactly as it does today. This constant exists so the discrepancy is written
 * down in code and the owner can settle it; flipping enforcement over is a
 * separate, deliberate change.
 */
export const LOCKED_TEAM_SEAT_TOTAL: Record<VendorTier, number> = {
  free: 1,
  verified: 1,
  solo: 1,
  pro: 3,
  enterprise: 10,
  custom: 10, // runs as Enterprise
};

export function lockedTeamSeatTotal(tier: string | null | undefined): number {
  const t = (Object.keys(LOCKED_TEAM_SEAT_TOTAL) as VendorTier[]).find((k) => k === tier);
  return t ? LOCKED_TEAM_SEAT_TOTAL[t] : LOCKED_TEAM_SEAT_TOTAL.free;
}

// ── What the role picker may offer ──────────────────────────────────────────

/**
 * The roles an admin may ASSIGN, for a given tier + flag state.
 *
 * FLAG OFF (or a tier below Pro) → returns exactly today's
 * `VENDOR_ASSIGNABLE_ROLES` (admin/agent/viewer) — same order, same values, so
 * the picker renders byte-identically.
 *
 * `enabled` is passed IN (never read from env here) so this module stays pure.
 */
export function assignableRolesForTier(args: {
  tier: string | null | undefined;
  enabled: boolean;
}): ReadonlyArray<VendorTeamRoleExtended> {
  if (!args.enabled || !areExtendedRolesAvailable(args.tier)) {
    return VENDOR_ASSIGNABLE_ROLES;
  }
  return [...VENDOR_ASSIGNABLE_ROLES, ...VENDOR_TEAM_ROLES_V2];
}

/**
 * The roles a server action may PARSE off a submitted form.
 *
 * FLAG OFF (or below Pro) → exactly today's `VENDOR_TEAM_ROLES`, INCLUDING the
 * retired `owner` value: `parseRole` accepts it and the caller then rejects it
 * with the friendly "Owner role is retired" message. Preserving that means an
 * `owner` submission keeps producing the same message instead of the generic
 * "Unknown role."
 */
export function parsableRolesForTier(args: {
  tier: string | null | undefined;
  enabled: boolean;
}): ReadonlyArray<VendorTeamRoleExtended> {
  if (!args.enabled || !areExtendedRolesAvailable(args.tier)) {
    return VENDOR_TEAM_ROLES;
  }
  return [...VENDOR_TEAM_ROLES, ...VENDOR_TEAM_ROLES_V2];
}
