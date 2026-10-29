import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { isUuid } from '@/lib/is-uuid';
import { fetchEventViewer, isDelegateWithoutArea } from '@/lib/event-viewer.server';
import { fetchGuestsByEventMeasured, guestDisplayName, guestNameAsGiven } from '@/lib/guests';
import { NotSharedWithYou } from '../../_components/not-shared-with-you';
import { fetchInvitationBase } from '../_components/guest-card-data';
import { loadInviteSetup } from '../_components/invite-message-setup';
import { SendRun, type RunGuest, type RunOneLink } from './_components/send-run';
import { invitationLinkOn } from '@/lib/invitation-link';
import { hasReplied, sendRunGuests } from '@/lib/guest-roster-view';
import { loadRoleNames } from '@/lib/role-names.server';
import { runGuestPage } from '@/lib/send-run-page';
import { readGuestsGetIn } from '@/lib/who-can-reply';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readOneLink } from '../../_components/guest-setup/one-link.server';

export const metadata = { title: 'Send invites one by one' };

type Props = {
  params: Promise<{ eventId: string }>;
  /** `?ids=a,b,c` — the Guest list's "Invite selected": only the ticked guests, in that order. */
  searchParams?: Promise<{ ids?: string }>;
};

/**
 * SEND INVITES ONE BY ONE (owner 2026-09-29, controller brief item 4).
 *
 * "3 of 150 · Send to Maria → Next" — a simple run over the guests nobody has
 * sent to yet, on the couple's own phone. Each Send is the SAME `SendInviteActions`
 * the guest card carries (share sheet with the message + their QR, or copy),
 * each stamp the SAME writer (`invitation_sent_at` via `invitation/actions.ts`).
 * This page only decides the ORDER and keeps count; it sends nothing itself.
 *
 * 🔒 WHO SEES IT: anyone who may read the guest list. A delegate the couple did
 * not share the guest list with gets the "not shared with you" screen, never an
 * empty run that reads as "everyone has theirs" (lib/event-viewer.test.ts).
 *
 * ⚠ A REFUSED READ IS NOT "ALL DONE". `fetchGuestsByEventMeasured` says when it
 * could not read; the run then says so instead of congratulating the couple.
 */
export default async function SendInvitesPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const picked = ((await searchParams)?.ids ?? '').split(',').filter((id) => isUuid(id));
  if (!isUuid(eventId)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const viewer = await fetchEventViewer(supabase, eventId, user.id);
  if (isDelegateWithoutArea(viewer, 'guest_list')) {
    return <NotSharedWithYou title="Send invites" thing="guest list" />;
  }

  const [{ rows, measured }, setup, roleNames, oneQr] = await Promise.all([
    // The ACCEPTED, living list — requests wait for Keep/Link, and nothing is
    // ever sent to a guest marked Passed away.
    fetchGuestsByEventMeasured(supabase, eventId),
    loadInviteSetup(supabase, eventId),
    loadRoleNames(supabase, eventId, 'SendRun.roleNames'),
    // 🔗 ONE LINK FOR EVERYONE (owner 2026-10-27, "THE SEND RUN ALSO SERVES A ONE-QR EVENT"): the same run walks the
    // list, and every guest is sent the event's one link and QR. A refused read → the personal links, as before.
    supabase
      .from('events')
      .select('rsvp_ask_config')
      .eq('event_id', eventId)
      .maybeSingle()
      .then((r) => {
        if (r.error) logQueryError('SendRun (one link · rsvp_ask_config)', r.error, { event_id: eventId }, 'graceful_degrade');
        return !r.error && readGuestsGetIn((r.data as { rsvp_ask_config?: unknown } | null)?.rsvp_ask_config ?? null) === 'one_qr';
      }),
  ]);
  const [invitationBase, eventLink] = await Promise.all([
    fetchInvitationBase(eventId, setup.slug),
    oneQr ? readOneLink(supabase, eventId) : Promise.resolve(null),
  ]);
  const oneLink: RunOneLink | null = eventLink?.url ? { url: eventLink.url, qrSvg: eventLink.qrSvg } : null;
  // A sideless event stores every guest as 'both' — so it never says a side.
  const hasSides = rows.some((g) => g.side !== 'both');

  // WHO THE RUN HOLDS — `sendRunGuests`, the ONE "to invite" rule's own list
  // (lib/guest-roster-view.ts): never the couple or the celebrant, and never a
  // guest who declined (owner 2026-10-08: "declined guests don't get an
  // invitation"). Read again on every load, so a guest who declines after the
  // run was opened is gone from the next read, and one who changes back returns.
  // "Invite selected" (owner 2026-09-30, the Fable rows): the ticked guests
  // only, one share sheet each, in the order they were ticked.
  const guests: RunGuest[] = sendRunGuests(rows, picked)
    .map((g) => ({
      guestId: g.guest_id,
      formalName: guestNameAsGiven(g, setup.facts.nameStyle),
      firstName: g.first_name,
      fullName: guestDisplayName(g),
      inviteUrl: invitationBase && g.qr_token ? invitationLinkOn(invitationBase, g.qr_token) : null,
      sentAt: g.invitation_sent_at,
      // 💬 Answered already (Attending · Can't come · Maybe) → not "to invite": never queued, never counted.
      replied: hasReplied(g),
      // The guest as a page (owner: "the guest's name, role, Pluses, or basic details we need").
      page: runGuestPage(g, rows, roleNames, hasSides),
    }));

  // 📨 FULL SCREEN (owner 2026-10-27): no title, no "← Guest list" — the run IS the page; its ✕ and Done for now
  // always land on the Guest list. A one-link event needs no personal address; a personal one does.
  if (!invitationBase && !oneLink) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 pb-24 pt-4 sm:px-6">
        <p role="status" className="mt-6 rounded-xl bg-ink/[0.04] p-4 text-sm text-ink/70">
          Your Event Hub has no address yet, so there are no personal links to send. Set one in{' '}
          <Link href={`/dashboard/${eventId}/invitation`} className="font-medium text-ink underline underline-offset-4">
            Invitation
          </Link>
          , then come back.
        </p>
      </div>
    );
  }
  return (
    <SendRun
      eventId={eventId}
      guests={guests}
      measured={measured}
      facts={setup.facts}
      template={setup.template}
      oneLink={oneLink}
      picked={picked.length > 0}
    />
  );
}
