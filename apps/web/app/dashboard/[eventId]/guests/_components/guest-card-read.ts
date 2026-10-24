import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { passCardTicketVersion } from '@/lib/pass-card.server';
import { guestPhotoDisplayUrls } from '@/lib/uploads';
import { accountPhotoRefsByGuest } from '@/lib/guest-account-photos';
import { loadGuestHelperCard } from '@/lib/guest-helper-card.server';
import { guestDisplayName } from '@/lib/guests';
import { resolveProfileByEvent } from '@/lib/event-type-profile';
import { isStoreShellRequest } from '@/lib/request-platform';
import { fetchInvitationBase, loadGuestCard } from './guest-card-data';
import { loadInviteSetup } from './invite-message-setup';
import { forTheCouple, papicAnswerOffered, readGuestPapic } from './guest-papic-read';
import type { GuestCardProps } from './guest-card';

/**
 * 🪪 EVERYTHING ONE GUEST'S CARD NEEDS, READ ONCE (owner 2026-10-24, one guest card everywhere).
 *
 * The reads the standalone route always made for its card — the card itself (`loadGuestCard`, the Guest list's loader,
 * under the viewer's own session: RLS decides), the event's Invite words, the event's Papic and this guest's camera
 * (handed on only to the couple — `forTheCouple`), whether this is the store app (Papic is never named there), a
 * limited helper's grants (couple only), the face (the couple's upload, else the linked account's photo) and the
 * ticket's version (a PROMISE — the card never waits for it). One function, so the standalone route and every surface
 * that opens a guest's card in place (`open-guest-card.tsx`) hand `GuestCard` the same things. The Guest list reads the
 * same things itself, started beside its roster (`guests/page.tsx`) — it does not wait for the list to finish.
 *
 * Null = this guest is not on this viewer's list (or the read was refused).
 */
export type GuestCardRead = Pick<
  GuestCardProps,
  'data' | 'invitationBase' | 'photoDisplayUrl' | 'inviteSetup' | 'papic' | 'storeShell' | 'ticketVersion' | 'helper'
>;

export async function readGuestCard(
  supabase: SupabaseClient,
  eventId: string,
  guestId: string,
  viewerUserId: string,
): Promise<GuestCardRead | null> {
  const [data, inviteSetup, papicRead, storeShell, profile, eventRow] = await Promise.all([
    loadGuestCard(supabase, eventId, guestId),
    loadInviteSetup(supabase, eventId),
    readGuestPapic(eventId, guestId),
    isStoreShellRequest(),
    resolveProfileByEvent(eventId),
    supabase.from('events').select('slug').eq('event_id', eventId).maybeSingle(),
  ]);
  if (!data) return null;
  const { guest } = data;
  // ⚠ Refused, `invitationBase` falls to null and the card's link, NFC and copy strip drop — said in the log, never silent.
  if (eventRow.error) logQueryError('readGuestCard.eventRow', eventRow.error, { eventId }, 'graceful_degrade');
  const [invitationBase, helper, photoDisplayUrl] = await Promise.all([
    fetchInvitationBase(eventId, (eventRow.data as { slug?: string | null } | null)?.slug ?? null),
    data.canManageAccess
      ? loadGuestHelperCard({ eventId, guestId, viewerUserId, displayName: guestDisplayName(guest) })
      : Promise.resolve(null),
    /* The face. `guests.photo_url` holds an `r2://…` REFERENCE — both sources go through the one resolver, and the
       couple's own upload wins over the linked account's photo (owner 2026-09-20). */
    (async () => {
      const own = await guestPhotoDisplayUrls([guest]);
      if (own[guest.photo_url ?? '']) return own[guest.photo_url ?? '']!;
      const accountRef = (await accountPhotoRefsByGuest(supabase, eventId, viewerUserId))[guest.guest_id];
      if (!accountRef) return null;
      return (await guestPhotoDisplayUrls([{ photo_url: accountRef }]))[accountRef] ?? null;
    })(),
  ]);
  return {
    data,
    invitationBase,
    photoDisplayUrl,
    inviteSetup,
    papic: forTheCouple(papicRead, data.canManageAccess, papicAnswerOffered(profile)),
    storeShell,
    // 🎟 The ticket at its versioned, year-long cached address (streamed — the card never waits).
    ticketVersion: passCardTicketVersion(createAdminClient(), guestId).catch(() => null),
    helper,
  };
}
