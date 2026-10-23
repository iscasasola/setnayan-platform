import 'server-only';

import { eventPapicGuestAccess, type PapicGuestAccess } from '@/lib/papic-guest';
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

/** The event's Papic and one guest's camera, both started at once. Hand the result on with `forTheCouple`. */
export async function readGuestPapic(eventId: string, guestId: string): Promise<GuestPapicState> {
  const [access, ceiling] = await Promise.all([readEventPapicAccess(eventId), readCeiling(eventId, guestId)]);
  return { access, ceiling };
}

/** What the card may show: the camera is the couple's to see and set — anyone else gets the event's Papic only. */
export function forTheCouple(papic: GuestPapicState | null, couple: boolean): GuestPapicState | null {
  if (!papic) return null;
  return couple ? papic : { access: papic.access, ceiling: undefined };
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
