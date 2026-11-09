import 'server-only';
import type { PapicStayDoor } from '@/lib/stay-doors/papic';
import {
  addLibraryChallengeAction,
  armChallengeAction,
  clearMomentChallengeAction,
  createCoupleChallengeAction,
  deleteCoupleChallengeAction,
  releaseTheRest,
  reviewVendorChallengeAction,
  setCapturePreserved,
  setChallengesPausedAction,
  setClipShowcaseApproval,
  setCoupleChallengeActiveAction,
  setGuestAllotment,
  setGuestAllotments,
  setGuestClipShowcaseApproval,
  setPapicUploadsOpen,
  setPapicWindow,
  stopChallengeAction,
} from '@/app/dashboard/[eventId]/studio/papic/actions';
import { setPapicGuestCaptureEarly } from '@/app/dashboard/[eventId]/studio/papic/guest-window-actions';
import { setCoupleFaceTaggingDeclined } from '@/app/dashboard/[eventId]/studio/papic/face-tagging-actions';
import { pickPapicChapter, startPapicChapterNow } from '@/app/dashboard/[eventId]/studio/papic/_lib/papic-chapter-doors';
import { papicInPlaceAnswer } from '@/app/dashboard/[eventId]/studio/papic/_lib/papic-in-place';
import { kindRead, type Door } from './_door';

/**
 * 📍 PAPIC (owner, live 2026-10-26: *"saving minimum and maximum on papic resets the whole screen"* · *"when i turn of a
 * challenge … it jumped to a different page"*). #6970's own door, folded in with NO change in behaviour: the same
 * actions, the same reader (`papicInPlaceAnswer`, Papic's words), the same gate — every Papic setting is the `photos`
 * area.
 */
const papic = kindRead(papicInPlaceAnswer, 'photos');

export const PAPIC: Readonly<Record<PapicStayDoor, Door>> = {
  'papic.setGuestAllotments': papic(setGuestAllotments),
  'papic.setGuestAllotment': papic(setGuestAllotment),
  'papic.releaseTheRest': papic(releaseTheRest),
  'papic.setPapicWindow': papic(setPapicWindow),
  'papic.setPapicUploadsOpen': papic(setPapicUploadsOpen),
  'papic.setPapicGuestCaptureEarly': papic(setPapicGuestCaptureEarly),
  'papic.setCoupleFaceTaggingDeclined': papic(setCoupleFaceTaggingDeclined),
  'papic.setCapturePreserved': papic(setCapturePreserved),
  'papic.setClipShowcaseApproval': papic(setClipShowcaseApproval),
  'papic.setGuestClipShowcaseApproval': papic(setGuestClipShowcaseApproval),
  'papic.reviewVendorChallengeAction': papic(reviewVendorChallengeAction),
  'papic.setChallengesPausedAction': papic(setChallengesPausedAction),
  'papic.setCoupleChallengeActiveAction': papic(setCoupleChallengeActiveAction),
  'papic.createCoupleChallengeAction': papic(createCoupleChallengeAction),
  'papic.addLibraryChallengeAction': papic(addLibraryChallengeAction),
  'papic.armChallengeAction': papic(armChallengeAction),
  'papic.stopChallengeAction': papic(stopChallengeAction),
  'papic.deleteCoupleChallengeAction': papic(deleteCoupleChallengeAction),
  'papic.clearMomentChallengeAction': papic(clearMomentChallengeAction),
  'papic.pickPapicChapter': papic(pickPapicChapter),
  'papic.startPapicChapterNow': papic(startPapicChapterNow),
};
