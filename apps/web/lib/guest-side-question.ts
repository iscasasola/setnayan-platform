/**
 * guest-side-question.ts — "does THIS event have sides?", as a pure decision.
 *
 * `guests.side` is a wedding idea: Bride's side / Groom's side / Both. On a
 * birthday, a funeral, a corporate event or a Simple Event the question is
 * nonsense, and the add-guest form asked it anyway — required, with a server
 * action that refused with "Pick a side first." That was the only reason the
 * full form was unusable on a non-wedding event (the bulk-paste form at
 * /guests/quick has always worked, because it hard-codes side:'both').
 *
 * THE ANSWER COMES FROM THE PROFILE, NOT FROM A LIST OF TYPE NAMES. The
 * event-type profile already resolves a RoleSet per event
 * (`resolveRoleSetForEvent`), and a RoleSet already names the principals a
 * "side" belongs to: `coupleRoles` is {bride, groom} for WEDDING_ROLE_SET and
 * MUSLIM_ROLE_SET and EMPTY for GENERIC_ROLE_SET / SIMPLE_ROLE_SET. So "has
 * sides" is exactly "the role set has side principals" — a new event type
 * inherits the right answer from its profile row instead of re-opening this.
 * Measured in prod 2026-09-17: of 17 seeded `event_type_profiles` rows only
 * `wedding` carries role_set_key='wedding'; `wake` carries NULL (→ generic).
 *
 * ⚠ SCHEMA IS UNCHANGED. `guests.side` and `guests.group_category` are both
 * NOT NULL with no default, so a sideless event still WRITES a side — the same
 * safe value quick-add writes. Nothing here implies a migration.
 *
 * Pure on purpose: the server action and the page are `server-only`, so a
 * guard could otherwise only grep them. Everything that can be got wrong lives
 * here and is EXECUTED by guest-side-question.test.ts.
 */
import type { RoleSet } from './role-sets';
import type { GuestGroupCategory, GuestSide } from './guests';

/** The `guest_side` enum, in picker order. */
export const SIDE_VALUES: readonly GuestSide[] = ['bride', 'groom', 'both'];

/**
 * The roles a "side" is a side OF. A role set that names none of these has no
 * sides to pick between.
 */
export const SIDE_PRINCIPAL_ROLES: readonly string[] = ['bride', 'groom'];

/**
 * What a sideless event stores. Identical to what
 * app/dashboard/[eventId]/guests/quick/actions.ts has written since it
 * shipped — one value, not a second convention.
 */
export const SIDELESS_SIDE: GuestSide = 'both';
export const SIDELESS_GROUP_CATEGORY: GuestGroupCategory = 'other';

/** Does this event type have sides worth asking about? */
export function eventHasSides(roleSet: Pick<RoleSet, 'coupleRoles'>): boolean {
  return SIDE_PRINCIPAL_ROLES.some((r) => roleSet.coupleRoles.has(r));
}

export type SideResolution =
  | { ok: true; side: GuestSide }
  | { ok: false; error: 'missing_side' };

/**
 * Resolve the side to store from what the form submitted.
 *
 * - Event HAS sides (a wedding): unchanged — a valid `guest_side` or the
 *   `missing_side` refusal the action has always issued.
 * - Event has NO sides: the form never asked, so accept the absence and store
 *   {@link SIDELESS_SIDE}. A valid value that arrives anyway is still honoured
 *   (an event whose type changed later must not lose an already-chosen side).
 */
export function resolveSubmittedSide(
  roleSet: Pick<RoleSet, 'coupleRoles'>,
  submitted: string | null | undefined,
): SideResolution {
  const valid = SIDE_VALUES.find((v) => v === submitted);
  if (valid) return { ok: true, side: valid };
  if (eventHasSides(roleSet)) return { ok: false, error: 'missing_side' };
  return { ok: true, side: SIDELESS_SIDE };
}
