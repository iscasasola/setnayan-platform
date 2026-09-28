import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';
import { ENTOURAGE_COLUMNS } from '@/lib/entourage';
import { isPlaceholderSeat } from '@/lib/extra-seats';
import { buildInvitationUrl, renderInvitationQrSvg } from '@/lib/qr';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';

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

/**
 * The bringer's plus-ones as "Your guests" draws them: each named one's own
 * invitation link (the ONE url speller, `buildInvitationUrl`, on the event's
 * canonical slug) and — when `withPasses` — their pass, rendered by the same
 * renderer as every other guest QR. Only this bringer's own seats (see above).
 */
export async function yourGuestsFor(
  admin: AdminClient,
  event: { event_id: string; slug: string },
  bringerGuestId: string,
  /** `look` — the event's QR look (lib/qr-look.ts); the free look when absent. */
  opts: { withPasses: boolean; look?: Parameters<typeof renderInvitationQrSvg>[0]['look'] },
): Promise<{
  guests: { guestId: string; name: string | null; inviteUrl: string | null }[];
  passes: Record<string, string>;
}> {
  const seats = await plusOneSeatsFor(admin, event.event_id, bringerGuestId);
  if (seats.length === 0) return { guests: [], passes: {} };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const ownerSlug = await resolveEventOwnerSlug(admin, event.event_id);
  const passes: Record<string, string> = {};
  const guests = await Promise.all(
    seats.map(async (s) => {
      if (!s.qrToken) return { guestId: s.guest_id, name: s.name, inviteUrl: null };
      const params = { appUrl, slug: event.slug, qrToken: s.qrToken, ownerSlug };
      if (opts.withPasses) {
        passes[s.guest_id] = await renderInvitationQrSvg({ ...params, look: opts.look });
      }
      return { guestId: s.guest_id, name: s.name, inviteUrl: buildInvitationUrl(params) };
    }),
  );
  return { guests, passes };
}

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
