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
 *     plan paywall ON, a Supplier Plus shop has its 1 seat AND a Helper, and an Enterprise
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

/**
 * 🧑‍🤝‍🧑 SIX ROLES (owner 19 Nov 2026): the free seat is the HELPER ROLE (`duty = 'helper'`). Marketing and Event Crew
 * share the Helper's read-only RANK (`viewer`) but are paid seats — so when a row carries its role, the role decides;
 * a row without one (an older read) falls back to the rank, exactly as before.
 */
export const FREE_HELPER_DUTY = 'helper';

export type SeatMember = {
  user_id: string;
  role: VendorTeamRole | string;
  duty?: string | null;
  vendor_team_member_id?: string;
};

/** Does this seat ride on the free Helper allowance? */
export function isFreeHelperSeat(m: { role: VendorTeamRole | string; duty?: string | null }): boolean {
  return m.duty ? m.duty === FREE_HELPER_DUTY : m.role === FREE_HELPER_ROLE;
}

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
  const helpers = others.filter(isFreeHelperSeat).length;
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
  change:
    | { kind: 'invite'; role: VendorTeamRole | string; duty?: string | null }
    | { kind: 'role'; memberId: string; role: VendorTeamRole | string; duty?: string | null };
}): boolean {
  const { members, founderUserId, cap, change } = args;
  if (!Number.isFinite(cap)) return true;
  const before = teamSeats(members, founderUserId).counted;
  const after =
    change.kind === 'invite'
      ? teamSeats([...members, { user_id: '\u0000new', role: change.role, duty: change.duty ?? null }], founderUserId).counted
      : teamSeats(
          members.map((m) =>
            m.vendor_team_member_id === change.memberId ? { ...m, role: change.role, duty: change.duty ?? null } : m,
          ),
          founderUserId,
        ).counted;
  return after <= cap || after <= before;
}

/** The seats line when what the shop holds on top of its plan could not be read — said, never the smaller number. */
export const SEATS_UNREAD = 'Couldn’t load your seats just now — nothing is lost';

/**
 * The Helpers screen's one line — the SEATS and the FREE HELPER said as two separate facts, so neither can read as
 * contradicting the other (supplier batch walk R5: "0 of 1 used · your free Helper is in use" read as "nothing used,
 * yet something is in use" — the Helper is outside the seat count, and the line never said so).
 *   "1 of 3 seats used · plus your free Helper"            a Helper is on the team
 *   "0 of 1 seats used · plus 1 free Helper you can invite" none yet
 *   "No team seats on your plan · plus 1 free Helper …"    a plan with no seats
 *   "2 with you · no seat limit · plus your free Helper"   unlimited
 *   `SEATS_UNREAD`                                          the cap is `null` — it could not be measured
 */
export function seatLine(seats: TeamSeats, cap: number | null): string {
  // 🔑 The cap could not be MEASURED (the seats or Ultra Add-ons the shop holds were unread): say so. Drawing the
  // plan's bare number would read "16 of 16 seats used" to a shop that pays for three more.
  if (cap === null) return SEATS_UNREAD;
  const free =
    FREE_HELPER_SEATS > 0
      ? seats.freeHelpers > 0
        ? ' · plus your free Helper'
        : ` · plus ${formatCount(FREE_HELPER_SEATS)} free Helper you can invite`
      : '';
  if (!Number.isFinite(cap)) return `${formatCount(seats.counted)} with you · no seat limit${free}`;
  if (cap <= 0 && seats.counted === 0) return `No team seats on your plan${free}`;
  // More people than the plan holds (a plan that went down): "3 of 1 seats used" read like arithmetic gone wrong.
  if (seats.counted > cap) {
    const holds = cap <= 0 ? 'no team seats' : `${formatCount(cap)} ${cap === 1 ? 'seat' : 'seats'}`;
    return `${formatCount(seats.counted)} with you · your plan holds ${holds}${free}`;
  }
  return `${formatCount(seats.counted)} of ${formatCount(cap)} ${cap === 1 ? 'seat' : 'seats'} used${free}`;
}
