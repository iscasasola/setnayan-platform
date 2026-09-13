import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { DoorNotice, DoorShell } from '@/app/_components/door/door-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';
import { joinDoorMeta } from '@/lib/join-door-meta';
import { ROLE_LABELS, type GuestRole } from '@/lib/guests';
import { arrivalSteps, INVITE_LINK_SENT_COOKIE } from '@/lib/invite-arrival';
import { arrivalDestinationFor, arrivalDestinationWords } from '@/lib/invite-destination';
import { resolveProfile } from '@/lib/event-type-profile';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { renderInvitationQrSvg, buildInvitationUrl } from '@/lib/qr';
import { resolveMonogram } from '@/lib/monogram';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';
import { eventWordsFor } from '../../_lib/event-words';
import { InviteQrPanel } from '../_components/invite-qr-panel';
import { INVITE_LOOK_COLUMNS, loadInviteLook } from '../_lib/load-invite-look';

export const metadata = { title: "You're in", robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ rsvp?: string }>;
};

/**
 * DOOR 03 · ENTER — the invite arrival's last door (lib/invite-arrival.ts), and
 * the hand-off into the Event Hub: the couple's site at `/{slug}` IS the Event
 * Hub (EVENT_HUB_CONTROLLER_DESIGN_2026-09-02 §1 — "the Event Hub as a place:
 * app/[slug]"). So the one action here opens it.
 *
 * 🔑 NOT A NEW DESIGN. `/join/[eventId]/success` already said this to a guest
 * who joined WITH an account — "You're in", "You joined as", the not-on-the-list
 * notice, "Open your invitation". This door says the same words to the guest
 * who arrived by the invite link, in the same order, so the two endings can
 * never tell a guest different things.
 */
