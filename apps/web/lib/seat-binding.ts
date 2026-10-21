/**
 * seat-binding.ts — WHEN MAY A SEAT ON A GUEST LIST BECOME SOMEBODY'S ACCOUNT?
 *
 * Pure (no I/O) so the rules carry an executed unit suite
 * (`seat-links-only-on-purpose.test.ts`).
 *
 * ── THE INCIDENT (owner's own wedding, 2026-09-30) ──────────────────────────
 * A test account found the owner's wedding on its Home board as an invited
 * guest — bound to the GROOM's row. Owner: *"he is not the groom."* How:
 *
 *   1. the groom row's personal key (`?invite=`) was opened on a device, which
 *      set the 60-day guest cookie naming that row;
 *   2. account sign-out cleared only the `sb-*` cookies, so the guest cookie
 *      outlived the account on that device;
 *   3. a plain LOGIN on that device ran `linkGuestSessionToUser`, which bound
 *      whatever seat the cookie named — no "is this you?", no role check — and
 *      the groom row is always free, because the creator's own couple
 *      membership carries no `guest_id`;
 *   4. the seat's name was copied onto the account, and the
 *      `link_guest_to_account_person` trigger re-pointed the groom row's
 *      `person_id` at the wrong person — so `is_event_celebrant` counted them,
 *      and the Access control on the groom row stopped recognising the creator.
 *
 * ── THE RULES (each one is guarded) ──────────────────────────────────────────
 *   · A seat is bound ONLY by an act on that seat's own page — "Save to my
 *     account" there, or the `/join/{id}/connect` return a Save started — and
 *     the person is first shown WHOSE invitation it is and WHICH account it
 *     goes to (`seatConfirmLine`). Signing in or signing up binds nothing.
 *   · Account sign-out clears the guest pass too (`app/auth/sign-out`).
 *   · A COUPLE seat (the people the celebration is for — bride, groom,
 *     celebrant) is never bound by a guest link. It is bound only to an
 *     account that is already one of the event's `couple` members, or through
 *     the sign-in link the COUPLE sent from that row's own guest card
 *     (`coupleSentTheLink`) — the one door the couple chose. Otherwise refused
 *     with `COUPLE_SEAT_REFUSED`.
 *   · A couple seat is never OFFERED either — not as a "Same as …" match for a
 *     request, not in the Link picker (`isCoupleSeat` filters both).
 *   · 🔒 AN ACCOUNT THAT MANAGES THE EVENT IS NEVER BOUND TO A GUEST'S SEAT
 *     (owner, 2026-10-21 — his own wedding again). Signed in as himself, the
 *     HOST, on Pam's personal link, he was asked *"This invitation is for Pam.
 *     Save it to <his own email>?"* with a "Yes, save to my account" under it.
 *     A host, co-host, coordinator or helper (`accountManagesEvent` — the same
 *     "host" the page's pass rule and owner layer use: a `couple` /
 *     `coordinator` membership, or an accepted, not-removed delegate) holds a
 *     guest's link to LOOK at it, never to keep it. Refused with `'manager'` —
 *     unless the seat is already the account's OWN (`seatIsAccountsOwn`: its
 *     membership or its delegate row names this very seat). The page offers no
 *     press either: it says `hostViewingLine` in the button's place.
 */

/**
 * The seats that ARE the celebration's own people. Same list as
 * `lib/role-groups.ts` `HONOREE_ORDER` and the database's `is_event_celebrant`
 * (`g.role IN ('celebrant', 'bride', 'groom')`) — kept literal here so this
 * module stays import-free and executable.
 */
export const COUPLE_SEAT_ROLES: readonly string[] = ['bride', 'groom', 'celebrant'];

/** Is this guest row one of the celebration's own people (primary or extra role)? */
export function isCoupleSeat(
  role: string | null | undefined,
  extraRoles: readonly (string | null | undefined)[] | null | undefined = null,
): boolean {
  if (role && COUPLE_SEAT_ROLES.includes(role)) return true;
  return (extraRoles ?? []).some((r) => typeof r === 'string' && COUPLE_SEAT_ROLES.includes(r));
}

export type SeatBindRefusal = 'couple_seat' | 'manager' | null;

