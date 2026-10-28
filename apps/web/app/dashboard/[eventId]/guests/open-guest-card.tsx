'use server';

import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/is-uuid';
import { GuestCard, type GuestCardResult } from './_components/guest-card';
import { readGuestCard } from './_components/guest-card-read';

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
 */
const RETURN_TO = {
  march: (eventId: string) => `/dashboard/${eventId}/launch?tool=details&item=march`,
  invitation: (eventId: string) => `/dashboard/${eventId}/launch?tool=details&item=invitation`,
  // 👀 Home › Who's here — a face of a guest viewing the Event Hub (owner 2026-10-29).
  home: (eventId: string) => `/dashboard/${eventId}`,
} as const;

const COULD_NOT_OPEN = 'Their guest card couldn’t open just now — try again.';

export async function openGuestCard(eventId: string, guestId: string, at: keyof typeof RETURN_TO): Promise<GuestCardResult> {
  if (!isUuid(eventId) || !isUuid(guestId) || !(at in RETURN_TO)) return { ok: false, reason: COULD_NOT_OPEN };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: COULD_NOT_OPEN };
    const read = await readGuestCard(supabase, eventId, guestId, user.id);
    if (!read) return { ok: false, reason: 'This guest isn’t on your guest list any more.' };
    return {
      ok: true,
      card: <GuestCard frame="panel" eventId={eventId} {...read} returnTo={RETURN_TO[at](eventId)} errorMessage={null} inviteFlash={null} />,
    };
  } catch {
    return { ok: false, reason: COULD_NOT_OPEN };
  }
}
