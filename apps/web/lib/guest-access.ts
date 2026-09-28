/**
 * guest-access.ts — WHAT A GUEST'S "ACCESS" LINE SAYS, as a pure function.
 *
 * Owner 2026-09-28 (DECISION_LOG "CO-HOSTS COME FROM THE GUEST LIST — FINAL
 * MODEL"): any co-host picks a guest's Access — None · Co-host · Limited
 * helper. It is automatic; it goes live once that guest has JOINED (said YES
 * and linked their account). A co-host has equal access to the creator; a
 * limited helper may view and track progress but not edit. A CELEBRANT who is
 * a co-host cannot be removed, and the creator never can.
 *
 * The truth lives in the database (event_moderators.guest_id + the triggers in
 * migration 20271251336140). This module only reads the seat and says it —
 * no I/O, so the rule that decides every label on the card is executable.
 *
 * ⚠ A WAITING SEAT IS `user_id === null`, NEVER `accepted_at === null`:
 * event_moderators.accepted_at is DEFAULT now(), so it is stamped on a seat
 * nobody has joined yet (measured on prod, 2026-09-28).
 */

export type GuestAccessLevel = 'none' | 'co_host' | 'limited_helper';

/** event_moderators.role_subtype written for each level. */
export const ACCESS_SEAT_KIND: Readonly<Record<Exclude<GuestAccessLevel, 'none'>, string>> = {
  co_host: 'co_host',
  limited_helper: 'viewer',
};

/** Mirrors public.seat_is_full_cohost (20271251336140). Keep the two in step. */
const FULL_COHOST_KINDS: ReadonlySet<string> = new Set([
  'co_host',
  'host',
  'bride',
  'groom',
  'partner1',
  'partner2',
  'celebrant',
]);

/** Mirrors lib/role-groups HONOREE_ORDER and the SQL's celebrant list. */
const CELEBRANT_ROLES: ReadonlySet<string> = new Set(['celebrant', 'bride', 'groom']);

export type SeatRow = {
  role_subtype: string;
  user_id: string | null;
  removed_at: string | null;
};

export type GuestAccessState = {
  level: GuestAccessLevel;
  /** Live = they have joined and the access is theirs now. */
  live: boolean;
  /** Why the level cannot be changed here, or null. */
  lock: 'creator' | 'celebrant' | null;
};

export function accessLevelOfSeat(seat: SeatRow | null): GuestAccessLevel {
  if (!seat || seat.removed_at) return 'none';
  if (FULL_COHOST_KINDS.has(seat.role_subtype)) return 'co_host';
  return 'limited_helper';
}

export function guestAccessState(input: {
  seat: SeatRow | null;
  guestRole: string;
  /** This guest row is the event's creator (their own row). */
  isCreator: boolean;
}): GuestAccessState {
  if (input.isCreator) return { level: 'co_host', live: true, lock: 'creator' };
  const level = accessLevelOfSeat(input.seat);
  const live = level !== 'none' && input.seat?.user_id != null;
  const lock =
    level === 'co_host' && CELEBRANT_ROLES.has(input.guestRole) ? 'celebrant' : null;
  return { level, live, lock };
}

/** The tag on the guest list, or null. The word is "Co-host", never "Host". */
export function accessTag(state: GuestAccessState): string | null {
  if (state.level === 'none') return null;
  const word = state.level === 'co_host' ? 'Co-host' : 'Limited helper';
  return state.live ? word : `${word} · waiting for them to join`;
}

/** The one line under the Access dropdown. */
export function accessNote(state: GuestAccessState, firstName: string): string {
  if (state.lock === 'creator') return 'Created this event — always a co-host.';
  if (state.lock === 'celebrant') {
    return `${firstName} is a celebrant, so ${firstName} stays a co-host. A celebrant can change ${firstName}'s role first.`;
  }
  if (state.level === 'none') {
    return 'Guests only. A co-host has the same access as you; a limited helper can view but not change anything.';
  }
  if (!state.live) {
    return `Starts as soon as ${firstName} says yes to the invitation and signs in.`;
  }
  return state.level === 'co_host'
    ? `${firstName} has the same access to this event as you.`
    : `${firstName} can view the event and follow its progress, but can't change anything.`;
}
