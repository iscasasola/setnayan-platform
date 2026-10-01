import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Clock, Send } from 'lucide-react';
import { DoorShell } from '@/app/_components/door/door-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildInvitationUrl } from '@/lib/qr';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';
import { joinDoorMeta } from '@/lib/join-door-meta';
import { PASS_CARD_WORDS, passCardFileName } from '@/lib/pass-card';
import { REQUEST_WORDS } from '@/lib/request-key';
import { eventWordsForEvent } from '../_lib/event-words';
import { readRememberedRequest } from '@/lib/request-key.server';
import { REQUEST_TICKET_ROUTE } from '@/lib/request-ticket';
import { CopyMyLink } from '../_components/copy-my-link';
import { TicketRow } from '../_components/ticket-row';
import { INVITE_LOOK_COLUMNS, INVITE_MARK_COLUMNS, loadInviteLook } from '../invite/_lib/load-invite-look';

export const metadata = { title: 'Your request', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sent?: string }>;
};

/**
 * THE REQUESTER'S OWN SCREEN — what their key opens while the couple decides
 * (owner 2026-09-29, DECISION_LOG "A REQUESTER GETS THEIR QR AT ONCE; IT UNLOCKS
 * ONLY WHEN THE COUPLE ACCEPTS" and "IT IS THEIR DIGITAL TICKET, IN A 'REQUEST
 * PENDING' STATE"). Frames B · C · E of the approved prototype
 * `Setnayan/prototypes/guest_ticket_flow_2026-09-29.html`, copy verbatim
 * (`REQUEST_WORDS`, lib/request-key.ts).
 *
 *   B · `?sent=1`, pending — "Sent to the couple": their Digital ticket marked
 *       "Request pending" (Save), their link ("Copy my link") and why to keep it;
 *   C · pending, reopened — "Waiting for the couple to confirm you": their name,
 *       their link, nothing private (no seat, no schedule, no announcements);
 *   E · declined — "Sorry, your request was not approved.";
 *   D · accepted / linked — not drawn here: the same key goes through the redeem
 *       hop, which opens their invitation and "You're in!".
 *
 * 🔒 WHO — only this browser's remembered request for THIS event
 * (`readRememberedRequest`), never an id or token in the address. Its state is
 * read live from the row on every visit.
 */
export default async function RequestPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;
  const admin = createAdminClient();
  const { data: event, error } = await admin
    .from('events')
    .select(
      `event_id, slug, display_name, event_date, event_date_precision, venue_name, ${INVITE_LOOK_COLUMNS}, ${INVITE_MARK_COLUMNS}`,
    )
    .ilike('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`request: could not read the event for "${slug}": ${error.message}`);
  if (!event?.slug) notFound();
  const home = event.slug as string;

  const key = await readRememberedRequest(event.event_id as string);
  if (!key) redirect(`/${home}`);
  // Accepted or Linked → the same key opens their invitation (frame D).
  if (key.state.kind === 'accepted' || key.state.kind === 'linked') {
    redirect(`/${home}/redeem?slug=${encodeURIComponent(home)}&token=${encodeURIComponent(key.qrToken)}`);
  }
  if (key.state.kind === 'none') redirect(`/${home}`);

  // The hosts' own name for this event; the event type's word when unnamed —
  // never "the couple" to a family at a wake (eventWordsForEvent).
  const hosts = ((event.display_name as string | null) ?? '').trim() || (await eventWordsForEvent(event.event_id as string)).TheOrganizer;
  const look = await loadInviteLook(event);
  const meta = joinDoorMeta({
    event_date: event.event_date as string | null,
    event_date_precision: event.event_date_precision as string | null,
    venue_name: event.venue_name as string | null,
  });
  const back = (
    <p className="text-center">
      <Link href={`/${home}`} className="button-secondary inline-flex min-h-[44px] w-full flex-col items-center justify-center">
        <span>{REQUEST_WORDS.back}</span>
        {search.sent === '1' || key.state.kind === 'declined' ? null : (
          <span className="text-xs font-normal opacity-70">{REQUEST_WORDS.backSub}</span>
        )}
      </Link>
    </p>
  );

  // E · declined — one kind line, nothing private, no dead end.
  if (key.state.kind === 'declined') {
    return (
      <DoorShell eyebrow={key.name} title={REQUEST_WORDS.declined} sub={REQUEST_WORDS.declinedSub(hosts)} meta={meta} skin={look.skin}>
        <div data-request-state="declined" className="space-y-6">
          <p className="text-sm text-ink/75">{REQUEST_WORDS.declinedThanks}</p>
          {back}
        </div>
      </DoorShell>
    );
  }

  const link = buildInvitationUrl({
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app',
    slug: home,
    qrToken: key.qrToken,
    ownerSlug: await resolveEventOwnerSlug(admin, event.event_id as string),
  });

  // B · just sent — their Digital ticket, "Request pending", and their link.
  if (search.sent === '1') {
    return (
      <DoorShell
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Send aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> {hosts}
          </span>
        }
        title={REQUEST_WORDS.sentTitle}
        sub={`${REQUEST_WORDS.sentSub(hosts)} ${REQUEST_WORDS.sentUnlocks}`}
        meta={meta}
        skin={look.skin}
      >
        <div data-request-state="sent" className="space-y-6">
          <section className="space-y-2">
            <h2 className="font-serif text-xl text-ink">Your {PASS_CARD_WORDS.digitalTicket}</h2>
            <TicketRow
              href={REQUEST_TICKET_ROUTE}
              name={key.name}
              sub={passCardFileName({ guestName: key.name, eventName: hosts, eventDate: event.event_date as string | null })}
            />
          </section>
          <CopyMyLink link={link} heading={null} note={REQUEST_WORDS.saveThis} />
          {back}
        </div>
      </DoorShell>
    );
  }

  // C · reopened while pending — calm, nothing private.
  return (
    <DoorShell
      eyebrow={key.name}
      title={REQUEST_WORDS.waiting}
      sub={REQUEST_WORDS.waitingSub(hosts)}
      meta={meta}
      skin={look.skin}
    >
      <div data-request-state="waiting" className="space-y-6">
        <p className="flex items-start gap-2 text-sm text-ink/75">
          <Clock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          {REQUEST_WORDS.waitingKeep}
        </p>
        <CopyMyLink link={link} heading={null} note={null} />
        {back}
      </div>
    </DoorShell>
  );
}
