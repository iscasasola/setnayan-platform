import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isPlaceholderEmail } from '@/lib/anon-onboarding';
import { SubmitButton } from '@/app/_components/submit-button';
import { joinEventAction, selfJoinAction } from '../actions';
import { findMeAction } from '../find-me-actions';
import { readFindState } from '@/lib/find-me.server';
import { FormalNameInputs } from '@/app/_components/formal-name-inputs';
import { JoinShell, type JoinShellEvent } from './join-shell';
import { RequestForm } from './request-form';
import { formalNameFromLine, isFormalNameEmpty, type FormalName } from '@/lib/formal-name';
import { sanitizeRsvpAskConfig } from '@/lib/rsvp-ask';
import type { DoorSkin } from '@/app/_components/door/door-shell';
import { readGuestSession } from '@/lib/guest-session';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { eventWordsForEvent } from '@/app/[slug]/_lib/event-words';
import { arrivalSteps, inviteReplyPath } from '@/lib/invite-arrival';
import { joinDoorRefusalMessage } from '@/lib/join-door-refusal-copy';

/*
  🔴 THESE WERE A MODULE CONSTANT SAYING "the couple" ON EVERY EVENT TYPE, and
  this door is where a guest scanning a QR lands — including at a wake. A
  wedding reads byte-identically (`organizerNoun` is `'couple'`), which is the
  safety property `event-words.ts` exists to hold.

  🔒 NO DEFAULT, NO 'host' FALLBACK. A funeral's word is `family`; "host" is
  wrong for the one event type this work exists for.

  🛑 B1(b) — the refusal-reason → sentence mapping now lives in
  lib/join-door-refusal-copy.ts, so a private event and an actually-dead token
  can never be collapsed back onto the same `invalid_token` sentence. See that
  file for the property it asserts.
*/

export type JoinFlowEvent = {
  event_id: string;
  public_id: string | null;
  display_name: string | null;
  event_date: string | null;
  event_date_precision: string | null;
  venue_name: string | null;
  slug: string | null;
};

/**
 * The shared join experience, rendered identically whether the guest arrived via
 * the opaque `/join/[eventId]?token=` URL or the branded `/[slug]/invite` URL.
 * The caller resolves + validates (event + token) per its route; this owns the
 * auth check, already-member redirect, and the accountless / signed-in forms.
 *
 * `returnPath` is where sign-in / create-account should bring the guest back to
 * (so a branded-URL visitor returns to the branded URL).
 */
