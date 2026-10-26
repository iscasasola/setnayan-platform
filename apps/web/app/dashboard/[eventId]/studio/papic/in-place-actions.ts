'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { limitedHelperRefusal } from '@/lib/host-gate';
import { getURLFromRedirectError } from 'next/dist/client/components/redirect';
import {
  addLibraryChallengeAction,
  armChallengeAction,
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
} from './actions';
import { setPapicGuestCaptureEarly } from './guest-window-actions';
import { setCoupleFaceTaggingDeclined } from './face-tagging-actions';
import { papicInPlaceAnswer, type PapicDoor, type PapicInPlaceResult } from './_lib/papic-in-place';

/**
 * 📍 EVERY PAPIC CONTROL SAVES IN PLACE (owner, live 2026-10-26: *"saving minimum and maximum on papic resets the whole
 * screen. this should not happen"* · *"when i turn of a challenge. it should just remove it"* · *"it jumped to a
 * different page"*).
 *
 * Each Papic form's action ends in `redirect(...)` — a navigation, so a press re-drew the page from the top (or, for
 * a challenge's eye with no `return_to`, landed on the Challenges page — `challengeReturnPath`'s default). This door
 * runs the SAME action — the same gate, the same checks, the same columns, its own `revalidatePath` — and turns the
 * redirect it ends in into an ANSWER (`papicInPlaceAnswer`): a refusal (`?…_error=` · `?add=full`) is said on the row;
 * anything else re-renders the page in place. A redirect that must navigate (signed out, not on the event) still does.
 * The forms keep the action itself as their no-JavaScript path (`papic-stay-form.tsx`).
 * Held by `_lib/papic-saves-in-place.test.ts`.
 */
const DOORS: Readonly<Record<PapicDoor, (fd: FormData) => Promise<unknown>>> = {
  setGuestAllotments,
  setGuestAllotment,
  releaseTheRest,
  setPapicWindow,
  setPapicUploadsOpen,
  setPapicGuestCaptureEarly,
  setCoupleFaceTaggingDeclined,
  setCapturePreserved,
  setClipShowcaseApproval,
  setGuestClipShowcaseApproval,
  reviewVendorChallengeAction,
  setChallengesPausedAction,
  setCoupleChallengeActiveAction,
  createCoupleChallengeAction,
  addLibraryChallengeAction,
  armChallengeAction,
  stopChallengeAction,
  deleteCoupleChallengeAction,
};

export async function papicSaveInPlace(door: PapicDoor, formData: FormData): Promise<PapicInPlaceResult> {
  const run = DOORS[door];
  if (!run) return { ok: false, error: 'That could not be saved just now. Please try again.' };
  /* 🔒 The door's own gate, before any action runs — every Papic setting is the 'photos' area (owner 2026-10-26: a
     limited helper changes only the areas the host set to Edit). Each wrapped action gates again; this says it here. */
  const eventId = formData.get('event_id');
  const helperRefusal = await limitedHelperRefusal(typeof eventId === 'string' ? eventId : '', 'photos');
  if (helperRefusal) return { ok: false, error: helperRefusal };
  try {
    await run(formData);
    return { ok: true };
  } catch (e) {
    if (!isRedirectError(e)) {
      /* A refusal the gate throws with its own words (`refuseLimitedHelper`) is said as it is. */
      const words = e instanceof Error && e.message && e.message.length < 200 ? e.message : null;
      return { ok: false, error: words ?? 'That could not be saved just now. Please try again.' };
    }
    const answer = papicInPlaceAnswer(getURLFromRedirectError(e) ?? '');
    if (answer === 'navigate') throw e;
    return answer;
  }
}
