import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';
import { ENTOURAGE_COLUMNS } from '@/lib/entourage';
import { isPlaceholderSeat } from '@/lib/extra-seats';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * THE PEOPLE A GUEST IS BRINGING — each plus-one is their OWN guest row with
 * their OWN key (owner 2026-09-26: *"so the make a name. and they get a qr for
 * that name."*). Minted by the reply's per-seat name boxes (`submitRsvp` →
 * `planSeatNames`), oldest first — the same order the reply's boxes fill.
 *
 * `qrToken` is carried ONLY for a named seat: it is what "Send their invite"
 * shares, and a TBA seat has nobody to send it to. It is read only for rows
 * whose `plus_one_of_guest_id` is the caller's OWN guest — the bringer holds
 * those keys by the owner's ruling ("the guest who brings plus-ones hands each
 * one their own key"), and never anybody else's.
 *
 * A failed read returns `[]`, which the callers draw as "no guests listed" —
 * never as "you are bringing nobody": the reply card falls back to its single
 * box and the thank-you simply omits the section.
 */
export type PlusOneSeat = {
  guest_id: string;
  /** Null while the seat is still TBA. */
  name: string | null;
  /** The seat's own key — only for a named seat. */
  qrToken: string | null;
};

export async function plusOneSeatsFor(
  admin: AdminClient,
  eventId: string,
  bringerGuestId: string,
): Promise<PlusOneSeat[]> {
  const { data, error } = await admin
    .from('guests')
    .select(`${ENTOURAGE_COLUMNS}, plus_one_name_confirmed_at, created_at, qr_token`)
    .eq('event_id', eventId)
    .eq('plus_one_of_guest_id', bringerGuestId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[supabase-error] app/[slug]/_lib/plus-one-seats.server.ts · from:guests.select', error);
    return [];
  }
  return (data ?? []).map((r) => {
    const placeholder = isPlaceholderSeat({
      guest_id: r.guest_id as string,
      first_name: (r.first_name as string | null) ?? null,
      confirmed_at: (r.plus_one_name_confirmed_at as string | null) ?? null,
    });
    const name = placeholder ? null : `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || null;
    return {
      guest_id: r.guest_id as string,
      name,
      qrToken: name ? ((r.qr_token as string | null) ?? null) : null,
    };
  });
}
