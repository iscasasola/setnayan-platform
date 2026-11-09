/**
 * Papic's stay doors (#6970, folded into the app-wide door with no change in behaviour) — `studio/papic/actions.ts`,
 * `guest-window-actions.ts`, `face-tagging-actions.ts`, `_lib/papic-chapter-doors.ts`. Read by `papic-in-place.ts`
 * (`PAPIC_DOORS`, the same names without the `papic.` prefix — what `PapicStayForm` takes).
 */
export const PAPIC_STAY_DOORS = [
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
  // Papic › Run of show — Take off this moment (app-wide door, 2026-11-08).
  'papic.clearMomentChallengeAction',
  // 📷 Papic by chapter (owner 2026-11-01) — the card's pick and Start now (`_lib/papic-chapter-doors.ts`).
  'papic.pickPapicChapter',
  'papic.startPapicChapterNow',
] as const;
export type PapicStayDoor = (typeof PAPIC_STAY_DOORS)[number];
