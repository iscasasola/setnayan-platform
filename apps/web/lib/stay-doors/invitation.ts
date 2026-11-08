/** Invitation — the QR monogram colour (`invitation/actions.ts` › `updateMonogram`). */
export const INVITATION_STAY_DOORS = ['invitation.updateMonogram'] as const;
export type InvitationStayDoor = (typeof INVITATION_STAY_DOORS)[number];