export async function JoinFlow({
  event,
  token,
  errorKey,
  returnPath,
  skin,
  brand,
}: {
  event: JoinFlowEvent;
  token: string;
  errorKey: string | null;
  returnPath: string;
  /** The invite link's theme skin, from `/[slug]/invite`. The opaque /join URL passes none. */
  skin?: DoorSkin;
  /** `'foot'` from `/[slug]/invite` — the couple's page (DoorShell `brand`). */
  brand?: 'top' | 'foot';
}) {
  const eventId = event.event_id;
  // JoinShell wants a non-null display_name; coerce once (renders nothing if blank).
  const shellEvent = {
    display_name: event.display_name ?? '',
    event_date: event.event_date,
    event_date_precision: event.event_date_precision,
    venue_name: event.venue_name,
  };
  // 🔒 NO ROLE IS OFFERED ON THIS DOOR (owner-locked 2026-06-25, built
  // 2026-09-10): role is the HOST's field. A matched guest inherits the role the
  // couple assigned; an unlisted one joins as `guest` and the couple refines it.
  // The 18-role picker shipped five days BEFORE that lock (e567da125, 06-20) and
  // was never taken down — a stranger could self-assign "Principal Sponsor".
  //
  // One resolve covers all eight sentences below, the SIGNED-OUT arm included.
  // This component is already an async server component holding the event id,
  // so no prop, no default and no call-site change is needed.
  //
  // ⚠ THAT SENTENCE WAS TRUE OF THE CALL AND FALSE OF THE ANSWER, and this door
  // is where it cost the most. Both resolvers read `public.events` through the
  // cookie-scoped session client, and that table has no SELECT policy admitting
  // `anon` — so for a signed-out visitor the read came back empty and BOTH fell
  // through to the wedding: the mourner who scanned a wake's QR was told about
  // "the couple", and this door offered them "Maid of honor", "Ring bearer" and
  // "Veil sponsor". They now read the event's own type with the service-role
  // client (`lib/event-type-profile.ts`), so the signed-out arm gets the
  // celebration's real words and its real role set.
  // 🔑 A RESOLVER THAT IS CALLED IS NOT A RESOLVER THAT CAN ANSWER — the guard
  // written for this counted the CALL, and the call was there the whole time.
  const w = await eventWordsForEvent(eventId);
  const errorMessage = joinDoorRefusalMessage(errorKey, w);
  const loginHref = `/login?next=${encodeURIComponent(returnPath)}`;
  const signupHref = `/signup?next=${encodeURIComponent(returnPath)}`;

  // "Who can RSVP?" and the switched-on questions — one read, service-role
  // (a signed-out visitor holds no `events` SELECT), through lib/rsvp-ask.ts.
  const admin = createAdminClient();
  const { data: askRow } = await admin
    .from('events')
    .select('rsvp_ask_config')
    .eq('event_id', eventId)
    .maybeSingle();
  const ask = sanitizeRsvpAskConfig(askRow?.rsvp_ask_config);
  const Organizer = w.theOrganizer.charAt(0).toUpperCase() + w.theOrganizer.slice(1);

  // Auth check.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 🛂 NOBODY WITHOUT A KEY GETS INSIDE UNTIL THE COUPLE KEEPS OR LINKS THEM
  // (owner, 2026-09-26). Everyone who reaches this door without a key ASKS: a
  // name (the list is never shown), the RSVP and a contact → "Request sent".
  // No guest session, no membership — the join actions write neither.
  if (!user) {
    const slug = event.slug ?? null;
    if (slug) {
      // This device already HOLDS a key for this event → straight on to Reply
      // (the invite arrival's door 02, lib/invite-arrival.ts).
      const session = await readGuestSession();
      if (session && session.event_id === eventId) {
        redirect(inviteReplyPath(slug));
      }
      const selfAction = selfJoinAction.bind(null, eventId, token);
      // 🔎 THE GENERIC QR FINDS YOU (owner 2026-09-30, lib/find-me.ts): the
      // name comes FIRST, alone. What the door answered lives in this
      // browser's encrypted find state — never in the address.
      const found = await readFindState(eventId);
      const findMe = findMeAction.bind(null, eventId, token);
      return (
        <JoinShell event={shellEvent} skin={skin} brand={brand}>
          {errorMessage ? <FormFlash tone="error">{errorMessage}</FormFlash> : null}
          {!found ? (
            <FindMeNameStep action={findMe} organizer={w.theOrganizer} />
          ) : found.outcome === 'digits' ? (
            <FindMeDigitsStep action={findMe} organizer={w.theOrganizer} />
          ) : found.outcome === 'confirm' ? (
            <div data-find-me="confirm">
              <div className="mb-6 space-y-2">
                <p className="font-serif text-3xl text-ink">We found you!</p>
                <p className="text-base text-ink/75">
                  {Organizer} will confirm it&rsquo;s you. Answer below — your invitation opens the moment they do.
                </p>
              </div>
              <RequestForm action={selfAction} ask={ask} organizer={w.theOrganizer} fixedParts={found.parts} />
              <StartOver action={findMe} />
            </div>
          ) : (
            <div data-find-me="none">
              <AskToJoinIntro organizer={w.theOrganizer} />
              <RequestForm action={selfAction} ask={ask} organizer={w.theOrganizer} defaultParts={found.parts} />
            </div>
          )}
          <p className="mt-6 text-sm text-ink/70">
            Already have a Setnayan account?{' '}
            <Link className="font-medium text-link underline-offset-2 hover:underline" href={loginHref}>
              Sign in
            </Link>
          </p>
        </JoinShell>
      );
    }
    // No public page yet → fall back to the account wall.
    return (
      <JoinShell event={shellEvent} skin={skin} brand={brand}>
        <p className="text-base text-ink/70">
          Sign in or create an account to ask {w.theOrganizer} to add you to this event.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link className="button-primary" href={loginHref}>
            Sign in
          </Link>
          <Link className="button-secondary" href={signupHref}>
            Create account
          </Link>
        </div>
      </JoinShell>
    );
  }

  // Already a member?
  const { data: existing } = await admin
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    if (existing.member_type === 'couple') {
      redirect(`/dashboard/${eventId}`);
    }
    // A signed-in guest who already holds a seat goes straight to their own
    // invitation (lib/guest-one-path.ts recognises the account's seat).
    if (existing.member_type === 'guest' && event.slug) {
      redirect(`/${event.slug}`);
    }
    redirect(`/join/${eventId}/success?token=${encodeURIComponent(token)}`);
  }

  // Already asked, and the couple has not decided yet → the same "Request
  // sent" the asking ended on, not a second form.
  const { data: claim } = await admin
    .from('guest_claims')
    .select('status, target_guest_id')
    .eq('event_id', eventId)
    .eq('claimer_user_id', user.id)
    .maybeSingle();
  if (claim?.status === 'pending_review' && claim.target_guest_id) {
    return <RequestSentScreen event={shellEvent} organizer={Organizer} slug={event.slug} skin={skin} brand={brand} />;
  }

  const action = joinEventAction.bind(null, eventId, token);
  const accountEmail = user.email && !isPlaceholderEmail(user.email) ? user.email : null;

  // The couple recorded THIS account's email on a guest they put on the list →
  // one press opens their invitation (the inbox is the proof; a name never is).
  const { data: seeded } = accountEmail
    ? await admin
        .from('guests')
        .select('guest_id')
        .eq('event_id', eventId)
        .eq('entry_source', 'host_seeded')
        .ilike('email', accountEmail)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()
    : { data: null };

  // A SIGNED-IN GUEST DOES NOT RETYPE THEIR NAME (owner 2026-09-25). The account
  // already carries it — the profile's display name first, then whatever
  // Google / Apple handed over.
  const { data: profile } = await admin
    .from('users')
    .select('display_name, name_prefix, first_name, middle_name, last_name, name_suffix')
    .eq('user_id', user.id)
    .maybeSingle();
  const metaFirst = (user.user_metadata?.first_name as string | undefined) ?? '';
  const metaLast = (user.user_metadata?.last_name as string | undefined) ?? '';
  const defaultName = (
    ((profile?.display_name as string | null) ?? '').trim() ||
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    [metaFirst, metaLast].filter(Boolean).join(' ') ||
    ''
  ).trim();
  // The five boxes open on the account's own formal name (profile → Full name),
  // else the one name above split by the shared parser — never retyped.
  const defaultParts: FormalName =
    profile && !isFormalNameEmpty(profile)
      ? {
          name_prefix: profile.name_prefix ?? null,
          first_name: profile.first_name ?? null,
          middle_name: profile.middle_name ?? null,
          last_name: profile.last_name ?? null,
          name_suffix: profile.name_suffix ?? null,
        }
      : formalNameFromLine(defaultName);

  if (seeded) {
    return (
      <JoinShell event={shellEvent} steps={event.slug ? arrivalSteps('name') : undefined} skin={skin} brand={brand}>
        {errorMessage ? <FormFlash tone="error">{errorMessage}</FormFlash> : null}
        <p className="text-base text-ink/70">
          You&rsquo;re signed in as <span className="font-medium text-ink">{accountEmail}</span>, and {w.theOrganizer}{' '}
          has you on their guest list.
        </p>
        <form action={action} className="mt-6">
          <input type="hidden" name="name" value={defaultName || accountEmail || ''} />
          <SubmitButton className="button-primary w-full" pendingLabel="Opening…">
            Open my invitation
          </SubmitButton>
        </form>
      </JoinShell>
    );
  }

  return (
    <JoinShell event={shellEvent} skin={skin} brand={brand}>
      {errorMessage ? <FormFlash tone="error">{errorMessage}</FormFlash> : null}
      <AskToJoinIntro organizer={w.theOrganizer} />
      <RequestForm
        action={action}
        ask={ask}
        organizer={w.theOrganizer}
        defaultParts={defaultParts}
        accountEmail={accountEmail}
      />
    </JoinShell>
  );
}

