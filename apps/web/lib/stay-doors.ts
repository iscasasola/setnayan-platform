/**
 * lib/stay-doors.ts — 📍 THE ONLY ACTIONS A `StayForm` MAY SAVE IN PLACE THROUGH (owner, 2026-10-26, DECISION_LOG
 * "A SAVE NEVER RESETS THE SCREEN — APP-WIDE").
 *
 * A door is a NAME, never a function: the browser sends `<area>.<action>` and the server door
 * (`app/_actions/save-in-place.ts`) looks it up in its own registry — typed `Record<StayDoor, …>`, so a name here with
 * no action there (or the reverse) does not compile, and a name the browser invents is refused. Each registered action
 * re-runs its own sign-in, membership and gate checks exactly as its plain `<form action>` does.
 *
 * Pure (a client imports the TYPE from here, never the registry). Held by `lib/a-save-never-resets-the-screen.test.ts`.
 */
export const STAY_DOORS = [
  /* Papic — `studio/papic/actions.ts`, `guest-window-actions.ts`, `face-tagging-actions.ts` (#6970). */
  'papic.setGuestAllotments',
  'papic.setGuestAllotment',
  'papic.releaseTheRest',
  'papic.setPapicWindow',
  'papic.setPapicUploadsOpen',
  'papic.setPapicGuestCaptureEarly',
  'papic.setCoupleFaceTaggingDeclined',
  'papic.setCapturePreserved',
  'papic.setClipShowcaseApproval',
  'papic.setGuestClipShowcaseApproval',
  'papic.reviewVendorChallengeAction',
  'papic.setChallengesPausedAction',
  'papic.setCoupleChallengeActiveAction',
  'papic.createCoupleChallengeAction',
  'papic.addLibraryChallengeAction',
  'papic.armChallengeAction',
  'papic.stopChallengeAction',
  'papic.deleteCoupleChallengeAction',
  'papic.clearMomentChallengeAction',
  /* Memories + Papic › Moderation — the photo's own sheet (`_components/memories/event-memories-gallery.tsx`). */
  'memories.setCaptureHidden',
  'memories.setSeatPhotoHidden',
  'memories.approveScreenedCapture',
  'memories.reportCapture',
  'memories.blockUploader',
  'memories.unblockUploader',
  'memories.deletePhotoForever',
  'memories.setVendorCapturesHidden',
  /* Schedule — the host's segments (`schedule/_components/emcee-picks.tsx`). */
  'schedule.toggleActivityPick',
  'schedule.applyActivityPicks',
  /* Sponsors — every row and sheet on `/sponsors`. */
  'sponsors.addSponsor',
  'sponsors.updateSponsor',
  'sponsors.removeSponsor',
  'sponsors.sendInvitation',
  'sponsors.markResponse',
  /* Guests — the list's Select › Set… and New group, the card's ⋯ and sign-in link, and Requests. */
  'guests.bulkApplyRoleAndGroup',
  'guests.createGuestGroup',
  'guests.releaseGuestClaim',
  'guests.inviteGuestByEmailAction',
  'guests.keepGuestAction',
  'guests.removeGuestAction',
  'guests.linkGuestAction',
  'guests.undoAcceptAction',
  'guests.undoDeclineAction',
  /* People with access — invite (a supplier's workspace › Promote), remove (Event Details), revoke. */
  'hosts.inviteHost',
  'hosts.removeHost',
  'hosts.revokeHostInvite',
  /* A supplier's review page (and the workspace's Confirm received / Report a problem). */
  'review.coupleConfirmReceived',
  'review.coupleReportNonDelivery',
  'review.recommendVendor',
  'review.withdrawRecommendation',
  'review.submitReviewAppeal',
  /* Schedule — the host's questions, Tell the host, a supplier's suggestion. */
  'schedule.saveHostAnswers',
  'schedule.sendStageNoteFromEvent',
  'schedule.resolveScheduleSuggestion',
  /* The invitation page — Mark sent, Re-issue QR, the monogram. */
  'invitation.markGuestInvitationSent',
  'invitation.reissueGuestToken',
  'invitation.updateMonogram',
  /* A guest's own event page — face blur, scan trail, remove my face data, this seat is mine, save a supplier. */
  'guest.setGuestFaceBlock',
  'guest.setGuestScanTracking',
  'guest.withdrawFaceConsent',
  'guest.linkThisSeatAction',
  'guest.saveAttendedVendorAction',
] as const;

export type StayDoor = (typeof STAY_DOORS)[number];

export function isStayDoor(v: unknown): v is StayDoor {
  return typeof v === 'string' && (STAY_DOORS as readonly string[]).includes(v);
}
