import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { DoorNotice, DoorShell } from '@/app/_components/door/door-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { joinDoorMeta } from '@/lib/join-door-meta';
import { INVITE_LINK_SENT_COOKIE, inviteReplyPath } from '@/lib/invite-arrival';
import { arrivalDestinationFor, arrivalDestinationWords } from '@/lib/invite-destination';
import { resolveProfile } from '@/lib/event-type-profile';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { renderInvitationQrSvg, buildInvitationUrl } from '@/lib/qr';
import { QR_LOOK_COLUMNS_AFTER_INVITE_MARK, resolveEventQrLook, type QrLookRow } from '@/lib/qr-look.server';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';
import { guestAccountState } from '@/lib/guest-one-path';
import { keepLinkSentFor, readGuestSessionForEvent, readSeatHolder } from '@/lib/guest-one-path.server';
import { RSVP_TERMS_COOKIE, rsvpTermsCarried } from '@/lib/terms-agreement';
import { eventWordsFor } from '../../_lib/event-words';
import { plusOneSeatsFor } from '../../_lib/plus-one-seats.server';
import { thankYouHeadline, thankYouWords, replySummary } from '../../_lib/thank-you-words';
import { SaveToAccount } from '../../_components/save-to-account';
import { YourGuests } from '../../_components/your-guests';
import { InviteQrPanel } from '../_components/invite-qr-panel';
import { INVITE_LOOK_COLUMNS, INVITE_MARK_COLUMNS, loadInviteLook } from '../_lib/load-invite-look';
import { readRsvpWords, rsvpAnswerWord } from '@/lib/rsvp-ask';
import { rsvpWordBridgeKey } from '@/lib/rsvp-stage-shared';
import { RsvpCanvasBridge } from '../../_components/rsvp-canvas-bridge';
import { asksForHostCanvas } from '../../_lib/editor-canvas';
import { loadHostMembership, loadHostPreviewDraft } from '../../_lib/loaders';
import { loadPreviewPerson } from '../../_lib/preview-person.server';
import { getCurrentUser } from '@/lib/auth';
import { overlayHubDraftEvent } from '@/lib/hub-draft';
import { SIMULATED_GUEST_INVITATION_TEXT, SIMULATED_GUEST_QR_SVG, rsvpCanvasGuestFor } from '@/lib/simulated-guest-preview';

export const metadata = { title: 'Thank you', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ rsvp?: string; keep?: string; editor?: string; preview?: string; as?: string }>;
};

