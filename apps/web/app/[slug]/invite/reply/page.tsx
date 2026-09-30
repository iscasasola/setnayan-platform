import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { DoorNotice, DoorShell } from '@/app/_components/door/door-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { resolveFaceTagging } from '@/lib/papic-face-mode';
import { guestListIsClosed } from '@/lib/guest-list-closed';
import { formatEventDateWithPrecision } from '@/lib/events';
import { joinDoorMeta } from '@/lib/join-door-meta';
import { inviteEnterPath } from '@/lib/invite-arrival';
import { eventWordsFor } from '../../_lib/event-words';
import type { GuestRow } from '../../_lib/types';
import { RsvpWidget } from '../../_components/rsvp-widget';
import { NotYouSwitch } from '../../_components/not-you-switch';
import { submitInviteReply } from '../actions';
import { rsvpGate } from '@/lib/guest-one-path';
import { readGuestSessionForEvent } from '@/lib/guest-one-path.server';
import { INVITE_LOOK_COLUMNS, INVITE_MARK_COLUMNS, doorMarkFor } from '../_lib/load-invite-look';
import { hubDoorSkin } from '../_components/hub-door-skin';
import { readRsvpWords, resolveReplyBy, resolveRsvpAsk } from '@/lib/rsvp-ask';
import { rsvpWordBridgeKey } from '@/lib/rsvp-stage-shared';
import { RsvpCanvasBridge } from '../../_components/rsvp-canvas-bridge';
import { askOneAtATime } from '@/lib/rsvp-one-at-a-time';
import { eventAnimatedMonogramActive } from '@/lib/animated-monogram';
import { markAnimationSwitchedOff } from '@/lib/monogram-studio-shared';
import { plusOneSeatsFor } from '../../_lib/plus-one-seats.server';
import { asksForHostCanvas } from '../../_lib/editor-canvas';
import {
  guestLookFrom,
  loadEventShell,
  loadGuestLook,
  loadHostMembership,
  loadHostPreviewDraft,
  loadWidgets,
  type EventShellRow,
  type GuestLook,
} from '../../_lib/loaders';
import { resolveHubTheme } from '../../_lib/hub-look';
import { mainGroundLayerFor } from '../../_lib/main-ground-layer';
import { GuestLookScope } from '../../_components/guest-look-scope';
import { lookScopeProps } from '../../_components/host-draft-look';
import { getCurrentUser } from '@/lib/auth';
import { HUB_DRAFT_LOOK_COLUMNS, overlayHubDraftEvent, overlayHubDraftWidgets } from '@/lib/hub-draft';
import { rsvpCanvasGuestFor } from '@/lib/simulated-guest-preview';
import { loadPreviewPerson } from '../../_lib/preview-person.server';

export const metadata = { title: 'Your reply', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ rsvp?: string; editor?: string; preview?: string }>;
};

/**
 * THE RSVP PAGE — the guest pathway's second screen (owner 2026-09-26/27,
 * spec corpus DECISION_LOG "GET INSIDE … RSVP IS ONE EXTRA PAGE INSIDE THE
 * EVENT HUB" and "THE RSVP IS ONE EDITABLE SCENE + ONE SWITCH").
 *
 *   Invitation → RSVP → **this page** → Send → thank-you (door 03)
 *
 * ONE button: Send. The guest never chooses a sign-in method here — saving to
 * an account is the thank-you's one button, chosen by the device. So the
 * Google / Apple row and the "Sign in instead" line that used to sit on this
 * door are gone; what stays is the form, the Terms tick (required), and a small
 * "Not you? Switch" under the name for a phone a family shares.
 *
 * 🔑 THE KEY GATE LANDS HERE. `/{slug}` redirects a guest with a missing
 * required answer to this page (`rsvpGate`, lib/guest-one-path.ts), and this
 * page asks the SAME function which answers are missing — so a question the
 * couple switched on after the guest replied is asked alone, and a guest the
 * couple already marked attending sees "The couple has you down as attending ✓"
 * with only the details still missing.
 *
 * The write is `RsvpWidget` → `submitInviteReply` → `submitRsvp`, the same save
 * the Event Hub's own card makes, with every guard it carries.
 */