/**
 * May THIS account be bound to THIS seat? `null` = yes. Two refusals live here —
 * an account that manages the event (`'manager'`, checked FIRST: it is about who
 * is pressing, whatever the seat) and a couple seat (`'couple_seat'`); every
 * other rule (already held by someone else, deleted, wrong event) is enforced
 * where the row is read.
 */
export function seatBindRefusal(input: {
  seatRole: string | null | undefined;
  seatExtraRoles?: readonly (string | null | undefined)[] | null;
  /** The account already holds a `couple` membership on this event. */
  accountIsCouple: boolean;
  /** The couple sent this account the link from this row's own guest card. */
  coupleSentTheLink?: boolean;
  /**
   * The account MANAGES this event — a `couple` / `coordinator` membership, or an
   * accepted, not-removed `event_moderators` row (co-host · helper). Unknown must
   * be passed as TRUE by the caller (fail closed: a refused bind can be retried,
   * a wrong one is the incident).
   */
  accountManagesEvent?: boolean;
  /** This seat is already the account's own (its membership or delegate row names it). */
  seatIsAccountsOwn?: boolean;
}): SeatBindRefusal {
  if (input.accountManagesEvent === true && input.seatIsAccountsOwn !== true) return 'manager';
  if (!isCoupleSeat(input.seatRole, input.seatExtraRoles)) return null;
  if (input.accountIsCouple || input.coupleSentTheLink === true) return null;
  return 'couple_seat';
}

/** Said to the person who tried — plain words, no role jargon. */
export const COUPLE_SEAT_REFUSED =
  'This invitation belongs to one of the people this event is for, so it can only be kept in their own account. If you were sent it by mistake, ask the couple for your own invitation.';

/**
 * 👀 SAID TO A HOST VIEWING A GUEST'S INVITATION, in the place the "Save to my
 * account" press would stand (owner 2026-10-21: *"You're viewing Pam's
 * invitation as the host"*). Quiet text, nothing to press — the invitation stays
 * the guest's to keep. Also the confirm page's refusal for `'manager'`.
 */
export function hostViewingLine(seatName: string | null | undefined): string {
  const name = (seatName ?? '').trim();
  const whose = name ? `${name}’s` : 'this guest’s';
  return `You’re viewing ${whose} invitation as the host. Only they can save it to their account.`;
}

/**
 * ONE INVITATION, ONE ACCOUNT (owner 2026-10-01, verbatim): *"save to my account.
 * adds it to a user. if someone tries to sync it to a different email. they
 * cannot. we will say this event QR is already assigned to someone."*
 *
 * Said — exactly this, nothing more — wherever a SECOND account is refused a
 * seat another account already holds: the invitation's account card and Save
 * (`held_elsewhere`), and the screen a Google / Apple return lands on
 * (`/join/{id}/connect/confirm`). The first account keeps it; only the hosts'
 * Unlink (lib/seat-unlink.ts) releases it. The refusal itself is the database's
 * partial unique `event_members(event_id, guest_id)` —
 * tests/db/one-invitation-one-account.db.test.ts.
 */
export const SEAT_HELD_ELSEWHERE = {
  heading: 'This event QR is already assigned to someone.',
  line: 'If this is your invitation, ask the hosts to check it.',
} as const;

/** The name a seat is shown under: the couple's display name, else first + last. */
export function seatDisplayName(seat: {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const own = (seat.display_name ?? '').trim();
  if (own) return own;
  return [seat.first_name, seat.last_name]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v && v !== '—' && v.toLowerCase() !== 'tba')
    .join(' ');
}

/**
 * THE QUESTION ASKED BEFORE EVERY BINDING: *"This invitation is for <name>.
 * Save it to <account email>?"* Both halves, always — the name is what tells a
 * second person on a shared phone that this is not theirs, and the address is
 * what tells them which account it would land in.
 */
export function seatConfirmLine(input: { seatName: string | null; accountEmail: string | null }): {
  whose: string;
  where: string;
} {
  const name = (input.seatName ?? '').trim();
  const email = (input.accountEmail ?? '').trim();
  return {
    whose: name ? `This invitation is for ${name}.` : 'This invitation has no name on it yet.',
    where: email ? `Save it to ${email}?` : 'Save it to the account you are signed in to?',
  };
}
