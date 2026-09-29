import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { DoorNotice, DoorShell } from '@/app/_components/door/door-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { joinDoorMeta } from '@/lib/join-door-meta';
import { inviteReplyPath } from '@/lib/invite-arrival';
import { arrivalDestinationFor, arrivalDestinationWords } from '@/lib/invite-destination';
import { resolveProfile } from '@/lib/event-type-profile';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { renderInvitationQrSvg, buildInvitationUrl } from '@/lib/qr';
import { QR_LOOK_COLUMNS_AFTER_INVITE_MARK, resolveEventQrLook, type QrLookRow } from '@/lib/qr-look.server';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';
import { guestAccountState } from '@/lib/guest-one-path';
import { readGuestSessionForEvent, readSeatHolder } from '@/lib/guest-one-path.server';
import { RSVP_TERMS_COOKIE, rsvpTermsCarried } from '@/lib/terms-agreement';
import { eventWordsFor } from '../../_lib/event-words';
import { plusOneSeatsFor } from '../../_lib/plus-one-seats.server';
import { thankYouHeadline, replySummary } from '../../_lib/thank-you-words';
import { SaveToAccount } from '../../_components/save-to-account';
import { YourGuests } from '../../_components/your-guests';
import { InviteQrPanel } from '../_components/invite-qr-panel';
import { CopyMyLink } from '../../_components/copy-my-link';
import { TicketRow } from '../../_components/ticket-row';
import { passCardEligibilityFor, plusOnePassCardIds } from '@/lib/pass-card.server';
import { PASS_CARD_ROUTE, PASS_CARD_WORDS, passCardLine } from '@/lib/pass-card';
import { REQUEST_WORDS } from '@/lib/request-key';
import { INVITE_LOOK_COLUMNS, INVITE_MARK_COLUMNS, loadInviteLook } from '../_lib/load-invite-look';

export const metadata = { title: 'Thank you', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ rsvp?: string; keep?: string; in?: string }>;
};

/**
 * THE THANK-YOU — the guest pathway's third screen (owner 2026-09-26/27):
 *
 *   "Thank you — see you on the 18th!" → "Your guests" (one "Send their
 *   invite" per plus-one) → ONE button "Save to my account" · small "Not now".
 *
 * The method behind that one button is CHOSEN BY THE DEVICE, never shown as a
 * choice (`saveMethodFor`, lib/guest-one-path.ts): Messenger / Instagram /
 * Facebook webviews → "Open in your browser" (Google blocks sign-in there, and
 * 📵 nothing is emailed to a guest — owner 2026-09-29); iPhone → Apple; Android
 * and desktop → Google. It REPLACES the "Two ways to
 * celebrate" pitch the invitation used to carry (owner 2026-09-26: *"when
 * linking to an account. make sure all details … will be filled. if they
 * filled it up, they choose a login page."*).
 *
 * Still the door that hands over the QR (owner 2026-09-13) and still opens the
 * Event Hub at `/{slug}`, on the words `arrivalDestinationFor` resolves — so it
 * cannot drift from the page it opens. Once the invitation is kept in an
 * account there is nothing to save, and that hand-off becomes the one button.
 */
