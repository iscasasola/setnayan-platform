/**
 * lib/vendor-free-helper.ts — ONE free Helper for every supplier, on every plan.
 *
 * Owner, 2026-10-14 (DECISION_LOG 🧑‍🤝‍🧑 call 2): *"so should we alot 1 free
 * helper for all services (to be fair)"* — read as: every supplier, whatever its
 * type or plan, may add ONE Helper without it costing a team seat; more helpers
 * stay paid. Re-stated in the ✅ APPROVE row the same day ("1 free Helper for
 * every supplier").
 *
 * 💳 WHAT THIS CHANGES IN MONEY, AND WHAT IT DOES NOT.
 *   · NO PRICE MOVES. Plans, the extra-seat SKU (`vendor_extra_seat`) and every
 *     catalogue row are untouched; nothing here reads or writes a peso.
 *   · THE SEAT COUNT MOVES. A team's seats used against its plan
 *     (`tierCaps(tier).agentAccounts` + paid extra seats — `vendor-seats.ts`) used
 *     to be "every member beyond the founding admin". It is now that, MINUS up to
 *     `FREE_HELPER_SEATS` members whose role is the Helper role (`viewer` — "sees
 *     the schedule", read-only). So a Free shop can add one Helper even with the
 *     plan paywall ON, a Solo shop has its 1 seat AND a Helper, and an Enterprise
 *     shop reaches its 10 paid seats one Helper later — i.e. it buys an extra seat
 *     one person later than before.
 *   · ONLY THE HELPER ROLE. A free seat that could be an Admin or a Team member
 *     would be a free paid seat. Moving the free Helper to another role is
 *     refused when the plan has no room for it (`canSeat` below, called by the
 *     role-change action), exactly as inviting a fourth person is.
 *
 * ⚠ ONE CONSTANT. `FREE_HELPER_SEATS = 0` puts every reader back to the old
 * count — invite, role change, the Helpers screen and the Shop tile all read the
 * team through `teamSeats()`, so none of them keeps a second copy of the rule.
 * Held by `lib/vendor-free-helper.test.ts` and `app/vendor-dashboard/team/one-free-helper.test.ts`.
 *
 * PURE: no I/O. The caller reads the team (the same one row-per-member read it
 * already made) and the cap (`vendorAllowance` + `effectiveSeatCap`).
 */
import type { VendorTeamRole } from './vendor-team';
import { formatCount } from './format-number';

/** How many Helpers ride free on every plan. The owner's "1 free helper". */
export const FREE_HELPER_SEATS = 1;

/** The role that rides free — "Helper · sees the schedule" (read-only). */
export const FREE_HELPER_ROLE: VendorTeamRole = 'viewer';

export type SeatMember = {
  user_id: string;
  role: VendorTeamRole | string;
  vendor_team_member_id?: string;
};

export type TeamSeats = {
  /** Members beyond the founding admin — everybody on the team who is not the founder. */
  people: number;
  /** Of those, how many ride on the free Helper allowance (0 … FREE_HELPER_SEATS). */
  freeHelpers: number;
  /** What counts against the plan's seats: `people − freeHelpers`. */
  counted: number;
};

/** Where a team stands against its plan. The founding admin is always free and never counted. */
export function teamSeats(members: readonly SeatMember[], founderUserId: string | null): TeamSeats {
  const others = members.filter((m) => m.user_id !== founderUserId);
  const helpers = others.filter((m) => m.role === FREE_HELPER_ROLE).length;
  const freeHelpers = Math.min(helpers, Math.max(0, Math.floor(FREE_HELPER_SEATS)));
  return { people: others.length, freeHelpers, counted: others.length - freeHelpers };
}

/**
 * May this change happen on this plan? `change` is either a NEW member with a
 * role (an invite) or an EXISTING member moving to a role (a role change).
 *
 * Allowed when the team after the change fits the cap — or when the change does
 * not make the count worse (a shop already over its seats after a downgrade may
 * still shuffle its roles; it just cannot grow). `cap` is the effective seat cap
 * (`effectiveSeatCap(vendorAllowance(...), extraSeats)`); Infinity = unlimited.
 */
export function canSeat(args: {
  members: readonly SeatMember[];
  founderUserId: string | null;
  cap: number;
  change: { kind: 'invite'; role: VendorTeamRole | string } | { kind: 'role'; memberId: string; role: VendorTeamRole | string };
}): boolean {
  const { members, founderUserId, cap, change } = args;
  if (!Number.isFinite(cap)) return true;
  const before = teamSeats(members, founderUserId).counted;
  const after =
    change.kind === 'invite'
      ? teamSeats([...members, { user_id: '\u0000new', role: change.role }], founderUserId).counted
      : teamSeats(
          members.map((m) => (m.vendor_team_member_id === change.memberId ? { ...m, role: change.role } : m)),
          founderUserId,
        ).counted;
  return after <= cap || after <= before;
}

/** "1 of 3 used · 1 free Helper" — the Helpers screen's one line. Infinity reads as "no limit". */
export function seatLine(seats: TeamSeats, cap: number): string {
  const free =
    FREE_HELPER_SEATS > 0
      ? ` · ${seats.freeHelpers > 0 ? 'your free Helper is in use' : `${formatCount(FREE_HELPER_SEATS)} Helper free on every plan`}`
      : '';
  if (!Number.isFinite(cap)) return `${formatCount(seats.people)} with you · no limit${free}`;
  return `${formatCount(seats.counted)} of ${formatCount(cap)} used${free}`;
}
