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

/**
 * The owner's three words for a guest's Access (2026-09-28: "None · Co-host ·
 * Limited helper"), shared by the guest card's Access line and the guest
 * list's Access column so the two can never say different things.
 */
export const ACCESS_LEVEL_LABEL: Readonly<Record<GuestAccessLevel, string>> = {
  none: 'None',
  co_host: 'Co-host',
  limited_helper: 'Limited helper',
};

/**
 * THE CREATOR'S WORD — "Host", never "Co-host" (owner 2026-10-04: the account
 * that created the event read "Co-host" on its own row). A co-host is someone
 * the host CHOSE; the person who made the event is the host. Every surface that
 * prints a person's access asks `accessWordFor`, so the two words can never split.
 */
export const CREATOR_WORD = 'Host';

/** The word for one person's access: the creator is the Host; everyone else by level. */
export function accessWordFor(state: Pick<GuestAccessState, 'level' | 'lock'>): string {
  return state.lock === 'creator' ? CREATOR_WORD : ACCESS_LEVEL_LABEL[state.level];
}

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

/**
 * A full co-host seat (bride, groom, partner, co-host, celebrant…) is a
 * `couple` member in the database — equal to the creator — and every other
 * live seat is a `coordinator` member. The same split `seat_is_full_cohost`
 * draws in SQL.
 */
export function seatIsFullCohost(roleSubtype: string): boolean {
  return FULL_COHOST_KINDS.has(roleSubtype);
}

/**
 * The seats a couple may hand COLOUR domains to (MB16): live seats, never the
 * viewer's own, never a full co-host. `set_coordinator_colour_access` grants
 * only to a `coordinator` member, which `sync_delegate_membership` mints for a
 * limited helper / hired planner seat; a full co-host is a `couple` member who
 * already holds every colour (owner 2026-09-30: "Claire Buanhog is not a
 * coordinator" — she is the Bride). Pure, so the rule is executed by
 * `colour-access-lists-only-coordinators.test.ts`; the read that uses it is
 * `lib/colour-access.server.ts`.
 */
export function seatsThatTakeColourGrants<T extends { user_id: string | null; role_subtype: string }>(
  seats: readonly T[],
  viewerUserId: string,
): (T & { user_id: string })[] {
  return seats
    .filter((s): s is T & { user_id: string } => Boolean(s.user_id))
    .filter((s) => s.user_id !== viewerUserId)
    .filter((s) => !seatIsFullCohost(s.role_subtype));
}

export function accessLevelOfSeat(seat: SeatRow | null): GuestAccessLevel {
  if (!seat || seat.removed_at) return 'none';
  if (seatIsFullCohost(seat.role_subtype)) return 'co_host';
  return 'limited_helper';
}

/**
 * The Access word for a seat as the HOSTS part prints it: the guest list's
 * own vocabulary (Co-host · Limited helper), never `role_subtype`'s label —
 * "Viewer (read-only)" and "Bride" are the pre-2026-09-28 words for the same
 * seats. The hired planner is not a guest-list access at all and keeps its
 * own label, so this says null for it.
 */
export function seatAccessWord(roleSubtype: string): string | null {
  if (roleSubtype === 'wedding_planner_external') return null;
  return seatIsFullCohost(roleSubtype)
    ? ACCESS_LEVEL_LABEL.co_host
    : ACCESS_LEVEL_LABEL.limited_helper;
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

/** The tag on the guest list, or null. "Co-host" for a chosen co-host; the creator is the "Host". */
export function accessTag(state: GuestAccessState): string | null {
  if (state.level === 'none') return null;
  const word = accessWordFor(state);
  return state.live ? word : `${word} · waiting for them to join`;
}

/** The one line under the Access dropdown. */
export function accessNote(state: GuestAccessState, firstName: string): string {
  if (state.lock === 'creator') return 'Created this event — the host.';
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