export default async function InviteEnterPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;

  const admin = createAdminClient();
  const { data: event, error: eventError } = await admin
    .from('events')
    .select(
      // + the QR look's remaining columns (the invite look and the invite mark
      // already carry display_name · monogram_text · monogram_color · the two
      // SVGs · role_palette): the pass drawn below wears the event's look —
      // lib/qr-look.server.ts.
      `event_id, public_id, slug, display_name, event_date, event_date_precision, venue_name, ${INVITE_LOOK_COLUMNS}, ${INVITE_MARK_COLUMNS}, ${QR_LOOK_COLUMNS_AFTER_INVITE_MARK}, event_end_date, venue_latitude, venue_longitude, launch_mode, manual_phase`,
    )
    .ilike('slug', slug)
    .maybeSingle();
  if (eventError) {
    throw new Error(`invite/enter: could not read the event for "${slug}": ${eventError.message}`);
  }
  if (!event?.slug) notFound();
  const home = event.slug as string;

  // The guest's KEY for THIS event — their pass, or the seat their signed-in
  // account holds (`readGuestSessionForEvent` never answers for another event).
  const session = await readGuestSessionForEvent(event.event_id as string);
  if (!session || session.event_id !== event.event_id) redirect(`/${home}`);

  const { data: guest, error: guestError } = await admin
    .from('guests')
    .select('guest_id, role, entry_source, qr_token, first_name, last_name, display_name, rsvp_status, meal_preference')
    .eq('guest_id', session.guest_id)
    .eq('event_id', event.event_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (guestError) {
    throw new Error(`invite/enter: could not read guest ${session.guest_id}: ${guestError.message}`);
  }
  if (!guest) redirect(`/${home}`);

  const cookieStore = await cookies();

  // What happened to the reply they just saved — the same sentences the
  // Event Hub's card renders, so the arrival and the site never disagree.
  const saved =
    search.rsvp === 'details'
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
     🔒 ASKED, NEVER RESTATED. `arrivalDestinationFor` runs the SAME composition
     app/[slug]/page.tsx runs to pick its own face, so the door cannot drift
     from the page. No threshold is named here or in that module. */
  const destination = arrivalDestinationFor({
    profile: await resolveProfile(event.event_type as string),
    eventDate: event.event_date as string | null,
    eventEndDate: (event.event_end_date as string | null) ?? null,
    launchMode: (event.launch_mode as string | null) ?? null,
    manualPhase: (event.manual_phase as string | null) ?? null,
    venueTz: eventTimezoneFromCoords(
      event.venue_latitude as number | null,
      event.venue_longitude as number | null,
    ),
  });
  const destinationWords = arrivalDestinationWords(destination);
  const unlisted = guest.entry_source === 'self_added_unlisted';

  /* ── THE HAND-OVER ITSELF (owner 2026-09-13) ─────────────────────────────
     🔒 THE GUEST ID COMES FROM THE SESSION AND NOWHERE ELSE, already matched to
     THIS event above. The panel receives a rendered image and a url — never an
     id it could be asked to look something up with. Same renderer, same url
     as the Event Hub's own card (`buildInvitationUrl` is the only speller). */
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const ownerSlug = await resolveEventOwnerSlug(admin, event.event_id as string);
  const qrParams = {
    appUrl,
    // The DB-canonical slug, not the raw route param (matched case-insensitively).
    slug: home,
    qrToken: guest.qr_token as string,
    ownerSlug,
  };
  const qrSvg = await renderInvitationQrSvg({
    ...qrParams,
    // The event's look (lib/qr-look.ts): the Setnayan mark, or the couple's own on Pro.
    look: await resolveEventQrLook(admin, event.event_id as string, event as QrLookRow),
  });
  const invitationUrl = buildInvitationUrl(qrParams);
  const words = await eventWordsFor(event.event_type as string);
  const guestName =
    (guest.display_name as string | null)?.trim() ||
    `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() ||
    'you';

  // ── YOUR GUESTS — each named plus-one's OWN key, handed on by the bringer.
  const seats = await plusOneSeatsFor(admin, event.event_id as string, guest.guest_id as string);
  const guestsToSend = seats.map((s) => ({
    guestId: s.guest_id,
    name: s.name,
    // Only a NAMED seat has somebody to send to; a TBA seat is named first.
    inviteUrl: s.qrToken ? buildInvitationUrl({ ...qrParams, qrToken: s.qrToken }) : null,
  }));

  // ── 🎟 THE TICKETS (owner 2026-09-29, DECISION_LOG "TICKETS ON THE THANK-YOU
  // SCREEN"; prototype guest_ticket_flow_2026-09-29.html frame A): their own
  // Digital ticket and one per NAMED plus-one who has one — the same cards the
  // route draws and "Save" hands over, and only for an accepted guest who is
  // coming (`passCardEligibility`). A blank seat keeps "Add name".
  const [passCard, plusOneTicketIds] = await Promise.all([
    passCardEligibilityFor(admin, guest.guest_id as string),
    plusOnePassCardIds(admin, event.event_id as string, guest.guest_id as string),
  ]);
  const passCards =
    passCard === 'pass'
      ? {
          own: PASS_CARD_ROUTE,
          plusOnes: Object.fromEntries([...plusOneTicketIds].map((id) => [id, `${PASS_CARD_ROUTE}?guest=${id}`])),
        }
      : null;
  const namedComing = seats.filter((s) => plusOneTicketIds.has(s.guest_id)).length;
  const partyLine = namedComing > 0 ? `and ${namedComing} ${namedComing === 1 ? 'guest' : 'guests'}` : null;

  // ── THE ONE ACCOUNT BUTTON — the same decision the Event Hub's card makes.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const account = guestAccountState({
    viewerUserId: user?.id ?? null,
    viewerEmail: user?.email ?? null,
    seatHolderUserId: await readSeatHolder(event.event_id as string, guest.guest_id as string),
  });
  const userAgent = (await headers()).get('user-agent');

  const status = (guest.rsvp_status as string | null) ?? 'pending';
  const headline = thankYouHeadline({
    status,
    firstName: (guest.display_name as string | null)?.trim() || (guest.first_name as string | null),
    eventDate: event.event_date as string | null,
    solemn: words.solemn,
  });
  const summary = replySummary({
    status,
    seats: 1 + guestsToSend.length,
    meal: guest.meal_preference as string | null,
    solemn: words.solemn,
  });
  const nothingToSave = account.kind === 'linked' || account.kind === 'held_elsewhere';

  /* 🔓 "YOU'RE IN!" (frame D) — a requester whose request the couple accepted
     arrives here from the redeem hop (`?in=1`) with the SAME key they were given
     on Send. A saved picture cannot change, so the button says to save the
     updated ticket (owner 2026-09-29, "THE REQUEST IMAGE" + its correction). */
  const justIn = search.in === '1' && passCard === 'pass';
  const hosts = ((event.display_name as string | null) ?? '').trim() || words.TheOrganizer;
  const eyebrow = justIn ? REQUEST_WORDS.inTitle : 'Thank you';
  const title = justIn ? headline.replace(/!$/, '') : headline;
  const sub = justIn ? REQUEST_WORDS.inSub(hosts, null) : summary;

  return (
    <DoorShell
      eyebrow={eyebrow}
      title={title}
      sub={sub}
      meta={joinDoorMeta({
        event_date: event.event_date as string | null,
        event_date_precision: event.event_date_precision as string | null,
        venue_name: event.venue_name as string | null,
      })}
      skin={look.skin}
    >
      {saved ? <DoorNotice kind={saved.kind}>{saved.text}</DoorNotice> : null}

      {unlisted && !justIn ? (
        <DoorNotice>
          You weren&rsquo;t on the original list, so we&rsquo;ve let the hosts know — they&rsquo;ll
          confirm you shortly.
        </DoorNotice>
      ) : null}

      {/* 🎟 YOUR DIGITAL TICKET — first, the thing to keep (frame A). A guest
          without one (can't come) is told why in one line; a seat with no
          card at all keeps the plain QR panel, as before. */}
      {passCards ? (
        <section aria-labelledby="your-ticket" className="space-y-2" data-thank-you-ticket="">
          <h2 id="your-ticket" className="font-serif text-xl text-ink">
            Your {PASS_CARD_WORDS.digitalTicket}
          </h2>
          <p className="text-xs text-ink/60">
            Save it to your phone — show it at the door. It’s a picture, so it can’t change by itself; the page
            here always has the latest table and time.
          </p>
          <TicketRow
            href={PASS_CARD_ROUTE}
            name={guestName}
            sub={partyLine}
            saveLabel={justIn ? REQUEST_WORDS.saveUpdated : undefined}
            saveNote={justIn ? REQUEST_WORDS.saveUpdatedWhy : null}
          />
        </section>
      ) : passCard === 'cannotCome' ? (
        <p className="text-sm text-ink/70">{passCardLine(passCard)}</p>
      ) : (
        <InviteQrPanel
          qrSvg={qrSvg}
          invitationUrl={invitationUrl}
          guestName={guestName}
          eventWord={words.eventWord}
        />
      )}

      <YourGuests
        guests={guestsToSend}
        eventName={(event.display_name as string | null) ?? words.eventWord}
        addNamesHref={`${inviteReplyPath(home)}#plus-ones`}
        inviteFacts={{
          hostsName: (event.display_name as string | null) ?? null,
          eventWord: words.eventWord,
          solemn: words.solemn,
          eventDate: (event.event_date as string | null) ?? null,
          datePrecision: (event.event_date_precision as string | null) ?? null,
        }}
        passCards={passCards}
        ticketRows={{ ownName: guestName }}
      />

      {/* "Copy my link" — their own link is their way back and their ticket at
          the door too (📵 nothing is emailed — owner 2026-09-29). */}
      <CopyMyLink link={invitationUrl} />

      {nothingToSave ? (
        <>
          <SaveToAccount
            state={account}
            eventId={event.event_id as string}
            slug={home}
            personalLink={invitationUrl}
            userAgent={userAgent}
            termsCarried={rsvpTermsCarried(cookieStore.get(RSVP_TERMS_COOKIE)?.value)}
          />
          <p className="text-sm text-ink/70">{destinationWords.blurb}</p>
          <Link className="button-primary w-full" href={`/${home}`}>
            {destinationWords.cta}
          </Link>
        </>
      ) : (
        <>
          <SaveToAccount
            state={account}
            eventId={event.event_id as string}
            slug={home}
            personalLink={invitationUrl}
            userAgent={userAgent}
            termsCarried={rsvpTermsCarried(cookieStore.get(RSVP_TERMS_COOKIE)?.value)}
            termsMissing={search.keep === 'terms'}
            carries="your name, mobile, meal and your guests come along"
          />
          <p className="text-center">
            <Link
              className="inline-flex min-h-[44px] items-center text-sm text-ink/70 underline-offset-4 hover:underline"
              href={`/${home}`}
            >
              Not now
            </Link>
          </p>
        </>
      )}
    </DoorShell>
  );
}
