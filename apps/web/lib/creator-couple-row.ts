/**
 * creator-couple-row.ts — THE EVENT'S CREATOR IS THEIR OWN COUPLE ROW.
 *
 * Owner 2026-10-04 (measured read-only on his own wedding): the account that
 * created the event held an `event_members` row with no `guest_id`, so his
 * Groom row read "Not linked", and a host's card offers no Invite — there was
 * no way in the app to say "that row is me". Three doors close it:
 *
 *   · AT CREATION — the wedding onboarding asks who you are (screen 2:
 *     bride · groom · helper). Bride or groom → the membership holds the row
 *     that was just seeded for that name (`creatorCoupleRowId`, used by
 *     app/onboarding/wedding/actions.ts). A helper, or no answer, holds none.
 *   · EXISTING EVENTS — the migration `*_the_creator_is_their_couple_row.sql`
 *     links a creator only when exactly one row is unambiguously them.
 *   · "THIS IS ME" — on the card of the CREATOR's own unlinked bride / groom
 *     row (`offersThisIsMe`), one action that calls `claim_my_couple_row`,
 *     which re-checks everything at the database. An invited co-host is never
 *     offered it: a co-host must not be able to take the bride's or groom's row.
 *
 * Pure (no I/O) so the rules are executed by `creator-couple-row.test.ts`.
 */

export type CreatorRoleAnswer = 'bride' | 'groom' | 'helper' | null | undefined;

/** The row the creator said they are, or null (a helper, no answer, or no row seeded). */
export function creatorCoupleRowId(
  role: CreatorRoleAnswer,
  seeded: { bride: string | null; groom: string | null },
): string | null {
  if (role === 'bride') return seeded.bride;
  if (role === 'groom') return seeded.groom;
  return null;
}

/**
 * Does this card offer "This is me"? Only to the event's CREATOR (a couple
 * member who made the event) who holds no row yet, on a live bride / groom row
 * that nobody holds and whose person is not another account's.
 */
export function offersThisIsMe(input: {
  viewerIsCreator: boolean;
  viewerHoldsARow: boolean;
  rowIsCouple: boolean;
  rowIsLinked: boolean;
  rowPassedAway: boolean;
  rowOwnedByAnotherAccount: boolean;
}): boolean {
  return (
    input.viewerIsCreator &&
    !input.viewerHoldsARow &&
    input.rowIsCouple &&
    !input.rowIsLinked &&
    !input.rowPassedAway &&
    !input.rowOwnedByAnotherAccount
  );
}

/** What `claim_my_couple_row` answered, in the card's words (null = linked). */
export const THIS_IS_ME_REFUSAL_COPY: Readonly<Record<string, string>> = {
  this_is_me_not_signed_in: 'Please sign in again, then tap "This is me".',
  this_is_me_not_the_creator: 'Only the person who created this event can say which row is theirs.',
  this_is_me_you_hold_another_row: 'Your account already holds another row on this guest list.',
  this_is_me_not_a_couple_row: 'Only the bride or groom row can be yours this way.',
  this_is_me_already_linked: 'Another account already holds this row.',
  this_is_me_someone_else: 'This row belongs to another account.',
  this_is_me_failed: 'This could not be saved just now — nothing was changed. Please try again.',
};
