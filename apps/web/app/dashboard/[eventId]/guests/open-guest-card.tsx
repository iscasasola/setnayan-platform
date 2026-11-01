'use server';

import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/is-uuid';
import { printsPageHref } from '@/lib/prints-page-href';
import { readGuestCard, type GuestCardRead } from './_components/guest-card-read';

/**
 * 🪪 A GUEST'S OWN CARD, OPENED IN PLACE — the Wedding March (owner, verbatim, 2026-10-14: *"on Wedding march. when we
 * click a guest, we can show the guest card on the guest's page so they can rename edit it there and do not need to go
 * back to guests."*) and the parents on the invitation (owner 2026-09-28, option (a)).
 *
 * ONE READ, THE ONE CARD (owner 2026-10-24: *"the guest card on wedding march is not same with the guest card."*). The card
 * is read only when a name is TAPPED — the march draws dozens of people, the Maker never reads every card up front — by
 * the one reader the standalone route uses (`readGuestCard`, under the couple's own session: RLS decides what they may
 * read), and drawn by the one card (`GuestCard`, the Guest list's panel: its header, ticket, Invite, ⋯, Papic, Access,
 * Delete, the approved folds). It writes nothing; the card's own forms write, as they do on the Guest list.
 *
 * `at` names the surface, so a failed save lands back where it was pressed — the server picks the address, the browser
 * never hands one in. A refusal is a plain sentence, never the database's words.
 *
 * 🛑 IT ANSWERS THE CARD'S DATA, NEVER THE CARD DRAWN (2026-10-29, the same fault as Home's ⚙ in #7042). An action's
 * answer is rendered through the CALLING route's client manifest, which Next builds from that route's SERVER imports
 * only. This read is called from the browser (`guest-card-sheet.tsx`) on the Maker, the Event Hub editor, a Details field
 * and Home's Event settings — none of which import the card's client pieces from a server file (the Maker keeps them
 * out of its first load on purpose: `guest-card-body.tsx`'s TYPE-ONLY seams). Answering `<GuestCard … />` therefore
 * sent references those routes could not resolve, and a tap on a walker or a parent fell to "Something on our end
 * didn't work". The card is drawn in the browser instead, by `_components/guest-card-in-place.tsx` — the SAME
 * `GuestCard`, loaded at the tap (and preloaded by the Maker), so no route's first load grows.
 * 🔒 `app/dashboard/[eventId]/_components/the-settings-sheet-is-in-homes-graph.test.ts` (every route × every action that
 * answers drawn pieces).
 */
const RETURN_TO = {
  /* 🗂 R4: the march and the seat plan are Guests' views — a failed save lands back on the view it was pressed on. */
  march: (eventId: string) => `/dashboard/${eventId}/guests?gview=march`,
  seats: (eventId: string) => `/dashboard/${eventId}/guests?gview=seats`,
  /* 🖨 The invitation's parents are a print's — its return is the Prints page (R8, 2026-10-27 "PRINTS LEAVES STUDIO"). */
  invitation: (eventId: string) => printsPageHref(eventId, 'invitation'),
} as const;

const COULD_NOT_OPEN = 'Their guest card couldn’t open just now — try again.';

/** The in-place read's answer: what `GuestCard` needs, and where a failed save lands — or a plain sentence. */
export type GuestCardOpened = { ok: true; read: GuestCardRead; returnTo: string } | { ok: false; reason: string };

export async function openGuestCard(eventId: string, guestId: string, at: keyof typeof RETURN_TO): Promise<GuestCardOpened> {
  if (!isUuid(eventId) || !isUuid(guestId) || !(at in RETURN_TO)) return { ok: false, reason: COULD_NOT_OPEN };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: COULD_NOT_OPEN };
    const read = await readGuestCard(supabase, eventId, guestId, user.id);
    if (!read) return { ok: false, reason: 'This guest isn’t on your guest list any more.' };
    return { ok: true, read, returnTo: RETURN_TO[at](eventId) };
  } catch {
    return { ok: false, reason: COULD_NOT_OPEN };
  }
}