/**
 * 🔎 STEP 1 of the generic QR (lib/find-me.ts) — the name, alone. Only the five
 * boxes; the list is never shown and nothing is suggested.
 */
function FindMeNameStep({ action, organizer }: { action: (formData: FormData) => Promise<void>; organizer: string }) {
  return (
    <form action={action} className="space-y-6" data-find-me="name">
      <input type="hidden" name="step" value="name" />
      <div className="space-y-2">
        <p className="font-serif text-2xl text-ink">Find your invitation</p>
        <p className="text-sm text-ink/70">Type your name the way {organizer} would have it on their guest list.</p>
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-ink">Your name</legend>
        <FormalNameInputs required forSelf idPrefix="find-" />
      </fieldset>
      <SubmitButton className="button-primary w-full" pendingLabel="Looking…">
        Continue
      </SubmitButton>
    </form>
  );
}

/**
 * 🔎 STEP 2 — "We found you!" and the last 4 digits of the mobile on file.
 * 🔒 NOTHING ELSE IS SHOWN FIRST: no digit of the number, no +N, no outfit —
 * this screen is drawn from the find state's verdict alone, never the guest row.
 */
function FindMeDigitsStep({
  action,
  organizer,
}: {
  action: (formData: FormData) => Promise<void>;
  organizer: string;
}) {
  return (
    <div data-find-me="digits">
      <form action={action} className="space-y-6">
        <input type="hidden" name="step" value="digits" />
        <div className="space-y-2">
          <p className="font-serif text-3xl text-ink">We found you!</p>
          <p className="text-base text-ink/75">
            To make sure it&rsquo;s you, type the last 4 digits of the mobile number {organizer} has for you.
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="find-last4" className="block text-sm font-medium text-ink">
            Last 4 digits
          </label>
          <input
            id="find-last4"
            name="last4"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            minLength={4}
            autoComplete="off"
            required
            placeholder="••••"
            className="input-field text-center font-mono text-2xl tracking-[0.5em]"
          />
        </div>
        <SubmitButton className="button-primary w-full" pendingLabel="Checking…">
          Open my invitation
        </SubmitButton>
      </form>
      <form action={action} className="mt-3">
        <input type="hidden" name="step" value="hosts" />
        <SubmitButton
          overlay={false}
          pendingLabel="One moment…"
          className="flex min-h-11 w-full items-center justify-center text-sm font-medium text-ink underline underline-offset-4"
        >
          I don&rsquo;t know that number
        </SubmitButton>
      </form>
      <StartOver action={action} />
    </div>
  );
}

