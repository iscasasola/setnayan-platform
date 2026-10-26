'use server';

import { revalidatePath } from 'next/cache';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { getURLFromRedirectError } from 'next/dist/client/components/redirect';
import { COULD_NOT_SAVE, inPlaceAnswer, redirectPath, type StayResult, type StayWords } from '@/lib/save-in-place';
import { isStayDoor, type StayDoor } from '@/lib/stay-doors';
import { limitedHelperRefusal } from '@/lib/host-gate';
import type { DelegateArea } from '@/lib/delegate-areas';
import { memoriesNotice } from '@/lib/memories-notice';
import { PAPIC_WORDS } from '@/app/dashboard/[eventId]/studio/papic/_lib/papic-in-place';
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
import {
  approveScreenedCapture,
  blockUploader,
  deletePhotoForever,
  reportCapture,
  setCaptureHidden,
  setSeatPhotoHidden,
  unblockUploader,
} from '@/app/dashboard/[eventId]/studio/papic/moderation/actions';
import { setVendorCapturesHidden } from '@/app/dashboard/[eventId]/studio/papic/vendor-visibility-actions';
import { applyActivityPicks, toggleActivityPick } from '@/app/dashboard/[eventId]/schedule/activity-picks-actions';
import { addSponsor, markResponse, removeSponsor, sendInvitation, updateSponsor } from '@/app/dashboard/[eventId]/sponsors/actions';

/**
 * 📍 THE ONE DOOR EVERY `StayForm` SAVES THROUGH (owner, 2026-10-26, DECISION_LOG "A SAVE NEVER RESETS THE SCREEN —
 * APP-WIDE": *"same to the rest of the website. avoid resetting the whole screen"*).
 *
 * The browser names a door (`lib/stay-doors.ts`); this file alone maps the name to an action — never a function from
 * the client. It runs the SAME action (its sign-in, its membership and gate checks, its columns, its own
 * `revalidatePath`) and turns the redirect it ends in into an ANSWER (`inPlaceAnswer`, in the area's own words): saved
 * → the page re-renders in place; refused → said on the row; signed out / not on the event / off the screen → the
 * redirect is let through and the browser navigates as before. The form keeps the action itself as its no-JavaScript
 * path. Held by `lib/a-save-never-resets-the-screen.test.ts`.
 */

/** An action bound to its event (`.bind(null, eventId)` on the plain form) reads the event from the form instead. */
const onEvent =
  (fn: (eventId: string, fd: FormData) => Promise<unknown>) =>
  (fd: FormData): Promise<unknown> =>
    fn(String(fd.get('event_id') ?? ''), fd);

const EVENT_SCREEN = (screen: string) => new RegExp(`^/dashboard/[^/]+/${screen}$`);

const MEMORIES: StayWords = {
  /* the photo's sheet (Memories · Papic › Moderation) and a supplier's photos switch (Memories · Event Details · Papic) */
  within: [EVENT_SCREEN('memories'), EVENT_SCREEN('studio/papic/moderation'), EVENT_SCREEN('details'), EVENT_SCREEN('studio/papic')],
  refuse: (q) => {
    const n = memoriesNotice(Object.fromEntries(q));
    return n && n.tone === 'bad' ? n.text : null;
  },
};
const SCHEDULE: StayWords = { within: [EVENT_SCREEN('schedule')] };
/* Sponsors' `?error=` already carries the page's own sentence (`sponsors/page.tsx` shows it as given). */
const SPONSORS: StayWords = { within: [EVENT_SCREEN('sponsors')], refuse: (q) => q.get('error') };

/**
 * `area` is the limited-helper area the action changes — the SAME one `AREA_RULES` gives it in
 * `app/dashboard/[eventId]/every-action-refuses-a-limited-helper.test.ts` (studio/papic/ → 'photos', schedule/ →
 * 'schedule', sponsors → none, so a limited helper is refused). The door asks the gate BEFORE any action runs; each
 * action asks again on its own.
 */
type Door = { run: (fd: FormData) => Promise<unknown>; words: StayWords; area: DelegateArea | null };
const papic = (run: (fd: FormData) => Promise<unknown>): Door => ({ run, words: PAPIC_WORDS, area: 'photos' });
const memories = (run: (fd: FormData) => Promise<unknown>): Door => ({ run, words: MEMORIES, area: 'photos' });
const schedule = (run: (fd: FormData) => Promise<unknown>): Door => ({ run, words: SCHEDULE, area: 'schedule' });
const sponsors = (run: (fd: FormData) => Promise<unknown>): Door => ({ run, words: SPONSORS, area: null });

const DOORS: Readonly<Record<StayDoor, Door>> = {
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
  'memories.setCaptureHidden': memories(onEvent(setCaptureHidden)),
  'memories.setSeatPhotoHidden': memories(onEvent(setSeatPhotoHidden)),
  'memories.approveScreenedCapture': memories(onEvent(approveScreenedCapture)),
  'memories.reportCapture': memories(onEvent(reportCapture)),
  'memories.blockUploader': memories(onEvent(blockUploader)),
  'memories.unblockUploader': memories(onEvent(unblockUploader)),
  'memories.deletePhotoForever': memories(onEvent(deletePhotoForever)),
  'memories.setVendorCapturesHidden': memories(setVendorCapturesHidden),
  'schedule.toggleActivityPick': schedule(toggleActivityPick),
  'schedule.applyActivityPicks': schedule(applyActivityPicks),
  'sponsors.addSponsor': sponsors(addSponsor),
  'sponsors.updateSponsor': sponsors(updateSponsor),
  'sponsors.removeSponsor': sponsors(removeSponsor),
  'sponsors.sendInvitation': sponsors(sendInvitation),
  'sponsors.markResponse': sponsors(markResponse),
};

export async function saveInPlace(door: StayDoor, formData: FormData): Promise<StayResult> {
  /* The name came from the browser — only a registered door runs (`Object.hasOwn`: never a prototype key). */
  if (!isStayDoor(door) || !Object.hasOwn(DOORS, door)) return { ok: false, error: COULD_NOT_SAVE };
  const { run, words, area } = DOORS[door];
  /* 🔒 The limited-helper gate, before anything runs (owner 2026-10-26: a limited helper changes only the areas the
     host set to Edit). Every form a door serves carries `event_id`. */
  const eventId = formData.get('event_id');
  const helperRefusal = await limitedHelperRefusal(typeof eventId === 'string' ? eventId : '', area);
  if (helperRefusal) return { ok: false, error: helperRefusal };
  try {
    await run(formData);
    return { ok: true };
  } catch (e) {
    if (!isRedirectError(e)) {
      /* A refusal a gate throws with its own words (`refuseLimitedHelper`) is said as it is. */
      const said = e instanceof Error && e.message && e.message.length < 200 ? e.message : null;
      return { ok: false, error: said ?? COULD_NOT_SAVE };
    }
    const url = getURLFromRedirectError(e) ?? '';
    const answer = inPlaceAnswer(url, words);
    if (answer === 'navigate') throw e;
    /* The screen it would have re-drawn is the screen the press is on — make sure it re-renders fresh. */
    if (answer.ok) revalidatePath(redirectPath(url));
    return answer;
  }
}
