'use server';

import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/is-uuid';
import { logQueryError } from '@/lib/supabase/error-detect';
import { GuestCardBody } from '../guests/_components/guest-card-body';
import { fetchInvitationBase, loadGuestCard } from '../guests/_components/guest-card-data';

/**
 * 🚶 THE WEDDING MARCH OPENS A PERSON'S OWN GUEST CARD, IN PLACE (owner, verbatim, 2026-10-14: *"on Wedding march. when we
 * click a guest, we can show the guest card on the guest's page so they can rename edit it there and do not need to go back
 * to guests."*).
 *
 * ONE READ, ONE CARD. The march draws dozens of people; reading every one's card with the Maker (as the parents' few cards
 * are, `launch/page.tsx`) would cost a dozen queries per person on every Maker render. So the card is read only when a name
 * is TAPPED: this action runs the one loader the Guest list uses (`loadGuestCard`, under the couple's own session — RLS
 * decides what they may read) and returns the SAME card the parents open — `GuestCardBody`, the hand-drawn kit (no template
 * kit: the Maker's first load does not carry the templates, `guest-card-kit.ts`), the panel variant, the shipped
 * `updateGuest` behind it. It writes nothing; the card's own forms write, as they do on the Guest list.
 *
 * A refusal is a plain sentence, never the database's words.
 */
export type MarchCardResult = { ok: true; card: ReactNode } | { ok: false; reason: string };

const COULD_NOT_OPEN = 'Their guest card couldn’t open just now — try again.';

export async function openMarchGuestCard(eventId: string, guestId: string): Promise<MarchCardResult> {
  if (!isUuid(eventId) || !isUuid(guestId)) return { ok: false, reason: COULD_NOT_OPEN };
  try {
    const supabase = await createClient();
    const [data, eventRow] = await Promise.all([
      loadGuestCard(supabase, eventId, guestId),
      supabase.from('events').select('slug').eq('event_id', eventId).maybeSingle(),
    ]);
    if (!data) return { ok: false, reason: 'This guest isn’t on your guest list any more.' };
    if (eventRow.error) logQueryError('openMarchGuestCard.eventRow', eventRow.error, { eventId }, 'graceful_degrade');
    const invitationBase = await fetchInvitationBase(eventId, (eventRow.data as { slug?: string | null } | null)?.slug ?? null).catch(() => null);
    return {
      ok: true,
      card: (
        <GuestCardBody
          eventId={eventId}
          data={data}
          invitationBase={invitationBase}
          photoDisplayUrl={null}
          variant="panel"
          returnTo={`/dashboard/${eventId}/launch?tool=details&item=march`}
          errorMessage={null}
          inviteFlash={null}
        />
      ),
    };
  } catch {
    return { ok: false, reason: COULD_NOT_OPEN };
  }
}
