import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { readGuestSession } from '@/lib/guest-session';
import { formatEventDate } from '@/lib/events';
import { resolveRsvpAsk } from '@/lib/rsvp-ask';
import { guestListIsClosed } from '@/lib/guest-list-closed';
import { guestAccountState } from '@/lib/guest-one-path';
import { keepLinkSentFor, readSeatHolder } from '@/lib/guest-one-path.server';
import { RSVP_TERMS_COOKIE, rsvpTermsCarried } from '@/lib/terms-agreement';
import { plusOneFilled, plusOneGate, plusOneMissing, type PlusOneRow } from '@/lib/plus-one-welcome';
import { renderInvitationQrSvg } from '@/lib/qr';
import { QR_LOOK_COLUMNS, resolveEventQrLook, type QrLookRow } from '@/lib/qr-look.server';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';
import { DoorShell, DoorNotice } from '@/app/_components/door/door-shell';
import { abandonPlusOneInvite, confirmPlusOneName } from './actions';
import { eventWordsFor } from '../_lib/event-words';
import { PlusOneDoor } from './_components/plus-one-door';

export const metadata = { title: 'Welcome' };
export const dynamic = 'force-dynamic';

const ERROR_COPY: Record<string, string> = {
  missing: 'Please enter both your first and last name.',
  too_long: 'Names can be at most 80 characters.',
  terms: 'Please tick the Terms to save this to your account.',
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; pass?: string; keep?: string }>;
};

/**
 * 👋 THE PLUS-ONE'S OWN DOOR — prototype `rsvp_plus_ones_2026-09-29.html`,
 * frame F. Owner, verbatim, 2026-09-29: *"plus guests are only minimum
 * questions. they don't need to recommend songs and notes to the couple. They
 * also get their own QR Code. they can also link it to their account."*
 *
 * Reached from THEIR OWN link (`redeem` — once per browser), and by the Event
 * Hub's key gate when a required one of their four is missing
 * (`plusOneGate`). What it shows, in order:
 *
 *   · "Welcome, Ben" — and "Maria Santos is bringing you as their guest";
 *   · YOUR DETAILS — what the bringer already filled, shown and marked
 *     "from Maria", never asked again (a quiet "Something wrong? Change it"
 *     opens those same boxes in place);
 *   · ONE MORE THING — only what is MISSING of the four (first name, last
 *     name, meal, dietary — meal and dietary only when the couple asks them).
 *     No attendance, no mobile, no song, no note, no selfie;
 *   · the Terms, then ONE "Save to my account" — the shipped `SaveToAccount`,
 *     its method chosen by the device, the answers saving with it;
 *   · "Not now — just show my pass": their own QR, on this same door.
 *
 * Their attendance is never asked or written here — it follows their own
 * reply if they give one (the RSVP tab).
 */