export default async function InviteReplyPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;

  const admin = createAdminClient();
  const { data: liveEvent, error: eventError } = await admin
    .from('events')
    .select(
      `event_id, public_id, slug, display_name, event_date, event_date_precision, venue_name, guest_list_edit_deadline, guest_count_locked_at, rsvp_ask_config, monogram_studio_config, ${INVITE_LOOK_COLUMNS}, ${INVITE_MARK_COLUMNS}`,
    )
    // `.ilike`, NOT `.eq` — the same case-insensitive match as `/[slug]/invite`.
    .ilike('slug', slug)
    .maybeSingle();
  if (eventError) {
    throw new Error(`invite/reply: could not read the event for "${slug}": ${eventError.message}`);
  }
  if (!liveEvent?.slug) notFound();

  /* 🗳 THE MAKER'S RSVP CANVAS (owner 2026-09-27: "the slides showing doesn't
     seem to follow the what to add"). `?editor=1` from a VERIFIED host of this
     event — the same door the Event Hub canvas uses, never the param alone —
     draws this page for a SAMPLE guest who has not replied, wearing the
     couple's DRAFT (`overlayHubDraftEvent`), so every "What do you ask your
     guests?" switch and "Ask one question at a time" shows before Apply. No
     guest row is read and nothing is written for the sample. */
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

  // The KEY is the gate: the browser's guest pass for THIS event, or the seat a
  // signed-in account holds on it (the page that redirects here recognises
  // both, so this page must too — otherwise a signed-in guest on a new phone
  // would be bounced between the two). No key → the event page, where a
  // stranger gets the one "Get inside" button.
  const session = canvas ? null : await readGuestSessionForEvent(event.event_id as string);
  if (!canvas && !session) redirect(`/${home}`);

  const { data: guest, error: guestError } = canvas
    ? {
        data: {
          // A real person from THIS event's list — name and plus-one allowance
          // only (owner 2026-09-27: "each editor of each event will adapt to
          // their event"); the sample's id, so nothing is written for them.
          ...rsvpCanvasGuestFor(await loadPreviewPerson(admin, liveEvent.event_id as string)),
          plus_one_name_confirmed_at: null as string | null,
        },
        error: null,
      }
    : await admin
    .from('guests')
    .select(
      'guest_id, first_name, last_name, display_name, role, side, group_category, plus_one_of_guest_id, plus_one_mode, plus_one_name_confirmed_at, plus_one_allowed, plus_one_count, plus_one_name, rsvp_status, meal_preference, dietary_restrictions, guest_note, custom_tags, qr_token, photo_url, photo_source, email, mobile',
    )
    .eq('guest_id', session!.guest_id)
    .eq('event_id', event.event_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (guestError) {
    throw new Error(`invite/reply: could not read guest ${session?.guest_id}: ${guestError.message}`);
  }
  if (!guest) redirect(`/${home}`);

  // A TBA plus-one confirms their own name first — the same routing the Event Hub does.
  const isUnconfirmedTba =
    guest.plus_one_of_guest_id !== null &&
    !guest.plus_one_name_confirmed_at &&
    (!guest.first_name || String(guest.first_name).toLowerCase() === 'tba');
  if (isUnconfirmedTba) redirect(`/${home}/welcome`);

  const [words, faceTagging, supabase, hub, seats, animationOwned] = await Promise.all([
    eventWordsFor(event.event_type as string),
    resolveFaceTagging(admin, event.event_id as string),
    createClient(),
    wearTheHub(slug, admin, hostDraft, canvas),
    canvas ? Promise.resolve([]) : plusOneSeatsFor(admin, event.event_id as string, guest.guest_id as string),
    // The hero's own gate for a moving mark (`loadMedia` → `animatedMonogram`).
    eventAnimatedMonogramActive(admin, event.event_id as string).catch(() => false),
  ]);
  // ▶ The crest plays the couple's layered logo exactly when the Event Hub hero
  // would: the animation is owned AND not switched to "Use Static Image".
  const markPlays = animationOwned && !markAnimationSwitchedOff(event.monogram_studio_config);
  const {
    data: { user: signedIn },
  } = await supabase.auth.getUser();
  // The host looking at the sample is not the guest — never prefill from them.
  const user = canvas ? null : signedIn;

  const replyLocked = guestListIsClosed({
    lockedAt: event.guest_count_locked_at as string | null,
    editDeadline: event.guest_list_edit_deadline as string | null,
    eventDate: event.event_date as string | null,
  });
  const ask = resolveRsvpAsk(event.rsvp_ask_config);
  const gate = canvas ? ({ kind: 'inside', didntReply: false } as const) : rsvpGate({
    rsvpStatus: guest.rsvp_status as string | null,
    mealPreference: guest.meal_preference as string | null,
    mobile: guest.mobile as string | null,
    askMeal: ask.meal,
    askMobile: ask.mobile,
    locked: replyLocked,
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

  const flash =
    search.rsvp === 'error'
      ? {
          tone: 'error' as const,
          text: 'We could not save your reply just now. Please try again — it has not been recorded yet.',
        }
      : search.rsvp === 'choose'
        ? {
            tone: 'error' as const,
            text: 'Please choose whether you will be there — yes or no. Your reply has not been saved yet.',
          }
      : search.rsvp === 'terms'
        ? {
            tone: 'error' as const,
            text: 'Please tick “I agree to the Terms” to send your reply — it has not been sent yet.',
          }
        : null;

  /* ── THE WAY ONWARD FOR SOMEBODY WHO HAS ALREADY ANSWERED ────────────────
     A returning guest who opens the RSVP tab to change something has a way on
     without re-sending the form: the thank-you screen (door 03), where their
     plus-ones' invites and "Save to my account" live. Offered only once there
     IS an answer to stand on — a guest the key gate sent here has not got one. */
  const hasAnswered = gate.kind === 'inside' && ((guest.rsvp_status as string | null) ?? 'pending') !== 'pending';

  // "Reply by" — the SAME date the couple sees on the Maker's RSVP page
  // (`resolveReplyBy`, lib/rsvp-ask.ts: their own deadline, else 30 days before
  // — owner 2026-09-26 "yes to all" (d)). Never shown once the list is locked.
  const replyBy = replyLocked
    ? null
    : resolveReplyBy({
        deadline: event.guest_list_edit_deadline as string | null,
        eventDate: event.event_date as string | null,
      });
  // ONE date formatter on this page (guest text audit 2026-09-30): the event
  // date above reads "Friday, December 18, 2026" (`formatEventDateWithPrecision`
  // via `joinDoorMeta`), and the reply-by line read "18 December" in a second
  // locale. Both now come from the same function.
  const closesLabel = replyBy ? formatEventDateWithPrecision(replyBy.date, 'day') || null : null;

  const guestName =
    (guest.display_name as string | null)?.trim() ||
    `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() ||
    'Your reply';

  /* 📐 ONE QUESTION PER SCREEN (owner 2026-09-29: "ask one question per screen
     is not neatly arranged. there are rules for like this, where the progress
     bar should be, where the logo, and questions"). With the switch on, the
     progress goes UNDER THE COUPLE'S MARK (DoorShell `lead`), and the facts
     below it — the invitation's heading, whose reply this is, the reply-by
     line — show on the first screen only, folding to one line after it. The
     walker (`RsvpOneAtATime`) finds both through the door that carries the
     `lead`. With the switch off, none of this renders and the page is exactly
     as before. */
  const oneAtATime = askOneAtATime(event.rsvp_ask_config);
  /* 🗳 On the Maker's RSVP stage the switch is flipped LIVE (rsvp-canvas-bridge.tsx),
     so the canvas always draws the one-question scaffolding — inert while the
     walker is off. A guest's page draws it only when the switch is on. */
  const oneQuestionFrame = oneAtATime || canvas;

  return (
    /* 🎨 THE EVENT HUB'S LOOK AND GROUND (owner 2026-09-28: "background should
       follow the background of the event hub"). The guest-tree layout leaves
       `/invite/*` undressed (`SEGMENTS_THAT_DRESS_THEMSELVES`), so this page
       wears the look itself — the SAME translation the layout and the host
       canvas use (`lookScopeProps`) — and lays the Main background over it.
       `hubDoorSkin` keeps the card a card and paints nothing behind it. */
    <GuestLookScope {...lookScopeProps(hub.look)}>
      {hub.ground}
      <DoorShell
        eyebrow="You’re invited"
        title={(event.display_name as string | null) || guestName}
        meta={joinDoorMeta({
          event_date: event.event_date as string | null,
          event_date_precision: event.event_date_precision as string | null,
          venue_name: event.venue_name as string | null,
        })}
        width="lg"
        skin={hubDoorSkin({ ...doorMarkFor(event), animate: markPlays })}
        lead={oneQuestionFrame ? <div data-rsvp-progress-slot="" /> : undefined}
      >
        {canvas ? <RsvpCanvasBridge /> : null}
        {oneQuestionFrame ? (
          <p hidden data-rsvp-context-line="" className="truncate text-sm text-ink/70">
            {[event.display_name as string | null, `for ${guestName}`].filter(Boolean).join(' · ')}
          </p>
        ) : null}
        {/* Whose reply this is — and, on a phone a family shares, the way out. */}
        <FirstScreenOnly on={oneQuestionFrame}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="font-serif text-lg text-ink" data-reply-for="">
              {guestName}
            </p>
            {canvas ? null : <NotYouSwitch slug={home} />}
          </div>
        </FirstScreenOnly>

        {hasAnswered ? (
          <FirstScreenOnly on={oneQuestionFrame}>
            <DoorNotice>
              Your reply is saved.{' '}
              <Link
                className="font-medium text-link underline-offset-2 hover:underline"
                href={inviteEnterPath(home)}
              >
                Open your invitation and your QR
              </Link>
              {replyLocked ? null : <> &mdash; or change your answer below.</>}
            </DoorNotice>
          </FirstScreenOnly>
        ) : closesLabel && (guest.rsvp_status as string | null) === 'pending' ? (
          <FirstScreenOnly on={oneQuestionFrame}>
            <p className="text-sm text-ink/70" data-rsvp-word={canvas ? rsvpWordBridgeKey('reply-by') : undefined}>
              Please reply by {closesLabel}.
            </p>
          </FirstScreenOnly>
        ) : null}

        <RsvpWidget
          words={words}
          guest={{
            ...(guest as unknown as GuestRow),
            // One set of boxes per seat (+1…+4): name, meal, dietary. Never the
            // seat's key — that is for the thank-you's "Send their invite".
            plus_one_seats: seats.map((s) => ({
              guest_id: s.guest_id,
              name: s.name,
              first: s.first,
              last: s.last,
              prefix: s.prefix,
              middle: s.middle,
              suffix: s.suffix,
              meal: s.meal,
              dietary: s.dietary,
              linked: s.linked,
            })),
          }}
          eventId={event.event_id as string}
          eventPublicId={event.public_id as string}
          faceMode={faceTagging.mode}
          flash={flash}
          replyLocked={replyLocked}
          profileDetails={profileDetails}
          doorAction={submitInviteReply.bind(null, event.event_id as string, guest.guest_id as string)}
          /* 🏷 THE QUESTION AT THE INVITATION, THE SELFIE ON THE DAY (owner
             2026-09-30, "go"; DECISION_LOG "THE TAGGING QUESTION AT RSVP, THE
             SELFIE ON THE DAY"). The invite asks "Want to be tagged in the
             photos?" and saves the answer — no camera is drawn here, and the
             save strips any face field (`stripInviteFaceFields`), so the
             2026-09-11 rule "face tagging happens on the day, not on the invite"
             holds for face DATA. On the day `day-of-face-enroll.tsx` asks only a
             guest who said Yes for the selfie, and never one who said No. The
             couple's own decline (`askable`) hides the question altogether. */
          offerSelfie={faceTagging.askable ? 'question' : false}
          ask={resolveRsvpAsk(event.rsvp_ask_config)}
          gate={gate.kind === 'ask' ? { missing: gate.missing, coupleMarked: gate.coupleMarked } : null}
          termsOnSend
          oneAtATime={askOneAtATime(event.rsvp_ask_config)}
          previewEveryQuestion={canvas}
          answerWords={readRsvpWords(event.rsvp_ask_config)}
        />
      </DoorShell>
    </GuestLookScope>
  );
}

/**
 * THE EVENT HUB'S LOOK AND MAIN BACKGROUND, for the RSVP page.
 *
 *   · the look — for a guest, `loadGuestLook(slug)`: the very value the
 *     guest-tree layout wears on every Event Hub page (and `cache()`d, so it
 *     costs nothing — the layout already asked). On the Maker's canvas, when the
 *     couple's DRAFT holds a Colors-panel column, it is re-resolved from the
 *     drafted row exactly as the Event Hub canvas does (`guestLookFrom(…, true)`,
 *     app/[slug]/page.tsx), so a colour tried in the Maker shows here before
 *     Apply.
 *   · the ground — `mainGroundLayerFor`, the helper the Event Hub body itself
 *     calls, over the (draft-overlaid) hero row. Pro themes only, by the one
 *     page-ground rule.
 *
 * ⚖ BEST-EFFORT, LIKE THE LAYOUT'S LOOK. A background that cannot be read
 * renders the page in the house look — never takes the reply form down.
 */
async function wearTheHub(
  slug: string,
  admin: ReturnType<typeof createAdminClient>,
  hostDraft: Awaited<ReturnType<typeof loadHostPreviewDraft>>,
  viewerIsHost: boolean,
): Promise<{ look: GuestLook | null; ground: React.ReactNode }> {
  try {
    const shell = await loadEventShell(slug);
    if (!shell?.event_id) return { look: null, ground: null };
    const row = overlayHubDraftEvent(shell as Record<string, unknown>, hostDraft) as EventShellRow;
    const draftsLook = Boolean(hostDraft && HUB_DRAFT_LOOK_COLUMNS.some((c) => c in hostDraft.events));
    const look = draftsLook
      ? guestLookFrom(row, await resolveHubTheme(row), true)
      : await loadGuestLook(slug);
    if (!look?.theme) return { look, ground: null };
    const widgets = overlayHubDraftWidgets(await loadWidgets(admin, shell.event_id), hostDraft);
    const ground = await mainGroundLayerFor({
      theme: look.theme,
      heroConfig: widgets.find((w) => w.widget_type === 'hero')?.config_json,
      event: row,
      viewerIsHost,
    });
    return { look, ground };
  } catch {
    return { look: null, ground: null };
  }
}

/**
 * What only the FIRST one-question screen shows (`data-rsvp-context`) — the
 * walker folds it to one line from screen 2. Off, a bare fragment: the page is
 * exactly as before.
 */
function FirstScreenOnly({ on, children }: { on: boolean; children: React.ReactNode }) {
  return on ? <div data-rsvp-context="">{children}</div> : <>{children}</>;
}
