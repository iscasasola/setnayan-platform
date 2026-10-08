import Link from 'next/link';
import { loadGuestHelperCard } from '@/lib/guest-helper-card.server';
import { guestDisplayName } from '@/lib/guests';
import { GuestHelperAccess } from '../_components/guest-helper-access';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventSkuActive } from '@/lib/entitlements';
import { guestPhotoDisplayUrls } from '@/lib/uploads';
import { accountPhotoRefsByGuest } from '@/lib/guest-account-photos';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isUuid } from '@/lib/is-uuid';
import { fetchInvitationBase, loadGuestCard } from '../_components/guest-card-data';
import { loadInviteSetup } from '../_components/invite-message-setup';
import {
  GuestCardBody,
  GUEST_CARD_ERROR_COPY,
} from '../_components/guest-card-body';
import { GuestInviteCell } from '../_components/guest-invite-cell';
import { GuestMoreMenu, GuestTicketThumb } from '../_components/guest-ticket-parts';
import { TEMPLATE_KIT } from '../_components/guest-card-template-kit';
import { UndoToastHost } from '../_components/undo-toast';

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
  searchParams: Promise<{ error?: string; saved?: string; invite?: string; swapped?: string; unlinked?: string; new_qr?: string }>;
};

export default async function GuestDetailPage({ params, searchParams }: Props) {
  const { eventId, guestId } = await params;
  // 🔑 A MALFORMED ADDRESS IS "NOT FOUND", NEVER A CRASH. A non-UUID segment
  // makes Postgres reject the query (22P02), and `fetchGuestById` deliberately
  // RE-THROWS every error except a missing relation — so `/guests/{guest}`
  // rendered the global error boundary ("Something on our end didn't work")
  // instead of a 404 (measured on prod 2026-09-29). Checked once, here, before
  // any query sees the segment. See lib/is-uuid.ts.
  if (!isUuid(guestId) || !isUuid(eventId)) notFound();
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [data, inviteSetup] = await Promise.all([
    loadGuestCard(supabase, eventId, guestId),
    // Send invite · Copy message — the event's words + the couple's wording.
    loadInviteSetup(supabase, eventId),
  ]);
  if (!data) notFound();
  const { guest } = data;
  // A limited helper's grants, colours and record (the Hosts fold, F2) — couple only.
  const helper = data.canManageAccess
    ? await loadGuestHelperCard({ eventId, guestId, viewerUserId: user.id, displayName: guestDisplayName(guest) })
    : null;

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

  /* The face. `guests.photo_url` holds an `r2://…` REFERENCE — handing a raw one
     to an <img> is a broken-image glyph, which is the defect three sibling
     screens shipped with. Both sources go through the same resolver, and the
     couple's own upload wins over the linked account's photo (owner 2026-09-20). */
  const photoDisplayUrls = await guestPhotoDisplayUrls([guest]);
  const accountRefByGuest = await accountPhotoRefsByGuest(supabase, eventId, user.id);
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

  // What the careful actions did — said on the card they were pressed on.
  const inviteFlash =
    search.swapped === '1'
      ? { ok: true, msg: 'Done — the spot is theirs, with a new key. The old link and QR no longer work. Share their invitation from the guest list.' }
      : search.unlinked === '1'
        ? { ok: true, msg: 'Unlinked — that account no longer holds this invitation, and it has a new key. The old link and QR no longer work.' }
        : search.new_qr === '1'
          ? { ok: true, msg: 'Done — a new QR and link. The old ones no longer work. Send them the new one.' }
          : // The couple row's sign-in link (the one email left — see the card's Access).
            search.invite === 'sent'
            ? { ok: true, msg: `Sign-in link sent to ${guest.email}.` }
            : search.invite === 'failed'
              ? { ok: false, msg: 'We couldn’t send the link just now — please try again.' }
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
        photoDisplayUrl={photoDisplayUrl}
        variant="page"
        inviteSetup={inviteSetup}
        SendInvite={GuestInviteCell}
        TicketThumb={GuestTicketThumb}
        MoreMenu={GuestMoreMenu}
        kit={TEMPLATE_KIT}
        helperAccess={
          helper ? <GuestHelperAccess eventId={eventId} guestId={guestId} firstName={guest.first_name} helper={helper} /> : null
        }
        returnTo={`/dashboard/${eventId}/guests/${guestId}`}
        errorMessage={errorMessage}
        inviteFlash={inviteFlash}
      />

      {/* The undo snackbar the card's autosave pushes to. The roster mounts its
          own; without one here an undo on this route would restore the row and
          show the host nothing — the failure mode the undo exists to prevent. */}
      <UndoToastHost />
    </div>
  );
}