/**
 * THE THANK-YOU — the guest pathway's third screen (owner 2026-09-26/27):
 *
 *   "Thank you — see you on the 18th!" → "Your guests" (one "Send their
 *   invite" per plus-one) → ONE button "Save to my account" · small "Not now".
 *
 * The method behind that one button is CHOSEN BY THE DEVICE, never shown as a
 * choice (`saveMethodFor`, lib/guest-one-path.ts): Messenger / Instagram /
 * Facebook webviews → the emailed link (Google blocks sign-in there); iPhone
 * → Apple; Android and desktop → Google. It REPLACES the "Two ways to
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
  const { data: liveEvent, error: eventError } = await admin
    .from('events')
    .select(
      // + the QR look's remaining columns (the invite look and the invite mark
      // already carry display_name · monogram_text · monogram_color · the two
      // SVGs · role_palette): the pass drawn below wears the event's look —
      // lib/qr-look.server.ts.
      `event_id, public_id, slug, display_name, event_date, event_date_precision, venue_name, rsvp_ask_config, ${INVITE_LOOK_COLUMNS}, ${INVITE_MARK_COLUMNS}, ${QR_LOOK_COLUMNS_AFTER_INVITE_MARK}, event_end_date, venue_latitude, venue_longitude, launch_mode, manual_phase`,
    )
    .ilike('slug', slug)
    .maybeSingle();
  if (eventError) {
    throw new Error(`invite/enter: could not read the event for "${slug}": ${eventError.message}`);
  }
  if (!liveEvent?.slug) notFound();

  /* 🗳 THE MAKER'S RSVP STAGE (owner 2026-09-30, "After they submit" · "When
     they decline"): `?editor=1` from a VERIFIED host of this event — the same
     door every Maker canvas uses, never the param alone — draws this screen
     for a SAMPLE guest (`?as=attending|declined`), wearing the couple's DRAFT so
     their words show before Apply. No guest row is read, nothing is written,
     and the page's buttons do nothing there (`RsvpCanvasBridge`). */
  let canvas = false;
  let hostDraft: Awaited<ReturnType<typeof loadHostPreviewDraft>> = null;
  if (asksForHostCanvas(search)) {
    const viewer = await getCurrentUser();
    if (viewer && (await loadHostMembership(admin, liveEvent.event_id as string, viewer.id))) {
      canvas = true;
      hostDraft = await loadHostPreviewDraft(admin, liveEvent.event_id as string, viewer.id);
    }
  }
  const event = overlayHubDraftEvent(liveEvent as Record<string, unknown>, hostDraft) as typeof liveEvent;
  const home = event.slug as string;

  // The guest's KEY for THIS event — their pass, or the seat their signed-in
  // account holds (`readGuestSessionForEvent` never answers for another event).
  const session = canvas ? null : await readGuestSessionForEvent(event.event_id as string);
  if (!canvas && (!session || session.event_id !== event.event_id)) redirect(`/${home}`);

  const { data: guest, error: guestError } = canvas
    ? {
        data: {
          ...rsvpCanvasGuestFor(await loadPreviewPerson(admin, event.event_id as string)),
          role: 'guest',
          email: null as string | null,
          entry_source: 'guest_list',
          qr_token: null as string | null,
          rsvp_status: search.as === 'declined' ? 'declined' : 'attending',
          meal_preference: null as string | null,
        },
        error: null,
      }
    : await admin
    .from('guests')
    .select('guest_id, role, email, entry_source, qr_token, first_name, last_name, display_name, rsvp_status, meal_preference')
    .eq('guest_id', session!.guest_id)
    .eq('event_id', event.event_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (guestError) {
    throw new Error(`invite/enter: could not read guest ${session?.guest_id}: ${guestError.message}`);
  }
  if (!guest) redirect(`/${home}`);

  const cookieStore = await cookies();
  const email = (guest.email as string | null)?.trim() || null;
  const linkSent =
    search.keep === 'sent' ||
    (cookieStore.get(INVITE_LINK_SENT_COOKIE)?.value === event.event_id && Boolean(email));

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
  // The sample on the Maker's canvas has no key of its own — its QR says SAMPLE.
  const qrSvg = canvas
    ? SIMULATED_GUEST_QR_SVG
    : await renderInvitationQrSvg({
        ...qrParams,
        // The event's look (lib/qr-look.ts): the Setnayan mark, or the couple's own on Pro.
        look: await resolveEventQrLook(admin, event.event_id as string, event as QrLookRow),
      });
  const invitationUrl = canvas ? SIMULATED_GUEST_INVITATION_TEXT : buildInvitationUrl(qrParams);
  const words = await eventWordsFor(event.event_type as string);
  const guestName =
    (guest.display_name as string | null)?.trim() ||
    `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() ||
    'you';

  // ── YOUR GUESTS — each named plus-one's OWN key, handed on by the bringer.
  const seats = canvas ? [] : await plusOneSeatsFor(admin, event.event_id as string, guest.guest_id as string);
  const guestsToSend = seats.map((s) => ({
    guestId: s.guest_id,
    name: s.name,
    // Only a NAMED seat has somebody to send to; a TBA seat is named first.
    inviteUrl: s.qrToken ? buildInvitationUrl({ ...qrParams, qrToken: s.qrToken }) : null,
  }));

  // ── THE ONE ACCOUNT BUTTON — the same decision the Event Hub's card makes.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const account = guestAccountState({
    viewerUserId: user?.id ?? null,
    viewerEmail: user?.email ?? null,
    seatHolderUserId: canvas ? null : await readSeatHolder(event.event_id as string, guest.guest_id as string),
    linkSentForThisEvent: linkSent || (await keepLinkSentFor(event.event_id as string)),
  });
  const userAgent = (await headers()).get('user-agent');

  const status = (guest.rsvp_status as string | null) ?? 'pending';
  /* 📝 THE COUPLE'S OWN WORDS (the RSVP stage, owner 2026-09-30): the heading and
     message of "After they submit" (attending) and "When they decline". Unset,
     the headline is today's and there is no extra message. Words only — the
     status, the tickets and the counts never read them. */
  const rsvpWords = readRsvpWords(event.rsvp_ask_config);
  const ownHeadline = thankYouHeadline({
    status,
    firstName: (guest.display_name as string | null)?.trim() || (guest.first_name as string | null),
    eventDate: event.event_date as string | null,
    solemn: words.solemn,
  });
  const firstName = ((guest.display_name as string | null)?.trim() || (guest.first_name as string | null) || '').split(/\s+/)[0] ?? '';
  const couple = thankYouWords({ status, words: rsvpWords, ownHeadline, name: firstName });
  const wordKeys = couple.keys;
  const ownMessage = couple.message;
  const headline = couple.heading;
  const summary = replySummary({
    status,
    seats: 1 + guestsToSend.length,
    meal: guest.meal_preference as string | null,
    solemn: words.solemn,
    answerWord:
      status === 'attending' || status === 'declined' ? rsvpAnswerWord(rsvpWords, status, words.solemn) : null,
  });
  const nothingToSave = account.kind === 'linked' || account.kind === 'held_elsewhere';

  return (
    <DoorShell
      eyebrow="Thank you"
      title={headline}
      sub={summary}
      meta={joinDoorMeta({
        event_date: event.event_date as string | null,
        event_date_precision: event.event_date_precision as string | null,
        venue_name: event.venue_name as string | null,
      })}
      skin={look.skin}
    >
      {saved ? <DoorNotice kind={saved.kind}>{saved.text}</DoorNotice> : null}
      {/* 📝 The couple's message under the heading — on the canvas always drawn
          (hidden while empty) so typing shows it; the heading itself is the
          door's title, reached through the proxy below. */}
      {canvas && wordKeys ? (
        <>
          <RsvpCanvasBridge inertButtons />
          <i hidden data-rsvp-word-proxy={rsvpWordBridgeKey(wordKeys.heading)} data-rsvp-target="[data-door-header] h1" data-rsvp-default={ownHeadline} data-rsvp-name={firstName} />
        </>
      ) : null}
      {ownMessage || (canvas && wordKeys) ? (
        <p
          className="text-base leading-relaxed text-ink/80"
          data-thank-you-message=""
          data-rsvp-word={canvas && wordKeys ? rsvpWordBridgeKey(wordKeys.message) : undefined}
          data-rsvp-word-optional={canvas ? '' : undefined}
          data-rsvp-name={canvas ? firstName : undefined}
          hidden={!ownMessage || undefined}
        >
          {ownMessage}
        </p>
      ) : null}

      {unlisted ? (
        <DoorNotice>
          You weren&rsquo;t on the original list, so we&rsquo;ve let the hosts know — they&rsquo;ll
          confirm you shortly.
        </DoorNotice>
      ) : null}

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
      />

      {nothingToSave ? (
        <>
          <SaveToAccount
            state={account}
            eventId={event.event_id as string}
            slug={home}
            hasEmail={Boolean(email)}
            userAgent={userAgent}
            termsCarried={rsvpTermsCarried(cookieStore.get(RSVP_TERMS_COOKIE)?.value)}
            failed={search.keep === 'error'}
            askEmail={search.keep === 'email'}
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
            hasEmail={Boolean(email)}
            userAgent={userAgent}
            termsCarried={rsvpTermsCarried(cookieStore.get(RSVP_TERMS_COOKIE)?.value)}
            failed={search.keep === 'error'}
            askEmail={search.keep === 'email'}
            sentTo={linkSent ? email : null}
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

      {/* 🔒 KEPT, NOT RESTATED. The pass (owner 2026-09-13: "they get to see the
          QR Code") — below the one button, never in front of it. */}
      <InviteQrPanel
        qrSvg={qrSvg}
        invitationUrl={invitationUrl}
        guestName={guestName}
        eventWord={words.eventWord}
      />
    </DoorShell>
  );
}