export default async function WelcomePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;

  const session = await readGuestSession();
  if (!session) redirect(`/${slug}`);

  const admin = createAdminClient();
  const { data: event } = await admin
    .from('events')
    .select(
      `event_id, display_name, event_date, slug, event_type, rsvp_ask_config, guest_count_locked_at, guest_list_edit_deadline, ${QR_LOOK_COLUMNS}`,
    )
    .ilike('slug', slug)
    .maybeSingle();
  if (!event) notFound();

  if (event.event_id !== session.event_id) redirect(`/${slug}`);
  const home = (event.slug as string | null) ?? slug;

  // A plus-one giving their name was told it would appear in "the couple's"
  // guest list, whatever kind of event they had been invited to.
  const words = await eventWordsFor(event.event_type as string);

  const { data: guest } = await admin
    .from('guests')
    .select(
      'guest_id, first_name, last_name, email, qr_token, plus_one_of_guest_id, plus_one_name_confirmed_at, meal_preference, dietary_restrictions',
    )
    .eq('guest_id', session.guest_id)
    .eq('event_id', event.event_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!guest) redirect(`/${home}`);

  // Only a plus-one has this door; everyone else has the reply.
  if (!guest.plus_one_of_guest_id) redirect(`/${home}`);

  const { data: primary } = await admin
    .from('guests')
    .select('first_name, last_name, display_name')
    .eq('guest_id', guest.plus_one_of_guest_id)
    .maybeSingle();

  const primaryName =
    primary?.display_name?.trim() ||
    [primary?.first_name, primary?.last_name].filter(Boolean).join(' ') ||
    'the inviting guest';
  const primaryFirst = (primary?.first_name as string | null)?.trim() || primaryName.split(/\s+/)[0];

  const ask = resolveRsvpAsk(event.rsvp_ask_config);
  const row: PlusOneRow = {
    first_name: (guest.first_name as string | null) ?? null,
    last_name: (guest.last_name as string | null) ?? null,
    plus_one_name_confirmed_at: (guest.plus_one_name_confirmed_at as string | null) ?? null,
    meal_preference: (guest.meal_preference as string | null) ?? null,
    dietary_restrictions: (guest.dietary_restrictions as string | null) ?? null,
  };
  const missing = plusOneMissing(row, ask);
  const filled = plusOneFilled(row, ask);
  const locked = guestListIsClosed({
    lockedAt: event.guest_count_locked_at as string | null,
    editDeadline: event.guest_list_edit_deadline as string | null,
    eventDate: event.event_date as string | null,
  });
  const inside = plusOneGate(row, ask, locked) === 'inside';

  // ── THE ONE ACCOUNT BUTTON — the same decision the Event Hub's card makes.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const account = guestAccountState({
    viewerUserId: user?.id ?? null,
    viewerEmail: user?.email ?? null,
    seatHolderUserId: await readSeatHolder(event.event_id as string, guest.guest_id as string),
    linkSentForThisEvent: search.keep === 'sent' || (await keepLinkSentFor(event.event_id as string)),
  });
  const showPass = search.pass === '1';
  // Kept in their account and nothing required missing — nothing to welcome.
  if (account.kind === 'linked' && inside && !showPass) redirect(`/${home}`);

  const termsCarried = rsvpTermsCarried((await cookies()).get(RSVP_TERMS_COOKIE)?.value);
  const userAgent = (await headers()).get('user-agent');

  // ── "JUST SHOW MY PASS" — their own QR, the same renderer and url as every
  // other guest pass, wearing the event's look.
  let passSvg: string | null = null;
  if (showPass && guest.qr_token) {
    const params = {
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app',
      slug: home,
      qrToken: guest.qr_token as string,
      ownerSlug: await resolveEventOwnerSlug(admin, event.event_id as string),
    };
    passSvg = await renderInvitationQrSvg({
      ...params,
      look: await resolveEventQrLook(admin, event.event_id as string, event as unknown as QrLookRow),
    });
  }

  const errorKey = search.error ?? null;
  const errorMessage = errorKey ? (ERROR_COPY[errorKey] ?? errorKey) : null;

  const confirmAction = confirmPlusOneName.bind(null, home);
  const abandonAction = abandonPlusOneInvite.bind(null, home);

  const firstName = missing.name ? null : (row.first_name ?? '').trim() || null;

  return (
    <DoorShell
      eyebrow="You're invited!"
      title={firstName ? `Welcome, ${firstName}` : `You are the +1 of ${primaryName}`}
      sub={<>{primaryName} is bringing you as their guest.</>}
      meta={`${event.display_name} · ${formatEventDate(event.event_date as string | null)}`}
    >
      {errorMessage ? <DoorNotice kind="alert">{errorMessage}</DoorNotice> : null}
      <PlusOneDoor
        home={home}
        eventId={event.event_id as string}
        primaryFirst={primaryFirst}
        theOrganizerPossessive={words.theOrganizerPossessive}
        row={row}
        missing={missing}
        filled={filled}
        inside={inside}
        account={account}
        hasEmail={Boolean((guest.email as string | null)?.trim())}
        userAgent={userAgent}
        termsCarried={termsCarried}
        passSvg={passSvg}
        showPass={showPass}
        confirmAction={confirmAction}
        abandonAction={abandonAction}
      />
    </DoorShell>
  );
}
