import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { DoorNotice, DoorShell } from '@/app/_components/door/door-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { inviteReplyPath } from '@/lib/invite-arrival';
import { arrivalDestinationFor, arrivalDestinationWords } from '@/lib/invite-destination';
import { resolveProfile } from '@/lib/event-type-profile';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { renderInvitationQrSvg, buildInvitationUrl } from '@/lib/qr';
import { QR_LOOK_COLUMNS_AFTER_INVITE_MARK, resolveEventQrLook, type QrLookRow } from '@/lib/qr-look.server';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';
import { guestAccountState } from '@/lib/guest-one-path';
import { isCoupleSeat, seatDisplayName } from '@/lib/seat-binding';
import { readGuestSessionForEvent, readSeatHolder } from '@/lib/guest-one-path.server';
import { RSVP_TERMS_COOKIE, rsvpTermsCarried } from '@/lib/terms-agreement';
import { eventWordsFor } from '../../_lib/event-words';
import { plusOneSeatsFor } from '../../_lib/plus-one-seats.server';
import { thankYouWords } from '../../_lib/thank-you-words';
import { SaveToAccount } from '../../_components/save-to-account';
import { YourGuests } from '../../_components/your-guests';
import { InviteQrPanel } from '../_components/invite-qr-panel';
import { CopyMyLink } from '../../_components/copy-my-link';
import { passCardEligibilityFor, plusOnePassCardIds, readTicketSeats } from '@/lib/pass-card.server';
import { PASS_CARD_ROUTE, PASS_CARD_WORDS, passCardLine } from '@/lib/pass-card';
import { REQUEST_WORDS } from '@/lib/request-key';
import { INVITE_LOOK_COLUMNS, INVITE_MARK_COLUMNS, loadInviteLook } from '../_lib/load-invite-look';
import { readRsvpWords, resolveReplyBy } from '@/lib/rsvp-ask';
import { guestListIsClosed } from '@/lib/guest-list-closed';
import { rsvpWordBridgeKey } from '@/lib/rsvp-stage-shared';
import { RsvpCanvasBridge } from '../../_components/rsvp-canvas-bridge';
import { asksForHostCanvas } from '../../_lib/editor-canvas';
import { loadHostMembership, loadHostPreviewDraft } from '../../_lib/loaders';
import { loadPreviewPerson } from '../../_lib/preview-person.server';
import { getCurrentUser } from '@/lib/auth';
import { overlayHubDraftEvent } from '@/lib/hub-draft';
import { SIMULATED_GUEST_INVITATION_TEXT, SIMULATED_GUEST_QR_SVG, rsvpCanvasGuestFor } from '@/lib/simulated-guest-preview';
import { guestFullName } from '@/lib/guests';
import { parsePrintDetails } from '@/lib/print-pieces';
import { ticketShowsTable } from '@/lib/guests-may-see-seats';
import {
  LANDING_WORDS,
  changeReplyWords,
  howToUseLines,
  inAppHandoff,
  landingDayLabel,
  landingHeadline,
  landingMessage,
  landingReplyOf,
  landingTicketOf,
  openBeforeReplyHref,
  ticketFingerprint,
} from '@/lib/guest-landing';
import { SavePassCardButton } from '@/app/_components/save-pass-card-button';
import { TicketPicture } from '../../_components/ticket-picture';
import { TicketPopup } from '../../_components/ticket-popup';
import { InAppBar } from '../../_components/in-app-bar';

export const metadata = { title: 'Your invitation', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ rsvp?: string; keep?: string; in?: string; editor?: string; preview?: string; as?: string }>;
};

