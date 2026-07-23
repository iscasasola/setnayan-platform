/**
 * Authorization predicate for the Kwento (photo_messages) moderation actions.
 *
 * blockKwentoGuest inserts a guest_message_blocks row through the caller's own
 * (RLS-bound) session. The guest_message_blocks_manage policy's WITH CHECK used
 * to require only `event_id IN current_event_ids()` — which admits a plain guest
 * — so the INSERT (WITH CHECK, not USING) let ANY guest silence any other guest.
 * Migration 20270920030000 tightens that WITH CHECK to the couple/coordinator
 * member_type gate; this predicate is the app-level mirror of that gate
 * (defense-in-depth + a friendly error), matching how the couple-side
 * moderation actions in the same file resolve authority from
 * event_members.member_type.
 *
 * Day-of moderation belongs to the couple AND accepted coordinators (co-hosts),
 * mirroring the guest_message_blocks_manage USING clause and the Kwento
 * moderation comment ("couple/coordinator moderates via their OWN session").
 */

/** member_type values on event_members that may moderate Kwento. */
export const KWENTO_MODERATOR_MEMBER_TYPES = ['couple', 'coordinator'] as const;

/**
 * True iff the caller's event membership grants Kwento moderation authority.
 *
 * @param memberType the caller's event_members.member_type on THIS event, or
 *   null/undefined if they hold no membership row for it.
 */
export function isKwentoModerator(
  memberType: string | null | undefined,
): boolean {
  return (
    memberType === 'couple' ||
    memberType === 'coordinator'
  );
}
