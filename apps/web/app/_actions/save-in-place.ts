'use server';

import { revalidatePath } from 'next/cache';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { getURLFromRedirectError } from 'next/dist/client/components/redirect';
import { COULD_NOT_SAVE, redirectPath, type StayResult } from '@/lib/save-in-place';
import { isStayDoor, type StayDoor } from '@/lib/stay-doors';
import { limitedHelperRefusal } from '@/lib/host-gate';
import { plainRefusal } from '@/app/dashboard/[eventId]/guests/_components/plain-refusal';
import { DOORS } from './stay-registry';

/**
 * 📍 THE ONE DOOR EVERY `StayForm` SAVES THROUGH (owner, 2026-10-26, DECISION_LOG "A SAVE NEVER RESETS THE SCREEN —
 * APP-WIDE": *"same to the rest of the website. avoid resetting the whole screen"*).
 *
 * The browser names a door (`lib/stay-doors.ts`); the registry (`./stay-registry/`) alone maps the name to an action —
 * never a function from the client. This runs the SAME action (its sign-in, its membership and gate checks, its
 * columns, its own `revalidatePath`) and turns the redirect it ends in into an ANSWER, in the area's own words:
 *   · saved → the screen it would have re-drawn is re-rendered in place (`revalidatePath`);
 *   · refused → said on the row;
 *   · signed out / not on the event / off the screen → the redirect is let through and the browser navigates as before
 *     — a gate's bounce never reads as "saved".
 * The form keeps the action itself as its no-JavaScript path. Papic's door (#6970) is one area of this one.
 * Held by `lib/a-save-never-resets-the-screen.test.ts`.
 */
export async function saveInPlace(door: StayDoor, formData: FormData): Promise<StayResult> {
  /* The name came from the browser — only a registered door runs (`Object.hasOwn`: never a prototype key). */
  if (!isStayDoor(door) || !Object.hasOwn(DOORS, door)) return { ok: false, error: COULD_NOT_SAVE };
  const { run, read, area } = DOORS[door];
  /* 🔒 The limited-helper gate, before anything runs (owner 2026-10-26: a limited helper changes only the areas the
     host set to Edit) — on every event door. `false` = not an event's write (supplier, account, Panood control, chat):
     no event gate, exactly as the action itself asks none. */
  if (area !== false) {
    const eventId = formData.get('event_id');
    const helperRefusal = await limitedHelperRefusal(typeof eventId === 'string' ? eventId : '', area);
    if (helperRefusal) return { ok: false, error: helperRefusal };
  }
  try {
    await run(formData);
    return { ok: true };
  } catch (e) {
    if (!isRedirectError(e)) {
      /* A refusal a gate throws with its own words (`refuseLimitedHelper`) is said as it is — a database's words never
         are (`plainRefusal`: a host never reads "violates constraint…"). */
      return { ok: false, error: plainRefusal(e instanceof Error ? e.message : null, COULD_NOT_SAVE) };
    }
    const url = getURLFromRedirectError(e) ?? '';
    const answer = read(url);
    if (answer === 'navigate') throw e;
    /* The screen it would have re-drawn is the screen the press is on — make sure it re-renders fresh. */
    if (answer.ok) revalidatePath(redirectPath(url));
    return answer;
  }
}
