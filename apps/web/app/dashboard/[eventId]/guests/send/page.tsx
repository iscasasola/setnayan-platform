import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { isUuid } from '@/lib/is-uuid';
import { fetchEventViewer, isDelegateWithoutArea } from '@/lib/event-viewer.server';
import { fetchGuestsByEventMeasured, guestDisplayName, guestFullName } from '@/lib/guests';
import { NotSharedWithYou } from '../../_components/not-shared-with-you';
import { fetchInvitationBase } from '../_components/guest-card-data';
import { loadInviteSetup } from '../_components/invite-message-setup';
import type { SendInviteGuest } from '../_components/send-invite';
import { SendRun } from './_components/send-run';

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

  const [{ rows, measured }, setup] = await Promise.all([
    // The ACCEPTED, living list — requests wait for Keep/Link, and nothing is
    // ever sent to a guest marked Passed away.
    fetchGuestsByEventMeasured(supabase, eventId),
    loadInviteSetup(supabase, eventId),
  ]);
  const invitationBase = await fetchInvitationBase(eventId, setup.slug);

  // The couple do not invite themselves.
  // "Invite selected" (owner 2026-09-30, the Fable rows): the ticked guests
  // only, one share sheet each, in the order they were ticked.
  const order = new Map(picked.map((id, i) => [id, i] as const));
  const guests: SendInviteGuest[] = rows
    .filter((g) => g.role !== 'bride' && g.role !== 'groom')
    .filter((g) => picked.length === 0 || order.has(g.guest_id))
    .sort((a, b) => (order.get(a.guest_id) ?? 0) - (order.get(b.guest_id) ?? 0))
    .map((g) => ({
      guestId: g.guest_id,
      formalName: guestFullName(g, setup.facts.nameStyle),
      firstName: g.first_name,
      fullName: guestDisplayName(g),
      inviteUrl: invitationBase && g.qr_token ? `${invitationBase}?invite=${g.qr_token}` : null,
      sentAt: g.invitation_sent_at,
    }));

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-24 pt-4 sm:px-6">
      <Link
        href={`/dashboard/${eventId}/guests`}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Guest list
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Send invites one by one</h1>
      <p className="mt-1 text-sm text-ink/60">
        Each guest gets their own link and QR, sent from your phone. We send nothing for you.
      </p>
      {!invitationBase ? (
        <p role="status" className="mt-6 rounded-xl bg-ink/[0.04] p-4 text-sm text-ink/70">
          Your Event Hub has no address yet, so there are no personal links to send. Set one in{' '}
          <Link href={`/dashboard/${eventId}/invitation`} className="font-medium text-ink underline underline-offset-4">
            Invitation
          </Link>
          , then come back.
        </p>
      ) : (
        <SendRun eventId={eventId} guests={guests} measured={measured} facts={setup.facts} template={setup.template} />
      )}
    </div>
  );
}
