import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventSkuActive } from '@/lib/entitlements';
import { guestPhotoDisplayUrls } from '@/lib/uploads';
import { accountPhotoRefsByGuest } from '@/lib/guest-account-photos';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchInvitationBase, loadGuestCard } from '../_components/guest-card-data';
import {
  GuestCardBody,
  GUEST_CARD_ERROR_COPY,
} from '../_components/guest-card-body';

export const metadata = { title: 'Guest detail' };

/**
 * The standalone guest route. Since 2026-09-22 it is a LOADER, not a screen of
 * its own: it renders the same `GuestCardBody` the roster opens in place, so
 * the two presentations of a guest can never drift.
 *
 * ── Why it still exists ─────────────────────────────────────────────────────
 * Nothing in the UI links here any more — a guest opens as a panel over the
 * roster. This route stays because a URL that used to work should keep working:
 * it is the deep link, the hard-load fallback, the print target, and where a
 * failed save lands for a host who opened a guest directly.
 *
 * The card SAVES ITSELF here too. One behaviour, not two — a Save button on
 * this route and autosave on the panel would be exactly the divergence the
 * merge was done to end.
 */

type Props = {
  params: Promise<{ eventId: string; guestId: string }>;
  searchParams: Promise<{ error?: string; saved?: string; invite?: string }>;
};

export default async function GuestDetailPage({ params, searchParams }: Props) {
  const { eventId, guestId } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const data = await loadGuestCard(supabase, eventId, guestId);
  if (!data) notFound();
  const { guest } = data;

  const { data: eventRow, error: eventRowError } = await supabase
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();
  // ⚠ Refused, `invitationBase` falls to null and the QR card silently drops its
  // ⚠ Download / NFC / Copy strip — the guest's own link stops being reachable
  // ⚠ from here, with nothing on screen saying why.
  if (eventRowError) {
    logQueryError('GuestDetailPage.eventRow', eventRowError, { eventId }, 'graceful_degrade');
  }
  const invitationBase = await fetchInvitationBase(
    eventId,
    (eventRow as { slug?: string | null } | null)?.slug ?? null,
  );

  // Is the paid CUSTOM_QR_GUEST upgrade admin-approved for this event? The
  // branded PNG route 403s otherwise, so the card routes to the Invitation
  // page rather than dangling a download that can only fail.
  const brandedQrActive = await eventSkuActive(
    createAdminClient(),
    eventId,
    'CUSTOM_QR_GUEST',
  ).catch(() => false);

  /* The face. `guests.photo_url` holds an `r2://…` REFERENCE — handing a raw one
     to an <img> is a broken-image glyph, which is the defect three sibling
     screens shipped with. Both sources go through the same resolver, and the
     couple's own upload wins over the linked account's photo (owner 2026-09-20). */
  const photoDisplayUrls = await guestPhotoDisplayUrls([guest]);
  const accountRefByGuest = await accountPhotoRefsByGuest(supabase, eventId);
  const accountRef = accountRefByGuest[guest.guest_id];
  const accountUrls = accountRef
    ? await guestPhotoDisplayUrls([{ photo_url: accountRef }])
    : {};
  const photoDisplayUrl =
    photoDisplayUrls[guest.photo_url ?? ''] ??
    (accountRef ? (accountUrls[accountRef] ?? null) : null);

  const rawError = search.error ? decodeURIComponent(search.error) : null;
  const errorMessage = rawError
    ? (GUEST_CARD_ERROR_COPY[rawError] ?? rawError)
    : null;

  // Host-initiated email-invite feedback (Invite/Join v2).
  const inviteFlash =
    search.invite === 'sent'
      ? { ok: true, msg: `Sign-in link sent to ${guest.email}.` }
      : search.invite === 'failed'
        ? { ok: false, msg: 'We couldn’t send the link just now — please try again.' }
        : search.invite === 'no_email'
          ? { ok: false, msg: 'Add an email below and save it first, then send the invite.' }
          : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-16">
      <Link
        href={`/dashboard/${eventId}/guests`}
        className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta-700"
      >
        ‹ Back to guest list
      </Link>

      <GuestCardBody
        eventId={eventId}
        data={data}
        invitationBase={invitationBase}
        brandedQrActive={brandedQrActive}
        photoDisplayUrl={photoDisplayUrl}
        variant="page"
        returnTo={`/dashboard/${eventId}/guests/${guestId}`}
        errorMessage={errorMessage}
        inviteFlash={inviteFlash}
      />
    </div>
  );
}
