import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { DoorNotice, DoorShell } from '@/app/_components/door/door-shell';
import { ANY_OAUTH_ENABLED, OAuthButtonRow } from '@/app/_components/oauth-button-row';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { readGuestSession } from '@/lib/guest-session';
import { resolvePapicFaceMode } from '@/lib/papic-face-mode';
import { guestListIsClosed } from '@/lib/guest-list-closed';
import { joinDoorMeta } from '@/lib/join-door-meta';
import { arrivalSteps, CONNECT_THEN_REPLY, inviteEnterPath } from '@/lib/invite-arrival';
import { eventWordsFor } from '../../_lib/event-words';
import type { GuestRow } from '../../_lib/types';
import { RsvpWidget } from '../../_components/rsvp-widget';
import { submitInviteReply } from '../actions';
import { INVITE_LOOK_COLUMNS, loadInviteLook } from '../_lib/load-invite-look';

export const metadata = { title: 'Your reply', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ rsvp?: string }>;
};

/**
 * DOOR 02 · REPLY — the invite arrival's second door (lib/invite-arrival.ts).
 *
 * The guest is already on the list: door 01 matched them or admitted them, and
 * minted the guest session this page reads. Here they complete their OWN record
 * — the answer, how to reach them, their meal, their dietary notes, a plus-one
 * if the couple allowed one, a note, a selfie — with the SAME card and the SAME
 * write the Event Hub uses (`RsvpWidget` → `submitRsvp`). Until 2026-09-10 that
 * card lived only on the site, so the arrival ended before the part it exists for.
 *
 * 🔑 THE EMAIL IS THE LOGIN (owner 2026-09-10). Google and Apple sit at the TOP
 * of this door — before anything is typed, because a provider sign-in leaves the
 * page and comes back, and a redirect under a half-filled form loses the form.
 * They return through `/join/[eventId]/connect`, which binds this seat to the
 * account, then straight back here. A guest who types an email instead is sent
 * the passwordless sign-in link when they save (`submitInviteReply`).
 */
