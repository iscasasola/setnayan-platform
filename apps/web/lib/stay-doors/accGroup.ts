/** Account › a Group (samahan) — its page `/dashboard/samahan/<id>`: the chat, the name and photo, the invite link,
 *  an organizer's Remove (`samahan/actions.ts`). */
export const ACC_GROUP_STAY_DOORS = [
  'accGroup.postSamahanMessage',
  'accGroup.deleteSamahanMessage',
  'accGroup.updateCommunityIdentity',
  'accGroup.rotateInviteToken',
  'accGroup.removeMember',
] as const;
export type AccGroupStayDoor = (typeof ACC_GROUP_STAY_DOORS)[number];

/** The group page's own sentence for each `?error=` code (moved here from `samahan/[communityId]/page.tsx`, which
 *  still shows them — one list, so the banner and the in-place refusal never say two different things). */
export const GROUP_ERROR_WORDS: Readonly<Record<string, string>> = {
  last_organizer:
    'You are the last organizer. Promote someone first, or archive the group.',
  member_gone: 'That member is no longer on the roster.',
};
