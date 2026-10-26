import { papicHomeHref } from '@/lib/papic-home-href';
import 'server-only';

import { eventPapicGuestAccess, eventPapicGuestAccessWhy, type PapicGuestAccess } from '@/lib/papic-guest';
import { recordFieldHref } from '@/lib/event-details-record';
import { profileSetup, surfaceEnabled, type EventTypeProfile } from '@/lib/event-type-profile';
import { ALLOTMENT_STORAGE } from '@/lib/papic-guest-allotments';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { GuestPapicState } from '@/lib/papic-guest-camera';

export type { GuestPapicState };

/**
 * guest-papic-read.ts — what the guest card's Papic row needs, read on the server (owner 2026-10-23: *"set papic setting
 * per guest on each guest card"*; prototype `guest_card_groups_and_papic_2026-10-23.html`, frame 3).
 *
 *   · `access` — is the event's Papic on? THREE states (`eventPapicGuestAccess`), never the boolean: 'off' draws the one
 *     line "Papic is off · Turn on ›", and 'unknown' (the check did not answer) says so — never "off".
 *   · `ceiling` — this guest's camera (`papic_guest_spend_ceilings`): `null` = no row, they share with everyone; `0` =
 *     no camera; N = a set number. `undefined` = the read did not answer (or the viewer is not the couple), and the row
 *     then offers NO control — a couple can never save a choice worked out from a failed read.
 *
 * ⛔ The table is RLS-on and REVOKEd from anon and authenticated — only the service client reaches it, which is why this
 * file is `server-only`. Both reads go through the SERVICE client so they start with the page's first trip (the guest
 * list may be at most 2 trips deep — `the-guests-page-asks-once.test.ts`; the entitlement client would first ask who
 * the viewer is) — and so 🔑 THE CALLER HANDS THEM ONLY TO THE COUPLE (`viewer.isCouple`, the card's `canManageAccess`),
 * the same people `setGuestAllotment` lets write the ceiling (`forTheCouple` below). The service authority is the one the
 * entitlement client hands out too, so the card and the list ask Papic ONCE per render (`lib/request-once.ts`).
 */
export async function readEventPapicAccess(eventId: string): Promise<PapicGuestAccess> {
  try {
    return await eventPapicGuestAccess(createAdminClient(), eventId);
  } catch {
    // A check that did not answer — never "off".
    return 'unknown';
  }
}

/**
 * 🚪 Where "Turn on ›" lands — ON THE SWITCH, never near it (review 2026-10-23): the host's own "Photos from your
 * guests? — No" is the Event Details answer (the same door Home's Papic row draws, `dayPapicView`); an event with no
 * Papic yet is the Papic page, which arms the free pool on its first view.
 */
export function papicSwitchHref(eventId: string, answeredNo: boolean): string {
  return answeredNo ? recordFieldHref(eventId, 'papic-answer') : papicHomeHref(eventId);
}

/** The event's Papic and one guest's camera, both started at once. Hand the result on with `forTheCouple`. */
export async function readGuestPapic(eventId: string, guestId: string): Promise<GuestPapicState> {
  const [why, ceiling] = await Promise.all([
    eventPapicGuestAccessWhy(createAdminClient(), eventId).catch(() => ({ access: 'unknown' as const, answeredNo: false })),
    readCeiling(eventId, guestId),
  ]);
  return {
    access: why.access,
    ceiling,
    door: why.access === 'off' ? papicSwitchHref(eventId, why.answeredNo) : null,
    answeredNo: why.access === 'off' && why.answeredNo,
  };
}

/**
 * Does this event type ASK "Photos from your guests?" in Event Details — an Event Hub, and a camera it offers (the same
 * test `details/page.tsx` draws the `papic-answer` row by)? Where it does not, there is no answer to turn back on there.
 */
export function papicAnswerOffered(profile: EventTypeProfile): boolean {
  return surfaceEnabled(profile, 'website') && profileSetup(profile).cameraDefault !== 'off';
}

/**
 * What the card may show: the camera — and the door to turn Papic on — are the couple's (the same people who may change
 * the answer and set a camera); anyone else gets the event's Papic only, with no door they could not walk through. And a
 * door to the Event Details answer only where that event type asks it (`answerOffered`, `papicAnswerOffered`).
 */
export function forTheCouple(papic: GuestPapicState | null, couple: boolean, answerOffered = true): GuestPapicState | null {
  if (!papic) return null;
  if (!couple) return { access: papic.access, ceiling: undefined, door: null };
  // The host's "No" lives in Event Details — a door there only where that type asks the question (`papicAnswerOffered`).
  return papic.answeredNo && !answerOffered ? { ...papic, door: null } : papic;
}

async function readCeiling(eventId: string, guestId: string): Promise<number | null | undefined> {
  const { data, error } = await createAdminClient()
    .from(ALLOTMENT_STORAGE.table)
    .select('ceiling_points')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .maybeSingle();
  if (error) {
    logQueryError('readGuestPapic.ceiling', error, { eventId, guestId }, 'graceful_degrade');
    return undefined;
  }
  const points = (data as { ceiling_points?: unknown } | null)?.ceiling_points;
  return typeof points === 'number' ? points : null;
}
