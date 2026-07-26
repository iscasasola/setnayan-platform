/**
 * vendor-team-roles.ts — the ONE new vendor team scope (Secretary) and the
 * descriptive role × capability matrix.
 *
 * Spec: Vendor_Monetization_Model_LOCKED_2026-07-25.md § 7 —
 *   Owner/Admin  all, incl. billing + settings
 *   Agent        own clients + own calendar
 *   Financial    billing / payments / reports, **NO client chat**   ← DESCOPED
 *   Secretary    scheduling + comms across the team
 *   Seats: Free/Solo 1 (owner only) · Pro 3 · Enterprise 10.
 *   Roles + agent scheduling are **Pro+**.
 *
 * ⛔ FINANCIAL IS DESCOPED FROM THIS TRACK (2026-07-26, adversarial review).
 * Its defining promise — "billing/payments/reports but NEVER client chat" —
 * cannot be expressed by the access control this platform actually has.
 * `public.current_vendor_ids(min_role)` is a SINGLE SCALAR rank
 * (owner 4 > admin 3 > agent 2 > viewer 1) and vendor chat is gated at rank ≥ 1
 * while billing sits at rank ≥ 3. Any rank that lets Financial see billing
 * necessarily clears chat. Shipping the role would have shipped a boundary
 * promise that nothing enforces, so the role is not offered, not parsed, not in
 * the enum, and not in this matrix. Re-introducing it requires an RLS split
 * (e.g. `current_vendor_ids_billing`) plus a route guard — a design change the
 * owner has an open decision on (7-track report § 4 Q12).
 *
 * ⚠ THIS MATRIX IS DESCRIPTIVE, NOT ENFORCING. It has ZERO authorization call
 * sites today and must never be mistaken for one. Real access control is:
 *   • RLS via `public.current_vendor_ids()` — which ranks `secretary` NULL, so a
 *     Secretary member reads NOTHING until that helper is deliberately extended;
 *   • `ensureAdmin()` / `canManageVendor()` on the vendor-dashboard actions.
 * The matrix exists so § 7's intent is written down in code for the track that
 * builds the Secretary's data scoping. Treating it as a boundary is a bug.
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

/**
 * The scope(s) added by the 2026-07-25 locked model that this track ships.
 * `financial` is deliberately absent — see the DESCOPED note in the file header.
 */
export const VENDOR_TEAM_ROLES_V2 = ['secretary'] as const;
export type VendorTeamRoleV2 = (typeof VENDOR_TEAM_ROLES_V2)[number];

/** Existing four + the new scope. Superset of `VendorTeamRole`. */
export type VendorTeamRoleExtended = VendorTeamRole | VendorTeamRoleV2;

export const VENDOR_TEAM_ROLES_EXTENDED: ReadonlyArray<VendorTeamRoleExtended> = [
  ...VENDOR_TEAM_ROLES,
  ...VENDOR_TEAM_ROLES_V2,
];

export function isVendorTeamRoleV2(role: string | null | undefined): role is VendorTeamRoleV2 {
  return (VENDOR_TEAM_ROLES_V2 as readonly string[]).includes(role ?? '');
}

/** Strict membership test — the ONLY thing authorization logic may branch on. */
export function isVendorTeamRoleExtended(
  role: string | null | undefined,
): role is VendorTeamRoleExtended {
  return (VENDOR_TEAM_ROLES_EXTENDED as readonly string[]).includes(role ?? '');
}

/**
 * DISPLAY-ONLY normalization: map an arbitrary string to a role we have a label
 * for; unknown → 'viewer'.
 *
 * ⛔ NEVER use this for authorization. It converts "not a member of this team"
 * into "viewer", which is a real grant. `vendorRoleCan` deliberately does NOT go
 * through it — see the fail-closed lookup below.
 */
export function asVendorTeamRoleExtended(
  raw: string | null | undefined,
): VendorTeamRoleExtended {
  return isVendorTeamRoleExtended(raw) ? raw : 'viewer';
}

// ── Labels + blurbs ─────────────────────────────────────────────────────────
// The four existing entries repeat `lib/vendor-team.ts` VERBATIM so swapping a
// consumer over to the extended map is a no-op for today's roles.