export default async function InviteEnterPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;

  const admin = createAdminClient();
  const { data: event, error: eventError } = await admin
    .from('events')
    .select(
      `event_id, public_id, slug, display_name, event_date, event_date_precision, venue_name, ${INVITE_LOOK_COLUMNS}, event_end_date, venue_latitude, venue_longitude`,
    )
    .ilike('slug', slug)
    .maybeSingle();
  if (eventError) {
    throw new Error(`invite/enter: could not read the event for "${slug}": ${eventError.message}`);
  }
  if (!event?.slug) notFound();
  const home = event.slug as string;

  const session = await readGuestSession();
  if (!session || session.event_id !== event.event_id) redirect(`/${home}/invite`);

  const { data: guest, error: guestError } = await admin
    .from('guests')
    .select('guest_id, role, email, entry_source, qr_token, first_name, last_name, display_name')
    .eq('guest_id', session.guest_id)
    .eq('event_id', event.event_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (guestError) {
    throw new Error(`invite/enter: could not read guest ${session.guest_id}: ${guestError.message}`);
  }
  if (!guest) redirect(`/${home}/invite`);

  // Only ever said when a link actually went — see INVITE_LINK_SENT_COOKIE.
  const cookieStore = await cookies();
  const email = (guest.email as string | null)?.trim() || null;
  const linkSent = cookieStore.get(INVITE_LINK_SENT_COOKIE)?.value === event.event_id && Boolean(email);

  // What happened to the reply they just saved — the same four sentences the
  // Event Hub's card renders, so the arrival and the site never disagree.
  const saved =
    search.rsvp === 'ok'
      ? { kind: 'note' as const, text: 'Your reply is in — thank you.' }
      : search.rsvp === 'details'
        ? {
            kind: 'note' as const,
            text: 'Your details are saved. The guest list is final, so your reply itself can no longer change.',
          }
        : search.rsvp === 'refused'
          ? {
              kind: 'alert' as const,
              text: 'Your details are saved, but your reply was not changed — the guest list is already final. Please tell the host directly.',
            }
          : null;

  const look = await loadInviteLook(event);

  /* ── WHAT THIS DOOR IS ABOUT TO OPEN ────────────────────────────────────────
     The link below is `/{slug}` and it is RIGHT: the couple's site IS the Event
     Hub. What was wrong was the sentence over it. The Hub wears a face chosen by
     how far off the day is, and far out that face is the SAVE THE DATE — where
     `qr_card` is out of phase — so "your QR … waiting on it" was a promise the
     next screen did not keep. Owner, 2026-09-11: *"it went back to save the
     date"*.

     🔒 ASKED, NEVER RESTATED. `arrivalDestinationFor` runs the SAME composition
     app/[slug]/page.tsx runs to pick its own face — `getLifecyclePhase` on the
     venue's clock, then `solemnAdjustedPhase` — so the door cannot drift from
     the page. No threshold is named here or in that module. */
  const destination = arrivalDestinationFor({
    profile: await resolveProfile(event.event_type as string),
    eventDate: event.event_date as string | null,
    eventEndDate: (event.event_end_date as string | null) ?? null,
    venueTz: eventTimezoneFromCoords(
      event.venue_latitude as number | null,
      event.venue_longitude as number | null,
    ),
  });
  const destinationWords = arrivalDestinationWords(destination);
  const role = ((guest.role as GuestRole | null) ?? 'guest') as GuestRole;
  const unlisted = guest.entry_source === 'self_added_unlisted';

  /* ── THE HAND-OVER ITSELF ────────────────────────────────────────────────
     Owner, 2026-09-13: *"they get to see the QR Code so they can directly go
     to the event hub with their custom QR. just to save the qr and of course
     they have a button to proceed and see the event hub"*. The door used to
     only SAY the QR was waiting on the next screen — and in the save-the-date
     phase `qr_card` is out of phase, so on the commonest arrival it was not
     waiting anywhere. Now the door hands it over itself, in every phase.

     🔒 THE GUEST ID COMES FROM THE SIGNED COOKIE AND NOWHERE ELSE. `session`
     is `readGuestSession()`, already matched to THIS event above; the row was
     read by `guest_id` + `event_id` from that session. Nothing here is taken
     from the URL, and the panel below receives a rendered image and a url —
     never an id it could be asked to look something up with.

     🔑 SAME RENDERER, SAME URL AS THE EVENT HUB'S OWN CARD. `_lib/loaders.ts`
     builds the Hub's invitation QR exactly this way, so the code a guest saves
     here and the code they see there are the same code. The monogram is
     resolved from the columns `INVITE_LOOK_COLUMNS` already reads for the
     door's skin — no extra column, and no second place that knows how to
     spell the invitation url (`buildInvitationUrl` is the only one). */
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const ownerSlug = await resolveEventOwnerSlug(admin, event.event_id as string);
  const qrParams = {
    appUrl,
    // The DB-canonical slug, not the raw route param (matched case-insensitively).
    slug: home,
    qrToken: guest.qr_token as string,
    ownerSlug,
  };
  const qrSvg = await renderInvitationQrSvg({ ...qrParams, monogram: resolveMonogram(event) });
  const invitationUrl = buildInvitationUrl(qrParams);
  const words = await eventWordsFor(event.event_type as string);
  const guestName =
    (guest.display_name as string | null)?.trim() ||
    `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() ||
    'you';

  return (
    <DoorShell
      eyebrow="You're in"
      title={(event.display_name as string | null) || 'Your invitation'}
      meta={joinDoorMeta({
        event_date: event.event_date as string | null,
        event_date_precision: event.event_date_precision as string | null,
        venue_name: event.venue_name as string | null,
      })}
      steps={arrivalSteps('enter')}
      skin={look.skin}
    >
      {saved ? <DoorNotice kind={saved.kind}>{saved.text}</DoorNotice> : null}

      <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-5">
        <p className="text-sm text-ink/70">You joined as</p>
        <p className="mt-1 text-lg font-medium text-ink">{ROLE_LABELS[role] ?? ROLE_LABELS.guest}</p>
        {/* ink/70, not the success door's ink/45: a mono line this small at /45
            measures ~3.4:1 on the card, under AA. */}
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.15em] text-ink/70">
          Event {event.public_id as string}
        </p>
      </div>

      {unlisted ? (
        <DoorNotice>
          You weren&rsquo;t on the original list, so we&rsquo;ve added you and let the hosts
          know — they&rsquo;ll confirm you shortly.
        </DoorNotice>
      ) : null}

      {linkSent ? (
        <DoorNotice>
          Your sign-in link is on its way — sent to{' '}
          <span className="font-medium text-ink">{email}</span>. You&rsquo;re already on the
          guest list; it just lets you open this event on any device, no password needed.
        </DoorNotice>
      ) : null}

      {/* 🔒 KEPT, NOT RESTATED. The button below still points at `/${home}` and
          still takes its words from `arrivalDestinationFor` — the QR panel is
          an ADDITION above it, never a replacement for the hand-off. */}
      <InviteQrPanel
        qrSvg={qrSvg}
        invitationUrl={invitationUrl}
        guestName={guestName}
        eventWord={words.eventWord}
      />

      <p className="text-sm text-ink/70">{destinationWords.blurb}</p>
      <Link className="button-primary w-full" href={`/${home}`}>
        {destinationWords.cta}
      </Link>
    </DoorShell>
  );
}