export default async function InviteReplyPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;

  const admin = createAdminClient();
  const { data: event, error: eventError } = await admin
    .from('events')
    .select(
      `event_id, public_id, slug, display_name, event_date, event_date_precision, venue_name, guest_list_edit_deadline, guest_count_locked_at, ${INVITE_LOOK_COLUMNS}`,
    )
    // `.ilike`, NOT `.eq` — the same case-insensitive match as `/[slug]/invite`.
    .ilike('slug', slug)
    .maybeSingle();
  if (eventError) {
    throw new Error(`invite/reply: could not read the event for "${slug}": ${eventError.message}`);
  }
  if (!event?.slug) notFound();
  const home = event.slug as string;

  // The session IS the gate: door 01 (or a personal link) minted it, and it is
  // the same credential the Event Hub trusts. No session for THIS event → the
  // first door, where they can find themselves.
  const session = await readGuestSession();
  if (!session || session.event_id !== event.event_id) redirect(`/${home}/invite`);

  const { data: guest, error: guestError } = await admin
    .from('guests')
    .select(
      'guest_id, first_name, last_name, display_name, role, side, group_category, plus_one_of_guest_id, plus_one_mode, plus_one_name_confirmed_at, plus_one_allowed, plus_one_name, rsvp_status, meal_preference, dietary_restrictions, guest_note, custom_tags, qr_token, photo_url, photo_source, email, mobile',
    )
    .eq('guest_id', session.guest_id)
    .eq('event_id', event.event_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (guestError) {
    throw new Error(`invite/reply: could not read guest ${session.guest_id}: ${guestError.message}`);
  }
  if (!guest) redirect(`/${home}/invite`);

  // A TBA plus-one confirms their own name first — the same routing the Event Hub does.
  const isUnconfirmedTba =
    guest.plus_one_of_guest_id !== null &&
    !guest.plus_one_name_confirmed_at &&
    (!guest.first_name || String(guest.first_name).toLowerCase() === 'tba');
  if (isUnconfirmedTba) redirect(`/${home}/welcome`);

  const [words, faceMode, supabase, look] = await Promise.all([
    eventWordsFor(event.event_type as string),
    resolvePapicFaceMode(admin, event.event_id as string),
    createClient(),
    loadInviteLook(event),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const replyLocked = guestListIsClosed({
    lockedAt: event.guest_count_locked_at as string | null,
    editDeadline: event.guest_list_edit_deadline as string | null,
    eventDate: event.event_date as string | null,
  });

  // The answers this person has already given Setnayan — read only for a
  // signed-in viewer, used only as a default where this event's own answer is
  // blank. The same read, and the same rule, as the Event Hub's card.
  let profileDetails: {
    mealPreference: string | null;
    dietaryRestrictions: string | null;
    email: string | null;
    phone: string | null;
    displayName: string | null;
  } | null = null;
  if (user?.id) {
    const { data: me } = await admin
      .from('users')
      .select('meal_preference, dietary_restrictions, email, phone, display_name')
      .eq('user_id', user.id)
      .maybeSingle();
    if (me && (me.meal_preference || me.dietary_restrictions || me.email || me.phone || me.display_name)) {
      profileDetails = {
        mealPreference: (me.meal_preference as string | null) ?? null,
        dietaryRestrictions: (me.dietary_restrictions as string | null) ?? null,
        email: (me.email as string | null) ?? null,
        phone: (me.phone as string | null) ?? null,
        displayName: (me.display_name as string | null) ?? null,
      };
    }
  }

  // Signed in AND holding this seat? Then there is no account left to offer.
  let seatIsLinked = false;
  if (user?.id) {
    const { data: held } = await admin
      .from('event_members')
      .select('id')
      .eq('event_id', event.event_id)
      .eq('user_id', user.id)
      .maybeSingle();
    seatIsLinked = Boolean(held);
  }

  // Where a provider sign-in (or a password sign-in) comes back through: the
  // connect route binds this seat to the account, then returns to this door.
  const connectPath = `/join/${event.event_id}/connect?then=${CONNECT_THEN_REPLY}`;

  const flash =
    search.rsvp === 'error'
      ? {
          tone: 'error' as const,
          text: 'We could not save your reply just now. Please try again — it has not been recorded yet.',
        }
      : null;

  /* ── THE WAY ONWARD FOR SOMEBODY WHO HAS ALREADY ANSWERED ────────────────
     🔒 THE 2026-09-10 REDIRECT STAYS. `join-flow.tsx` sends a returning guest
     straight here rather than back through the arrival, and that ruling is not
     being reversed — a guest must not be made to type their name again. What
     was missing is the other half: from this door there was NO way on to the
     Event Hub or to their own QR except re-submitting the form. Owner hit
     exactly that and called it being stuck.

     🔑 THE LINK GOES TO DOOR 03, NOT TO THE HUB. Door 03 is where the QR is
     handed over and where the phase-aware proceed button lives; sending them
     past it would be the "stuck" complaint answered by skipping the thing they
     were stuck without. It is the same `readGuestSession()` gate as this page,
     so it cannot show anyone a code that is not theirs — and it replays no
     reveal (that is door 01, which this guest is deliberately never sent back
     to).

     Offered only once there IS an answer to stand on: a 'pending' guest has not
     replied yet, and their way onward is the card below. */
  const hasAnswered = ((guest.rsvp_status as string | null) ?? 'pending') !== 'pending';

  const guestName =
    (guest.display_name as string | null)?.trim() ||
    `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() ||
    'Your reply';

  return (
    <DoorShell
      eyebrow="Your reply"
      title={guestName}
      meta={joinDoorMeta({
        event_date: event.event_date as string | null,
        event_date_precision: event.event_date_precision as string | null,
        venue_name: event.venue_name as string | null,
      })}
      steps={arrivalSteps('reply')}
      width="lg"
      skin={look.skin}
    >
      {hasAnswered ? (
        <DoorNotice>
          Your reply is saved.{' '}
          <Link
            className="font-medium text-link underline-offset-2 hover:underline"
            href={inviteEnterPath(home)}
          >
            Go to your QR and open the {words.eventWord}
          </Link>{' '}
          {replyLocked ? null : <> &mdash; or change your answer below.</>}
        </DoorNotice>
      ) : null}

      {user && seatIsLinked ? (
        <p className="text-sm text-ink/70">
          You&rsquo;re signed in{user.email ? <> as <span className="font-medium text-ink">{user.email}</span></> : null} —
          this reply is saved to your account.
        </p>
      ) : user ? (
        <p className="text-sm text-ink/70">
          You&rsquo;re signed in.{' '}
          <Link className="font-medium text-link underline-offset-2 hover:underline" href={connectPath}>
            Keep this invitation in your account
          </Link>
          .
        </p>
      ) : ANY_OAUTH_ENABLED ? (
        <div className="space-y-3">
          {/* ⚠ THE WORDS USED TO ASSUME AN ACCOUNT. This line read "Fills this in
              for you, and becomes how you sign in later." — owner, 2026-09-11:
              *"if they do not have an account yet, you say that it fills it up
              for them. how is that if they do not have an account yet."* He is
              right: the BEHAVIOUR was always correct (a provider sign-in MAKES
              the account and hands back a name and an email), but the sentence
              only made sense to somebody who already had one.

              🔑 AND IT NOW CARRIES THE REASON THAT IS WORTH SOMETHING. Owner, same
              day: *"logging in will sync and save their photos."* Written
              against what SHIPS, and nothing wider:
                · `photos-of-you-gallery.tsx` is mounted by site-body for
                  `isLive || isPost` — on the day, this page really does show a
                  guest the photos they are in;
                · the account is what reaches the event afterwards. The
                  guest-link cookie carries ONE event and dies at 60 days with no
                  sliding refresh (lib/guest-session.ts); Path C in
                  app/[slug]/page.tsx admits a signed-in person through their
                  `event_members.guest_id` seat instead — any device, no link.
              ⛔ NOT a cross-event "photo collection". No such surface was found,
              so no such sentence is written. */}
          <p className="text-sm text-ink/70">
            No Setnayan account yet? Continuing with Google or Apple makes one in a tap — it
            fills your name and email in below, and it becomes how you sign in from then on.
          </p>
          <p className="text-sm text-ink/70">
            It also keeps the photos of you: on the day, this page shows each guest the photos
            they are in, and the account is how you reach this {words.eventWord} again later —
            from any phone, without the invite link.
          </p>
          <OAuthButtonRow next={connectPath} />
          <p className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.16em] text-ink/70">
            <span aria-hidden className="h-px flex-1 bg-ink/10" />
            or fill it in yourself
            <span aria-hidden className="h-px flex-1 bg-ink/10" />
          </p>
        </div>
      ) : null}

      <RsvpWidget
        words={words}
        guest={guest as unknown as GuestRow}
        eventId={event.event_id as string}
        eventPublicId={event.public_id as string}
        faceMode={faceMode}
        flash={flash}
        replyLocked={replyLocked}
        profileDetails={profileDetails}
        doorAction={submitInviteReply.bind(null, event.event_id as string, guest.guest_id as string)}
        /* 🔑 NO FACE TAGGING ON THE INVITE (owner, verbatim 2026-09-11: "face
           tagging does not happen on the invite. it happens on their first view
           on the day of the event? or on the day papic becomes available to use
           for them."). The catch he describes ALREADY SHIPS —
           `_components/day-of-face-enroll.tsx`, mounted on the day-of landing,
           in the hub (`needsFaceEnroll`) and inside the Papic guest camera,
           self-hiding once enrolled. So this is a removal from ONE surface, not
           a feature taken away: a prop, because this card is shared with the
           Event Hub's own RSVP card, which keeps its selfie. */
        offerSelfie={false}
      />

      {user ? null : (
        <p className="text-sm text-ink/70">
          Have an account?{' '}
          <Link
            className="font-medium text-link underline-offset-2 hover:underline"
            href={`/login?next=${encodeURIComponent(connectPath)}`}
          >
            Sign in
          </Link>{' '}
          instead.
        </p>
      )}
    </DoorShell>
  );
}