/**
 * 🚪 THE GUEST'S OWN LANDING PAGE (owner 2026-09-30, DECISION_LOG "THE PERSONAL
 * LINK OPENS THE GUEST'S OWN LANDING PAGE"; prototype
 * `guest_landing_page_2026-09-30.html`). The personal link lands here
 * (`[slug]/redeem`) and the reply returns here, so this ONE page is, top to
 * bottom (`LANDING_ORDER`, lib/guest-landing.ts): the couple's message (name as
 * given) · "Reply to the invitation" (gone once replied; a small "Change my
 * reply" stays) · the Digital ticket (faded until a Yes, full with "Save my
 * ticket" after, none after a No) · Your guests · How to use it · Open the
 * invitation. A new or changed ticket pops up first (`TicketPopup`), and an
 * in-app browser gets its one-tap way out (`InAppBar`).
 *
 * What it grew from —
 *
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
  const { data: liveEvent, error: eventError } = await admin
    .from('events')
    .select(
      // + the QR look's remaining columns (the invite look and the invite mark
      // already carry display_name · monogram_text · monogram_color · the two
      // SVGs · role_palette): the pass drawn below wears the event's look —
      // lib/qr-look.server.ts.
      `event_id, public_id, slug, display_name, event_date, event_date_precision, venue_name, rsvp_ask_config, print_details, guest_list_edit_deadline, guest_count_locked_at, ${INVITE_LOOK_COLUMNS}, ${INVITE_MARK_COLUMNS}, ${QR_LOOK_COLUMNS_AFTER_INVITE_MARK}, event_end_date, venue_latitude, venue_longitude, launch_mode, manual_phase`,
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
          entry_source: 'host_seeded', // a real guest_entry_source label (the sample is on the list)
          qr_token: null as string | null,
          rsvp_status: search.as === 'declined' ? 'declined' : 'attending',
          meal_preference: null as string | null,
        },
        error: null,
      }
    : await admin
    .from('guests')
    .select('guest_id, role, entry_source, qr_token, name_prefix, first_name, middle_name, last_name, name_suffix, display_name, rsvp_status, meal_preference, plus_one_of_guest_id')
    .eq('guest_id', session!.guest_id)
    .eq('event_id', event.event_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (guestError) {
    throw new Error(`invite/enter: could not read guest ${session?.guest_id}: ${guestError.message}`);
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

  // ── THE ONE ACCOUNT BUTTON — the same decision the Event Hub's card makes.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const account = guestAccountState({
    viewerUserId: user?.id ?? null,
    viewerEmail: user?.email ?? null,
    seatHolderUserId: canvas ? null : await readSeatHolder(event.event_id as string, guest.guest_id as string),
    seatName: seatDisplayName({
      display_name: guest.display_name as string | null,
      first_name: guest.first_name as string | null,
      last_name: guest.last_name as string | null,
    }),
    seatIsCouple: isCoupleSeat(guest.role as string | null),
  });
  const userAgent = (await headers()).get('user-agent');

  const status = (guest.rsvp_status as string | null) ?? 'pending';
  /* 📝 THE COUPLE'S OWN WORDS (the RSVP stage, owner 2026-09-30): the heading and
     message of "After they submit" (attending) and "When they decline". Unset,
     the headline is today's and there is no extra message. Words only — the
     status, the tickets and the counts never read them. */
  const rsvpWords = readRsvpWords(event.rsvp_ask_config);
  // The Fable defaults (frames 3 · 4): "You replied — see you there" · "We'll miss you."
  const ownHeadline = landingHeadline(status, words.solemn);
  const firstName = ((guest.display_name as string | null)?.trim() || (guest.first_name as string | null) || '').split(/\s+/)[0] ?? '';
  const theirWords = thankYouWords({ status, words: rsvpWords, ownHeadline, name: firstName });
  const wordKeys = theirWords.keys;
  const ownMessage = theirWords.message;
  const headline = theirWords.heading;
  const nothingToSave = account.kind === 'linked' || account.kind === 'held_elsewhere';

  /* 🔓 "YOU'RE IN!" (frame D) — a requester whose request the couple accepted
     arrives here from the redeem hop (`?in=1`) with the SAME key they were given
     on Send. A saved picture cannot change, so the button says to save the
     updated ticket (owner 2026-09-29, "THE REQUEST IMAGE" + its correction). */
  const justIn = search.in === '1' && passCard === 'pass';
  const hosts = ((event.display_name as string | null) ?? '').trim() || words.TheOrganizer;

  /* ── 🚪 THE GUEST'S OWN LANDING PAGE (owner 2026-09-30, DECISION_LOG "THE
     PERSONAL LINK OPENS THE GUEST'S OWN LANDING PAGE"; prototype
     guest_landing_page_2026-09-30.html). Their personal link lands HERE
     (`[slug]/redeem`), and the reply returns here (`submitInviteReply`), so one
     page carries, in `LANDING_ORDER`: the couple's message · "Reply to the
     invitation" (gone once replied) · the Digital ticket (faded before a Yes,
     full after, none after a No) · Your guests · How to use it · Open the
     invitation. Every rule is lib/guest-landing.ts, executed by its test. */
  const reply = landingReplyOf(status);
  const ticket = landingTicketOf({ reply, eligibility: passCard, isPlusOne: Boolean(guest.plus_one_of_guest_id) });
  const seatDay = ticketShowsTable({
    eventDate: event.event_date as string | null,
    eventDatePrecision: event.event_date_precision as string | null,
  });
  // 🎟 On the day the ticket carries the seat — the same read the ticket route draws from.
  const ownSeat = canvas || !seatDay ? null : ((await readTicketSeats(admin, event.event_id as string)).get(guest.guest_id as string) ?? null);
  const message = landingMessage({
    template: parsePrintDetails((event as { print_details?: unknown }).print_details).inviteMessage,
    formalName: guestFullName({
      display_name: guest.display_name as string | null,
      name_prefix: (guest as { name_prefix?: string | null }).name_prefix ?? null,
      first_name: guest.first_name as string | null,
      middle_name: (guest as { middle_name?: string | null }).middle_name ?? null,
      last_name: guest.last_name as string | null,
      name_suffix: (guest as { name_suffix?: string | null }).name_suffix ?? null,
    }),
    hostsName: (event.display_name as string | null) ?? null,
    eventWord: words.eventWord,
    solemn: words.solemn,
    eventDate: (event.event_date as string | null) ?? null,
    datePrecision: (event.event_date_precision as string | null) ?? null,
    reply,
  });
  const howTo = howToUseLines({
    seatDay,
    dateLabel: landingDayLabel(event.event_date as string | null, event.event_date_precision as string | null),
    table: ownSeat?.seat ?? null,
  });
  const fingerprint = ticketFingerprint({
    qrToken: guest.qr_token as string | null,
    eligibility: passCard,
    party: namedComing,
    seat: ownSeat?.seat ?? null,
    seatNumber: ownSeat?.seatNumber ?? null,
  });
  const inApp = canvas ? ({ kind: 'none' } as const) : inAppHandoff(userAgent, invitationUrl);
  const safariSave = inApp.kind === 'ios' ? inApp.safariHref : null;
  const changeWords = canvas ? null : changeReplyWords(reply);
  const ticketLabel = `${guestName}’s ${PASS_CARD_WORDS.digitalTicket}`;
  const ticketFallback = (
    <p role="alert" className="text-xs text-ink/70">
      We couldn’t draw your {PASS_CARD_WORDS.noun} just now — your link below still works at the door.
    </p>
  );

  const unreplied = reply === 'unreplied' && !canvas;
  // "Please reply by …" (frame 1) — the SAME date the reply page and the Maker's
  // RSVP page show (`resolveReplyBy`), never once the list is final.
  const replyBy =
    unreplied &&
    !guestListIsClosed({
      lockedAt: (event as { guest_count_locked_at?: string | null }).guest_count_locked_at ?? null,
    })
      ? resolveReplyBy({
          deadline: (event as { guest_list_edit_deadline?: string | null }).guest_list_edit_deadline ?? null,
          eventDate: event.event_date as string | null,
        })
      : null;
  const replyByLabel = replyBy ? landingDayLabel(replyBy.date, 'day', { year: true }) : null;
  // The "brand" line of every Fable frame is the couple — DoorShell's title, the
  // line each theme skin styles as the names. On the day: "· Today" (frame 6).
  const title = seatDay ? (
    <>
      {hosts} <span className="text-mulberry">· Today</span>
    </>
  ) : (
    hosts
  );
  const soft = 'inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-white/80 px-4 text-sm font-medium text-ink/80 shadow-sm ring-1 ring-ink/10'; // no-card-ok: a pressable pill

  return (
    <>
      {/* 1b · INSIDE MESSENGER — a thin bar of ours at the very top, never over the page. */}
      <InAppBar handoff={inApp} />
      <DoorShell eyebrow={justIn ? REQUEST_WORDS.inTitle : undefined} title={title} sub={justIn ? REQUEST_WORDS.inSub(hosts, null) : undefined} skin={look.skin}>
        {/* 🎟 5 · A NEW OR CHANGED TICKET POPS UP FIRST, WITH SAVE — once per version. */}
        {ticket === 'full' && !canvas ? (
          <TicketPopup
            guestId={guest.guest_id as string}
            fingerprint={fingerprint}
            fresh={justIn}
            src={PASS_CARD_ROUTE}
            name={guestName}
            safariHref={safariSave}
          />
        ) : null}
        {saved ? <DoorNotice kind={saved.kind}>{saved.text}</DoorNotice> : null}
        {canvas && wordKeys ? (
          <RsvpCanvasBridge inertButtons />
        ) : null}

        {/* 1 · THE COUPLE'S MESSAGE — name as given (frame 1). After a Yes, the
            "✓ You replied" pill carries the couple's "After they submit" words
            (frame 3); after a No, the card carries "When they decline" (frame 4). */}
        <div data-landing="message" className="space-y-3">
          {unreplied ? (
            <div className="sn-glass-bare rounded-2xl bg-white/95 px-[18px] py-4 text-[15px] leading-relaxed text-ink shadow-sm" data-landing-message="">
              <p>{message}</p>
              <p className="mt-2.5 font-serif text-base italic text-mulberry">— {hosts}</p>
            </div>
          ) : reply === 'no' ? (
            <div className="sn-glass-bare rounded-2xl bg-white/95 px-5 py-7 text-center shadow-sm" data-landing-missed="">
              <p
                className="font-serif text-[34px] font-medium leading-tight text-ink"
                data-landing-heading=""
                data-rsvp-word={canvas && wordKeys ? rsvpWordBridgeKey(wordKeys.heading) : undefined}
                data-rsvp-default={canvas ? ownHeadline : undefined}
                data-rsvp-name={canvas ? firstName : undefined}
              >
                {headline}
              </p>
              <p
                className="mt-2 text-sm text-ink/60"
                data-thank-you-message=""
                data-rsvp-word={canvas && wordKeys ? rsvpWordBridgeKey(wordKeys.message) : undefined}
                data-rsvp-name={canvas ? firstName : undefined}
              >
                {ownMessage ?? LANDING_WORDS.missedSub}
              </p>
            </div>
          ) : (
            <>
              <p className="text-center">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F1EA] px-3.5 py-1.5 text-xs font-medium text-[#2F6B4F]"
                  data-landing-done=""
                >
                  ✓{' '}
                  <span
                    data-landing-heading=""
                    data-rsvp-word={canvas && wordKeys ? rsvpWordBridgeKey(wordKeys.heading) : undefined}
                    data-rsvp-default={canvas ? ownHeadline : undefined}
                    data-rsvp-name={canvas ? firstName : undefined}
                  >
                    {headline}
                  </span>
                </span>
              </p>
              {ownMessage || (canvas && wordKeys) ? (
                <p
                  className="text-center text-base leading-relaxed text-ink/80"
                  data-thank-you-message=""
                  data-rsvp-word={canvas && wordKeys ? rsvpWordBridgeKey(wordKeys.message) : undefined}
                  data-rsvp-word-optional={canvas ? '' : undefined}
                  data-rsvp-name={canvas ? firstName : undefined}
                  hidden={!ownMessage || undefined}
                >
                  {ownMessage}
                </p>
              ) : null}
            </>
          )}
        </div>

        {/* 2 · REPLY TO THE INVITATION — the one main button, only until they
            reply (then a small "Change my reply" stays at the foot). */}
        {unreplied ? (
          <div data-landing="reply">
            <Link className="button-primary w-full" href={inviteReplyPath(home)} data-landing-reply="">
              {LANDING_WORDS.reply}
            </Link>
            {replyByLabel ? <p className="mt-2.5 text-center text-xs text-ink/55">Please reply by {replyByLabel}</p> : null}
          </div>
        ) : null}

        {unlisted && !justIn ? (
          <DoorNotice>
            You weren&rsquo;t on the original list, so we&rsquo;ve let the hosts know — they&rsquo;ll
            confirm you shortly.
          </DoorNotice>
        ) : null}

        {/* 3 · 🎟 THE DIGITAL TICKET — the Fable 3 : 4 ticket (the route's own
            PNG, the file Save hands over): faded with "Reply to confirm your
            ticket" until a Yes, full with "Save my ticket" after, none after a
            No (`landingTicketOf`). A seat with no ticket keeps the QR panel. */}
        {ticket === 'full' ? (
          <section aria-labelledby="your-ticket" className="space-y-4 text-center" data-landing="ticket" data-landing-ticket="full">
            <h2 id="your-ticket" className="sr-only">
              Your {PASS_CARD_WORDS.digitalTicket}
            </h2>
            <div className="mx-auto w-[min(260px,100%)] overflow-hidden rounded-2xl shadow-[0_24px_48px_-26px_rgba(30,34,41,0.45)]">
              <TicketPicture src={PASS_CARD_ROUTE} alt={ticketLabel} fallback={ticketFallback} />
            </div>
            {safariSave ? (
              <a href={safariSave} className="button-primary w-full" data-landing-save="safari">
                {LANDING_WORDS.saveInSafari}
              </a>
            ) : (
              <SavePassCardButton
                hrefs={[PASS_CARD_ROUTE]}
                label={justIn ? REQUEST_WORDS.saveUpdated : LANDING_WORDS.saveTicket}
                variant="primary"
              />
            )}
            {justIn ? <p className="text-xs text-ink/60">{REQUEST_WORDS.saveUpdatedWhy}</p> : null}
          </section>
        ) : ticket === 'faded' ? (
          <section aria-labelledby="your-ticket" className="relative text-center" data-landing="ticket" data-landing-ticket="faded">
            <h2 id="your-ticket" className="sr-only">
              Your {PASS_CARD_WORDS.digitalTicket}
            </h2>
            <div aria-hidden="true" className="pointer-events-none mx-auto w-[min(260px,100%)] select-none overflow-hidden rounded-2xl opacity-[0.42] grayscale">
              <TicketPicture src={PASS_CARD_ROUTE} alt="" fallback={null} />
            </div>
            <Link
              href={inviteReplyPath(home)}
              className="absolute left-1/2 top-[62%] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-cream px-4 py-2.5 text-[13px] font-medium text-mulberry shadow-md ring-[1.5px] ring-mulberry"
            >
              {LANDING_WORDS.replyToConfirm}
            </Link>
          </section>
        ) : ticket === 'none' ? null : passCard === 'awaiting' ? (
          <p className="text-sm text-ink/70" data-landing="ticket">{passCardLine(passCard)}</p>
        ) : (
          <div data-landing="ticket">
            <InviteQrPanel
              qrSvg={qrSvg}
              invitationUrl={invitationUrl}
              guestName={guestName}
              eventWord={words.eventWord}
            />
          </div>
        )}

        {/* 4 · YOUR GUESTS · Send their invite — each named plus-one's own key. */}
        <div data-landing="guests">
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
            passCards={ticket === 'full' ? passCards : null}
            ticketRows={{ ownName: guestName }}
          />
        </div>

        {/* 5 · HOW TO USE IT — on the day, the seat. */}
        {ticket === 'full' || ticket === 'faded' ? (
          <section data-landing="how" aria-labelledby="how-to-use" className="border-t border-ink/10 pt-3.5">
            <h2 id="how-to-use" className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
              {LANDING_WORDS.howTitle}
            </h2>
            <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm leading-relaxed text-ink/75 marker:font-serif marker:font-semibold marker:text-mulberry">
              {howTo.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* 6 · OPEN THE INVITATION — Welcome · Details · Our Love Story · Me;
            "Open the event" on the day. The phase's own words
            (`arrivalDestinationFor`). Before a reply it is the small link past
            the reply gate (frame 1); after, the soft button (frames 3 · 4 · 6). */}
        <div data-landing="open">
          {unreplied ? (
            <p className="text-center">
              <Link className="inline-flex min-h-[44px] items-center text-sm font-medium text-mulberry underline underline-offset-4" href={openBeforeReplyHref(home)}>
                {destinationWords.cta}
              </Link>
            </p>
          ) : (
            <Link className={soft} href={`/${home}`}>
              {destinationWords.cta}
            </Link>
          )}
        </div>

        {/* The reply is done: a small "Change my reply" stays (frame 3), or
            "Changed your plans?" after a No (frame 4). */}
        {changeWords ? (
          <p className="text-center">
            <Link
              className="inline-flex min-h-[44px] items-center text-sm font-medium text-mulberry underline underline-offset-4"
              href={inviteReplyPath(home)}
              data-landing-change=""
            >
              {changeWords}
            </Link>
          </p>
        ) : null}

        {/* Kept below the Fable frames: their own link (📵 nothing is emailed —
            owner 2026-09-29), and the one account button (owner 2026-09-26). */}
        <CopyMyLink link={invitationUrl} />

        {nothingToSave ? (
          <SaveToAccount
            state={account}
            eventId={event.event_id as string}
            slug={home}
            personalLink={invitationUrl}
            userAgent={userAgent}
            termsCarried={rsvpTermsCarried(cookieStore.get(RSVP_TERMS_COOKIE)?.value)}
          />
        ) : (
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
        )}
      </DoorShell>
    </>
  );
}