/** "Not you? Start over" — forgets what was typed. */
function StartOver({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="step" value="over" />
      <SubmitButton
        overlay={false}
        pendingLabel="One moment…"
        className="flex min-h-11 w-full items-center justify-center text-sm text-ink/60 underline underline-offset-4"
      >
        Not you? Start over
      </SubmitButton>
    </form>
  );
}

/** Frame 7a's words, above the request form. */
function AskToJoinIntro({ organizer }: { organizer: string }) {
  return (
    <div className="mb-6 space-y-2">
      <p className="font-serif text-2xl text-ink">You&rsquo;re not on the guest list for this event yet</p>
      <p className="text-sm text-ink/70">
        Ask to join. If {organizer} has you down under another name or on a family member&rsquo;s invite, they
        will link you. You get your own Digital ticket right away — it unlocks the moment they confirm you.
      </p>
    </div>
  );
}

/**
 * "REQUEST SENT" (prototype frame 7c). Not inside, and the event does not appear
 * in their account until the couple keeps or links them.
 */
export function RequestSentScreen({
  event,
  organizer,
  slug,
  skin,
  brand,
}: {
  event: JoinShellEvent;
  /** Capitalised: "The couple" / "The family". */
  organizer: string;
  slug: string | null;
  skin?: DoorSkin;
  brand?: 'top' | 'foot';
}) {
  return (
    <JoinShell event={event} skin={skin} brand={brand}>
      <div className="space-y-3" data-request-sent="">
        <p className="font-serif text-3xl text-ink">Request sent</p>
        <p className="text-base text-ink/75">
          {organizer} will check their list. Open this invitation again once they confirm you — nothing is emailed.
        </p>
      </div>
      {slug ? (
        <Link className="button-secondary mt-6 w-full sm:w-auto" href={`/${slug}`}>
          Back to the details
        </Link>
      ) : null}
    </JoinShell>
  );
}