export const VENDOR_TEAM_ROLE_LABEL_EXT: Record<VendorTeamRoleExtended, string> = {
  owner: 'Admin', // legacy rows surface as Admin
  admin: 'Admin',
  agent: 'Agent',
  viewer: 'Viewer',
  secretary: 'Secretary',
};

export const VENDOR_TEAM_ROLE_BLURB_EXT: Record<VendorTeamRoleExtended, string> = {
  owner: 'Top role — manages the whole store, including team and roles.',
  admin: 'Top role — manages the whole store, including team and roles.',
  agent: 'Assigned to specific services; sees only their own work.',
  viewer: 'Read-only access to the schedule and bookings.',
  secretary:
    'Scheduling and messages across the whole team. No billing or settings.',
};

// ── Capability matrix (DESCRIPTIVE — see the file header) ───────────────────

/**
 * The capability axes § 7 distinguishes. Deliberately small and behavioural —
 * each one answers a question a surface will eventually ask.
 */
export type VendorTeamCapability =
  /** Store settings, plan/tier, team management. Owner/Admin only. */
  | 'store_settings'
  /** Billing, payments, invoices. Owner/Admin only while Financial is descoped. */
  | 'billing'
  /** Financial reports + payouts. Owner/Admin only while Financial is descoped. */
  | 'reports'
  /** Read/send CLIENT chat + messages. */
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

export const VENDOR_TEAM_CAPABILITIES: ReadonlyArray<VendorTeamCapability> = [
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
  // Secretary/Coordinator — "scheduling + comms across the team". Sees every
  // client + the unified calendar, may reschedule and assign work. Explicitly
  // NOT billing and NOT store settings — a NEGATIVE boundary the existing
  // single-scalar rank CAN express (anything below admin), which is why this
  // role ships and Financial does not.
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

/**
 * THE predicate. FAIL-CLOSED: a role string this module does not recognise —
 * `null`, `undefined`, `''`, `'customer'`, `'financial'`, a typo, or a role from
 * some future migration — holds NO capability at all.
 *
 * This deliberately does NOT normalize through `asVendorTeamRoleExtended`: that
 * helper maps unknown → 'viewer', and 'viewer' carries `view_schedule: true`.
 * Feeding a nullable membership lookup into it would have granted a NON-MEMBER
 * the schedule. (Adversarial review 2026-07-26, defect 2.)
 *
 * `tier` is optional and, when supplied, applies the read-time lapse pattern
 * this repo already uses for entitlements: the Pro+ scopes evaporate the moment
 * the store is no longer Pro+, so a Pro store that downgrades to Solo cannot
 * keep a Pro-only role working. Omit `tier` only where the tier is genuinely
 * irrelevant (labels, tests of the raw matrix).
 */
export function vendorRoleCan(
  role: string | null | undefined,
  capability: VendorTeamCapability,
  tier?: string | null,
): boolean {
  if (!isVendorTeamRoleExtended(role)) return false;
  if (tier !== undefined && isVendorTeamRoleV2(role) && !areExtendedRolesAvailable(tier)) {
    return false;
  }
  return VENDOR_TEAM_ROLE_CAPS[role][capability];
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

/**
 * Set form of {@link parsableRolesForTier} — what `team/actions.ts` actually
 * gates its `parseRole` on. Extracted here (out of the server-action module,
 * which cannot be unit-tested) so the flag-OFF guarantee is pinned by a test
 * that fails when the guarantee is broken. (Adversarial review 2026-07-26,
 * defect 5.)
 */
export function parsableRoleSet(args: {
  tier: string | null | undefined;
  enabled: boolean;
}): ReadonlySet<string> {
  return new Set<string>(parsableRolesForTier(args));
}

/**
 * The role options for ONE member row: the picker's roles, plus the role that
 * member currently holds if the picker doesn't offer it.
 *
 * Without this, a member holding a role the picker no longer offers (the flag
 * was turned back off, or the store dropped below Pro) would render a `<select>`
 * that silently falls back to its first option — Admin — so a plain label edit
 * would PROMOTE them. Lives here, not in the page, so it is testable.
 */
export function rolesForRow(
  offered: ReadonlyArray<VendorTeamRoleExtended>,
  current: VendorTeamRoleExtended,
): ReadonlyArray<VendorTeamRoleExtended> {
  return offered.includes(current) ? offered : [...offered, current];
}
