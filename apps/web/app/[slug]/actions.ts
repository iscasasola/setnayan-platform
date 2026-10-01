'use server';

import { redirect } from 'next/navigation';
import { lockLinkedSeatNames, planSeatNames, readSeatNames, seatNamePartColumns, type ExtraSeatRow } from '@/lib/extra-seats';
import { plusOneSeats } from '@/lib/guests';
import { SEAT_NAME_DID_NOT_SAVE, SEAT_NAME_MISSING } from '@/lib/seat-name-words';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';

import { everyCopyIsNowStale } from '@/lib/a-withdrawal-reaches-every-copy.server';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import { logQueryError } from '@/lib/supabase/error-detect';
import { executeCleanupDelete } from '@/lib/cleanup-delete';
import { planFaceSelfieDelete } from '@/lib/face-data-retention-core';
import { createAdminClient } from '@/lib/supabase/admin';
import { guestListIsClosed } from '@/lib/guest-list-closed';
import { guestDetailsChanged } from './_lib/guest-details-changed';
import { createClient } from '@/lib/supabase/server';
import { readGuestSession, setGuestSession } from '@/lib/guest-session';
import { inviteEnterPath, inviteReplyPath, isInviteReturn } from '@/lib/invite-arrival';
import { takePhotoOffTheWall, putPhotoBackOnTheWall } from '@/lib/guest-wall-unpost';
import { applyReconcileForEvent } from '@/lib/seating-reconcile';
import { emitNotification } from '@/lib/notification-emit';
import { readGuestSessionForEvent } from '@/lib/guest-one-path.server';
import { findGuestSeatForUser } from '@/lib/guest-membership-session';
import { linkGuestSessionToUser } from '@/lib/link-guest-account';
import {
  RSVP_TERMS_COOKIE,
  RSVP_TERMS_COOKIE_MAX_AGE,
  TERMS_FIELD,
  TERMS_VERSION,
  hasAgreedToTerms,
  rsvpTermsCarried,
} from '@/lib/terms-agreement';
import { saveMethodFor, saveMethodSignsIn } from '@/lib/guest-one-path';
import { envFlagEnabled } from '@/lib/env-flag';
import { signInWithApple, signInWithGoogle } from '@/app/auth/oauth-actions';
import { eventConnectPath } from '@/lib/signup-landing';
import { applyTick, isChecklistKey } from '@/lib/guest-checklist';
import { moderateKwentoText } from '@/lib/kwento-moderation';
import { SONG_ARTIST_MAX, SONG_TITLE_MAX } from '@/lib/guest-song-request-rule';
import { cookies, headers } from 'next/headers';
import type { MealPreference, RsvpStatus } from '@/lib/guests';
import { resolveRsvpAsk } from '@/lib/rsvp-ask';
import { FACE_TAGGING_FIELD, SELFIE_DELETE_FIELD, parseFaceTaggingAnswer, stripInviteFaceFields } from '@/lib/face-tagging-wish';

const RSVP_VALUES: RsvpStatus[] = ['pending', 'attending', 'declined', 'maybe'];
const MEAL_VALUES: MealPreference[] = [
  'beef',
  'chicken',
  'fish',
  'vegetarian',
  'vegan',
  'kids',
  'no_preference',
];

function clean(value: FormDataEntryValue | null): string {
  return value ? String(value).trim() : '';
}

/**
 * Invite/Join v2 — a guest saves a vendor they liked at this event to THEIR own
 * account, for future planning (`guest_saved_vendors`). Account-required: it's a
 * personal bookmark, so an accountless guest is routed to make one (the
 * claim-account box on the page). Idempotent (one bookmark per vendor per user).
 */
export async function saveAttendedVendorAction(
  eventId: string,
  slug: string,
  vendorProfileId: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    // No real account (signed-out OR an unsecured anon-draft) → can't bookmark
    // for "their future plans" yet; nudge them to make/secure one. Saving a
    // vendor persists vendor-discovery intent to the user, so an anon guest
    // converts first via the page's claim-account box.
    return redirect(`/${slug}?save=needs_account`);
  }
  if (!vendorProfileId) {
    return redirect(`/${slug}?save=error`);
  }

  const admin = createAdminClient();
  const { error } = await admin.from('guest_saved_vendors').upsert(
    { user_id: user.id, vendor_profile_id: vendorProfileId, source_event_id: eventId },
    { onConflict: 'user_id,vendor_profile_id', ignoreDuplicates: true },
  );
  if (error) console.error('[supabase-error] app/[slug]/actions.ts · from:guest_saved_vendors.upsert', error);

  return redirect(`/${slug}?save=${error ? 'error' : 'ok'}`);
}

/** The event's own address, from the DATABASE — never a bound or posted value. */
async function eventHome(eventId: string): Promise<string> {
  const { data } = await createAdminClient()
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();
  const slug = ((data?.slug as string | null) ?? '').trim();
  return slug ? `/${slug}` : '/';
}

/**
 * "SAVE TO MY ACCOUNT" — the one press on the thank-you, Me, the Event Hub's
 * account card and the plus-one's welcome (owner 2026-09-26/27).
 *
 * 📵 IT SENDS NO EMAIL (owner 2026-09-29, DECISION_LOG "NO EMAIL TO GUESTS — THE
 * QR AND THE LINK DO EVERYTHING"). This used to be `claimAccountAction`, which
 * emailed a passwordless sign-in link. Now it is the device's provider and
 * nothing else — Apple on an iPhone, Google elsewhere (`saveMethodFor`,
 * re-decided HERE from the request, never from the form). Inside an in-app
 * browser there is no press to post: the page draws "Open in your browser"
 * (a copy of the guest's own link) instead, so a POST from one is sent back.
 *
 * 🔒 The Terms tick is the affirmative act (lib/terms-agreement.ts): this CREATES
 * an account, so it takes the tick on THIS form or the one given on the RSVP
 * page a screen earlier (the server-set cookie, never a hidden field) — and the
 * tick is carried into the provider round-trip by that same cookie, which the
 * OAuth callback records (app/auth/callback/route.ts).
 */
export async function startAccountSaveAction(eventId: string, _slug: string, formData: FormData) {
  const home = await eventHome(eventId);
  const fromThankYou = isInviteReturn(formData.get('return_to')) && home !== '/';
  const back = fromThankYou ? inviteEnterPath(home.slice(1)) : home;
  const session = await readGuestSessionForEvent(eventId);
  if (!session) return redirect(home);
  const jar = await cookies();
  const tickedHere = hasAgreedToTerms(formData.get(TERMS_FIELD));
  if (!tickedHere && !rsvpTermsCarried(jar.get(RSVP_TERMS_COOKIE)?.value)) {
    return redirect(`${back}?keep=terms`);
  }
  if (tickedHere) {
    jar.set(RSVP_TERMS_COOKIE, TERMS_VERSION, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: RSVP_TERMS_COOKIE_MAX_AGE,
    });
  }
  const method = saveMethodFor((await headers()).get('user-agent'), {
    apple: envFlagEnabled(process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED),
    google: envFlagEnabled(process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED),
  });
  if (!saveMethodSignsIn(method)) return redirect(back);
  const next = new FormData();
  next.set('next', eventConnectPath(eventId));
  return method === 'apple' ? signInWithApple(next) : signInWithGoogle(next);
}

/**
 * "This is me" for a guest who is ALREADY SIGNED IN and holds this invitation's
 * pass in this browser, but whose seat is not yet bound to the account — one
 * press, no email. Uses the canonical binder (`linkGuestSessionToUser`), which
 * refuses a seat another account already holds.
 *
 * 🔒 ON PURPOSE, AND ASKED (2026-09-30). The button that posts here reads
 * "This invitation is for <name>. Save it to <email>?" (`seatConfirmLine`), and
 * the binder is told THIS event, so a pass for another celebration binds
 * nothing. A couple seat this account may not hold comes back `couple_seat`
 * and the page says so in plain words (`?keep=couple_seat`).
 */
export async function linkThisSeatAction(eventId: string) {
  const home = await eventHome(eventId);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const session = await readGuestSession();
  if (!user || !session || session.event_id !== eventId) return redirect(home);
  const result = await linkGuestSessionToUser(user.id, { eventId });
  revalidatePath(home);
  if (result.reason === 'couple_seat') return redirect(`${home}?keep=couple_seat`);
  return redirect(home);
}

/**
 * A signed-in guest recognised by their SEAT (no cookie for this event) gets the
 * guest pass written into this browser, so the sub-pages that still read the
 * cookie (seat, camera, find-my-table) know them too.
 *
 * 🔒 WHY THIS IS SAFE WHERE `/{slug}/enter` WAS NOT. That route was a GET behind a
 * `<Link>`, and a prefetch ran it when a board card scrolled past. This is a
 * Server Action, invoked only by `AdoptSeatSession` on MOUNT — a prefetch never
 * mounts a component — and the render it follows already shows the guest their
 * own page without it, so nothing about what they SEE depends on the write.
 * It writes only the seat THIS account holds (`findGuestSeatForUser`, the same
 * scoped lookup the page's gate uses), and leaves a cookie that already names
 * this event alone. Same mint as the join door's `enterAsGuest`.
 */
export async function adoptSeatSessionAction(eventId: string): Promise<void> {
  const current = await readGuestSession();
  if (current && current.event_id === eventId) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const seat = await findGuestSeatForUser(eventId, user.id);
  if (!seat) return;
  await setGuestSession({ guest_id: seat.guestId, event_id: eventId, qr_token: seat.qrToken });
}

export async function submitRsvp(
  eventId: string,
  guestId: string,
  formData: FormData,
): Promise<void> {
  // Posted by the invite arrival's Reply door (lib/invite-arrival.ts). A KEYWORD,
  // never a path: every destination below is built from the slug the DATABASE
  // returns, so no form can steer where this action sends anyone.
  const toInvite = isInviteReturn(formData.get('return_to'));
  // The browser's pass for this event, or — for a signed-in guest on a new phone
  // — the seat their account holds (lib/guest-one-path.server.ts). Either way it
  // must be THIS guest on THIS event, exactly as before.
  const session = await readGuestSessionForEvent(eventId);
  if (!session || session.event_id !== eventId || session.guest_id !== guestId) {
    // Session got out of sync — kick them back to the slug landing (or, from
    // the arrival, back to its first door, where they can find themselves again).
    const admin = createAdminClient();
    const { data: ev } = await admin
      .from('events')
      .select('slug')
      .eq('event_id', eventId)
      .maybeSingle();
    redirect(ev?.slug ? (toInvite ? `/${ev.slug}/invite` : `/${ev.slug}`) : '/');
  }

  // 📵 No reply carries a face (owner 2026-09-30): every selfie field a crafted
  // post could carry is dropped before anything reads the form. The answer
  // (`face_tagging`) and "No thanks — delete my selfie" (`delete_selfie`, which
  // only ever REMOVES face data) pass through.
  stripInviteFaceFields(formData);

  /*
    ☑ "YOUR CHECKLIST" — ONE TICK (owner 2026-09-26: ticks saved to the GUEST,
    private to them, and the save must reuse an existing guest save action — +0
    server actions). This IS the guest's own save, already bound to THIS guest on
    THIS event and already checked against their key above, so the tick rides it
    as its own branch and returns before anything of the reply is touched: no
    answer, no meal, no contact detail is read from this form or written.
    Service-role write into `guest_checklist_ticks`, which no browser role can
    read — the couple never sees per-guest ticks.
  */
  const checklistItem = clean(formData.get('checklist_item'));
  if (checklistItem) {
    if (!isChecklistKey(checklistItem)) throw new Error('Unknown checklist item');
    const done = clean(formData.get('checklist_done')) === '1';
    const tickAdmin = createAdminClient();
    const { data: row, error: readErr } = await tickAdmin
      .from('guest_checklist_ticks')
      .select('ticks')
      .eq('guest_id', guestId)
      .maybeSingle();
    if (readErr) throw new Error('Could not read your checklist');
    const { error: tickErr } = await tickAdmin.from('guest_checklist_ticks').upsert(
      {
        guest_id: guestId,
        event_id: eventId,
        ticks: applyTick((row?.ticks as string[] | null) ?? [], checklistItem, done),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'guest_id' },
    );
    // THROWN, not swallowed: the tick on screen puts itself back and says so.
    if (tickErr) throw new Error('Could not save your checklist');
    return;
  }

  /*
    👥 "ADD NAME" IN PLACE, ON ME (owner 2026-09-29, prototype frame E: *"No new
    page. Tapping 'Add name' on +2 unfolds the same four boxes under the row"*).
    The same guest's own save, already matched to THIS guest on THIS event
    above, so naming a seat rides it as its own branch — +0 server actions, the
    checklist tick's precedent — and returns before anything of the reply is
    read or written: no answer, none of the guest's own meal or contact details.
    The seat rule is the reply's own (`nameTheSeats`: the entitlement re-read,
    the couple's switches, only THIS guest's seats). THROWN on failure, so the
    boxes stay open and say so — never a closed form that looks saved. (It
    cannot RETURN a reason: this is the reply form's own action, typed
    `Promise<void>` for `<form action>`. `add-name-in-place.tsx` names the real
    reason from what reaches it — guest text audit 2026-09-30.)
  */
  if (clean(formData.get('seat_names_only')) === '1') {
    const seatAdmin = createAdminClient();
    const { data: evAsk, error: evAskErr } = await seatAdmin
      .from('events')
      .select('slug, rsvp_ask_config')
      .eq('event_id', eventId)
      .maybeSingle();
    if (evAskErr || !evAsk) throw new Error(SEAT_NAME_DID_NOT_SAVE);
    const saved = await nameTheSeats(seatAdmin, eventId, guestId, formData, resolveRsvpAsk(evAsk.rsvp_ask_config));
    if (!saved.ok) throw new Error(saved.error);
    if (saved.named === 0) throw new Error(SEAT_NAME_MISSING);
    revalidatePath(`/dashboard/${eventId}/guests`);
    // Me re-renders with the seat NAMED — "Send their invite · Show pass".
    if (evAsk.slug) revalidatePath(`/${evAsk.slug}`);
    return;
  }

  const status = clean(formData.get('rsvp_status')) as RsvpStatus;
  const meal_raw = clean(formData.get('meal_preference'));
  const meal = (meal_raw || 'no_preference') as MealPreference;
  const dietary = clean(formData.get('dietary_restrictions')) || null;
  // ⚠ `guest_note`, NOT `notes`. `guests.notes` is the COUPLE'S private note
  // about this guest; this action runs as the GUEST. Until 2026-08-06 it read
  // `notes` from the form and wrote it straight back, so every RSVP erased what
  // the couple had written about that person.
  const guestNote = clean(formData.get('guest_note')) || null;
  // The guest's OWN contact details. Named `contact_*` on the form so nothing
  // here can ever collide with the sign-in-link box elsewhere on this page,
  // which posts `email` to a completely different action.
  const contactMobile = clean(formData.get('contact_mobile')) || null;
  const contactName = clean(formData.get('contact_display_name')) || null;

  if (meal && !MEAL_VALUES.includes(meal)) {
    return;
  }

  const admin = createAdminClient();

  // ── ONLY THE ANSWER FREEZES ───────────────────────────────────────────────
  // Owner, 2026-08-20: the invitation link exists so guests "update their
  // info", so the host can "see who will go and not go", and so guests can
  // preview the event hub. Once the guest list is final only the MIDDLE one is
  // settled. The other two are the reason the link exists at all.
  //
  // 🔑 THIS FORM IS NOT A HEADCOUNT. It carries five things and only one is
  // the count: the answer · the selfie that makes their photos findable ·
  // their meal · their dietary notes · a note to the host. The list finalizes
  // about two weeks out — exactly when "nut allergy" matters most. So a closed
  // list drops the ANSWER from this write and saves everything else.
  //
  // 🔑 AND THE DATABASE WILL NOT DRAW THIS LINE FOR US.
  // `guard_guest_edits_when_locked` draws it correctly — it blocks only
  // count-affecting writes and lets meal / photo / seating through by design —
  // but its first branch exempts `auth.role() = 'service_role'`, and this
  // action writes with the ADMIN client. Its own header names "the guest
  // self-RSVP portal" as a path it covers; that is the one path it cannot fire
  // on. Until that is reconciled at the database, this IS the enforcement.
  const { data: evRsvp } = await admin
    .from('events')
    .select('slug, event_date, guest_list_edit_deadline, guest_count_locked_at, rsvp_ask_config')
    .eq('event_id', eventId)
    .maybeSingle();
  const replyLocked = guestListIsClosed({
    lockedAt: evRsvp?.guest_count_locked_at,
  });
  // ⚙ WHAT DO YOU WANT TO ASK YOUR GUESTS? (owner 2026-09-25) — re-read here,
  // never trusted from the form: the widget only decides what RENDERS, this
  // decides what is ENFORCED. A field that is off is ignored below even when a
  // crafted POST carries a value for it — never required, never applied.
  const ask = resolveRsvpAsk(evRsvp?.rsvp_ask_config);

  // A locked reply renders NO rsvp_status control, so an ordinary save posts
  // nothing here — and the old `!RSVP_VALUES.includes(status) → return` would
  // then drop the guest's meal and allergy on the floor IN SILENCE. The status
  // check therefore only guards the path that actually writes a status.
  if (!replyLocked && !RSVP_VALUES.includes(status)) {
    return;
  }

  // Did somebody POST a DIFFERENT answer into a closed list — a tab that was
  // open when the deadline passed, or a crafted request? Then say so. A submit
  // that quietly ignores half of what was sent is indistinguishable from one
  // that worked.
  //
  // ⚠ It must be a real CHANGE. A stale tab still carries the guest's own
  // answer pre-checked, so it reposts it unchanged on an ordinary details save
  // — telling that guest "your reply was refused" would be alarming and false.
  // The stored values BEFORE this write — the only way to tell a real change
  // from an idle Save. Every field on the reply card is `defaultValue=`, so a
  // guest who opens the card and taps Save reposts their own answer, meal,
  // allergy and note byte-for-byte.
  // ⚠ A READ, deliberately — never a write. The guard in
  // only-the-answer-freezes.test.ts locates the answer-freezing statement by
  // finding the first writing call after the closed-list check, so a write here
  // would silently retarget it onto the wrong one.
  // 🪤 And this comment may not SPELL that call: naming it here is enough for
  // the guard to find the comment instead of the code, which is how an earlier
  // draft of this very note turned the guard red.
  const { data: before } = await admin
    .from('guests')
    .select('rsvp_status, rsvp_responded_at, meal_preference, dietary_restrictions, guest_note, email, mobile, display_name, role, extra_roles')
    .eq('guest_id', guestId)
    .eq('event_id', eventId)
    .maybeSingle();

  // ⚖ NO MIDDLE ANSWER FROM A GUEST (owner 2026-09-30: "for now. let us fix the
  // RSVP remove the maybe"). The card offers only yes / no, so a NEW 'maybe'
  // arrives only from a stale tab or a crafted post — refused, nothing written,
  // and the guest is sent back to the card with a sentence asking them to pick
  // one. ⚠ Only a CHANGE to 'maybe' is refused: a guest ALREADY saved as maybe
  // (their row is left alone) reposts it unchanged from the missing-details
  // card's hidden field, and that save must still land. The column and its
  // CHECK are untouched — the couple's Guest list can still set 'maybe'.
  if (!replyLocked && status === 'maybe' && before?.rsvp_status !== 'maybe') {
    if (toInvite && evRsvp?.slug) redirect(`${inviteReplyPath(evRsvp.slug)}?rsvp=choose`);
    redirect(evRsvp?.slug ? `/${evRsvp.slug}?rsvp=choose` : '/');
  }

  let answerRefused = false;
  if (replyLocked && RSVP_VALUES.includes(status)) {
    answerRefused = Boolean(before) && before!.rsvp_status !== status;
  }

  /**
   * 📵 THE REPLY NO LONGER CARRIES AN EMAIL (owner 2026-09-29, DECISION_LOG "NO
   * EMAIL TO GUESTS — THE QR AND THE LINK DO EVERYTHING": *"No email. Either use
   * the qr and link only"*). The form has no email box and this action reads
   * none, so a guest's reply can neither set nor clear `guests.email` — whatever
   * the couple recorded stays exactly as it is. (Superseded: the 2026-08-23
   * "No for email, yes for the rest" rule about a guest changing the address.)
   */
  /** What the row will actually hold afterwards — the change report must agree. */
  const storedEmail = (before?.email as string | null) ?? null;

  /**
   * ⚙ WHAT DO YOU WANT TO ASK YOUR GUESTS? (owner 2026-09-25) — an OFF field is
   * ignored: the write below keeps whatever is already stored, as if the guest
   * had reposted their own unchanged answer, never the value a crafted POST
   * (or a stale client) happens to carry for a question the couple stopped asking.
   *
   * 🪤 RESOLVED HERE, NOT INLINE IN THE PAYLOAD. `only-the-answer-freezes.test.ts`
   * finds each of these fields by the LINE that names it inside `.update({`
   * and requires that line to carry neither `replyLocked` nor `?` — a ternary
   * on the payload line itself would read, to that guard, exactly like the
   * answer-freeze it exists to catch. Resolving the value up here keeps every
   * payload line below a plain assignment; the ask gate lives in these four.
   */
  // ⚠ A switched-off question with a FAILED `before` read resolves to
  // `undefined`, which the update drops from the payload — the stored answer is
  // left alone. Falling back to `null` there would erase what the guest gave
  // earlier because a read failed (the same rule `emailWrite` keeps).
  const mealToWrite = ask.meal ? meal : before ? ((before.meal_preference as MealPreference | null) ?? meal) : undefined;
  const dietaryToWrite = ask.dietary ? dietary : before ? ((before.dietary_restrictions as string | null) ?? null) : undefined;
  const guestNoteToWrite = ask.note ? guestNote : before ? ((before.guest_note as string | null) ?? null) : undefined;
  const mobileToWrite = ask.mobile ? contactMobile : before ? ((before.mobile as string | null) ?? null) : undefined;

  const { error } = await admin
    .from('guests')
    .update({
      // The count is frozen: the stored answer is left exactly as it is.
      ...(replyLocked
        ? {}
        : {
            rsvp_status: status,
            // 🔴 ONLY A CHANGED ANSWER MOVES THE DATE. Every field on this card
            // is `defaultValue=`, so a guest correcting their phone number
            // reposts the answer they already gave — and this used to restamp
            // it as though they had just replied. The host's twin of this bug
            // was fixed the same day; this is the guest-side one.
            // An unchanged answer keeps its own date, INCLUDING null: stamping
            // an untouched answer invents one.
            // ⚖ A failed `before` read stamps, deliberately — a stale date is
            // wrong, a deleted date is gone.
            rsvp_responded_at:
              status === 'attending' || status === 'declined'
                ? before?.rsvp_status === status
                  ? ((before?.rsvp_responded_at as string | null) ?? null)
                  : new Date().toISOString()
                : null,
          }),
      meal_preference: mealToWrite,
      dietary_restrictions: dietaryToWrite,
      guest_note: guestNoteToWrite,
      // ⚠ OUTSIDE the frozen branch on purpose. Only the ANSWER freezes: a
      // phone number corrected the week of the event is worth more then than
      // at any other time.
      // 📵 No `email` here — the reply does not collect one (see above).
      mobile: mobileToWrite,
      display_name: contactName,
      updated_at: new Date().toISOString(),
    })
    .eq('guest_id', guestId)
    .eq('event_id', eventId);

  if (error) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Submit guest RSVP',
      file_path: 'app/[slug]/actions.ts',
      error_message: error.message,
      payload_snapshot: { eventId, guestId, status, meal },
    });
    // 🔴 THIS USED TO `return` SILENTLY — "a toast UI lands with the polish
    // pass", which it never did. The guest tapped Save, the button stopped
    // spinning, the page came back looking exactly as before, and nothing was
    // written. They walk away believing they have replied.
    //
    // Nobody finds out. The guest thinks they are counted; the couple's list
    // says they never answered; the caterer's headcount is short by however
    // many people hit a bad second. A silent write failure on an RSVP is the
    // one failure with no natural discovery path — the guest has no reason to
    // check again, and the couple cannot tell "did not reply" from "replied
    // and we dropped it".
    //
    // The fault log is for us. This redirect is for them.
    const { data: evFail } = await admin
      .from('events')
      .select('slug')
      .eq('event_id', eventId)
      .maybeSingle();
    // From the invite arrival, back to the Reply door to try again.
    if (toInvite && evFail?.slug) redirect(`${inviteReplyPath(evFail.slug)}?rsvp=error`);
    redirect(evFail?.slug ? `/${evFail.slug}?rsvp=error` : '/');
  }

  // Smart seat-plan Phase 5 (gap G2): a guest confirming from their own invite
  // should get a seat if they don't have one (e.g. added before any tables
  // existed, or self-joined). Gap-fill only — NO reseat, so a confirmed guest's
  // existing chair never jumps just because they replied. Reconcile on any
  // NON-declined reply (declined is handled DB-side by free_seat_on_decline).
  // Admin client — the guest session has no RLS write on event_seat_assignments.
  // Best-effort; no-op if autoplace is off or they're already seated.
  // ⚠ On a locked save `status` is EMPTY (no control is rendered), and `'' !==
  // 'declined'` is TRUE — so this would run a seat reconcile on every details
  // edit for a finalized event. Harmless but pointless work; the answer, and
  // therefore the seating question, cannot have changed.
  if (!replyLocked && status !== 'declined') {
    await applyReconcileForEvent(admin, eventId);
  }

  // 📵 THE REPLY TAKES NO FACE — ANY REPLY (owner 2026-09-30, DECISION_LOG
  // "THE TAGGING QUESTION IS ASKED AT RSVP; THE SELFIE IS TAKEN ON THE DAY").
  // This action used to enrol a selfie posted with the Event Hub card (source
  // 'rsvp_selfie'), weeks before the day and whether or not Papic was on. The
  // selfie is now taken ONLY by the day-of catch (`enrollGuestFace`), which
  // checks the guest's Yes, Papic and the couple's switch. Face fields a
  // crafted post still carries were stripped at the top of this action.
  // ── "WANT TO BE TAGGED IN THE PHOTOS?" (owner 2026-09-29) ──────────────────
  // The guest's own answer, stored so the day-of catch can honour it: a "No
  // thanks" is never asked again, and only a guest who never answered is asked
  // the one question on the day (lib/face-tagging-wish.ts). Absent (the
  // question was not on this form) → whatever is stored stays.
  let taggingWish = parseFaceTaggingAnswer(formData.get(FACE_TAGGING_FIELD));
  // 🗑 "NO THANKS" AFTER A SELFIE (owner 2026-09-29, OWNER ANSWERS (3)): with a
  // live enrollment, a "No" deletes the selfie and the automatic tags — but ONLY
  // with the one confirm (`SELFIE_DELETE_FIELD`). An unconfirmed "No" changes
  // nothing at all, so a stray tap can never erase a face on its own.
  if (taggingWish === false) {
    const { count: liveSelfies, error: liveErr } = await admin
      .from('guest_face_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .is('revoked_at', null);
    if (liveErr) console.error('[supabase-error] app/[slug]/actions.ts · from:guest_face_enrollments.count', liveErr);
    if ((liveSelfies ?? 0) > 0) {
      if (clean(formData.get(SELFIE_DELETE_FIELD)) === '1') await eraseGuestFaceData(admin, eventId, guestId);
      else taggingWish = undefined;
    }
  }
  if (taggingWish !== undefined) {
    const { error: wishErr } = await admin
      .from('guests')
      .update({ face_tagging_wanted: taggingWish })
      .eq('guest_id', guestId)
      .eq('event_id', eventId);
    if (wishErr) console.error('[supabase-error] app/[slug]/actions.ts · from:guests.update(face_tagging_wanted)', wishErr);
  }

  const { data: ev } = await admin
    .from('events')
    .select('slug, display_name')
    .eq('event_id', eventId)
    .maybeSingle();

  // TELL THE COUPLE WHAT MOVED ON THIS GUEST'S CARD — the answer, or the
  // details only they can act on. emitNotification handles the in-app row and
  // the email; failures here never roll back the RSVP.
  //
  // 🔴 UNTIL 2026-08-21 THIS FIRED ONLY ON `attending` / `declined`, and that
  // omitted far more than "maybe". Once the guest list is final the answer
  // control is not rendered AT ALL, so `status` arrives EMPTY — a guest typing
  // "severe nut allergy" twelve days out reached nobody, in the exact fortnight
  // a caterer needs it. The action already knew the control was gone; every
  // other branch was taught to cope and this one was never revisited.
  //
  // 🔑 AND IT FIRES ON THE CHANGE, NEVER ON THE WRITE. The update above runs on
  // every submit and `updated_at` always moves, while every field on the card
  // is `defaultValue=` — so neither is a change signal. Only the comparison is.
  //
  // ⚠ DELIBERATE REMOVAL: reposting an unchanged `attending` used to notify the
  // couple again. It is now silent. That is the point.
  const changed = guestDetailsChanged(before, {
    // ⚙ `*ToWrite`, not the raw form value — an OFF field's write is a no-op
    // (see the ask-gate comment above `mealToWrite`), so the change report
    // must compare what was actually STORED, or a couple who turned meal off
    // would still be told every guest's meal "changed" to the empty default.
    // `undefined` only when the question is off AND the before-read failed —
    // then nothing was written, and there is no `before` to compare against.
    meal: mealToWrite ?? meal,
    dietary: dietaryToWrite ?? null,
    guestNote: guestNoteToWrite ?? null,
    // What was STORED, not what was posted. A blank box no longer changes the
    // email, so reporting it from `contactEmail` would tell the host a detail
    // moved when the row is untouched.
    email: storedEmail,
    mobile: mobileToWrite ?? null,
    displayName: contactName,
  });
  // Only a change that was actually STORED counts. When the list is locked the
  // answer is not written at all, so a stale tab posting a different one must
  // never be reported to the host as a reply that moved.
  const answerChanged = !replyLocked && before?.rsvp_status !== status;

  if (answerChanged || changed.length > 0) {
    try {
      const { data: guest } = await admin
        .from('guests')
        .select('first_name, last_name, display_name')
        .eq('guest_id', guestId)
        .maybeSingle();
      const guestName =
        (guest?.display_name ?? '').trim() ||
        `${guest?.first_name ?? ''} ${guest?.last_name ?? ''}`.trim() ||
        'A guest';
      // 🪤 'maybe' can reach here now. It never could before, so the old label
      // mapped everything-not-attending to "not attending" — which would report
      // an UNDECIDED guest to the couple as a NO.
      const statusLabel =
        status === 'attending'
          ? 'attending'
          : status === 'declined'
            ? 'not attending'
            : 'undecided';
      const title = answerChanged
        ? `${guestName} RSVP'd: ${statusLabel}`
        : `${guestName} updated their details`;
      const parts: string[] = [];
      // ⚠ EVERY MEMBER OF `changed` MUST PRODUCE A SENTENCE, or the couple gets
      // a heading with nothing under it. Clearing a meal (beef → no preference)
      // used to yield changed=['meal'] and parts=[] — an email whose entire
      // content was "Ana updated their details", from a change the couple can
      // only discover by opening the app. Same missing set/clear branch the
      // dietary line below always had, on a third field.
      if (changed.includes('meal')) {
        parts.push(
          meal !== 'no_preference'
            ? `Meal preference: ${meal}.`
            : 'They cleared their meal preference.',
        );
      }
      // 🔒 THE DIETARY VALUE IS NAMED, NEVER QUOTED. The compliance record
      // classes dietary notes as data that may reveal health or religious
      // belief; the deep link keeps the words inside the app rather than in an
      // inbox.
      if (changed.includes('dietary')) {
        parts.push(dietary ? 'Their dietary notes changed.' : 'They cleared their dietary notes.');
      }
      // ⚠ The note branch must answer the SAME question the dietary branch above
      // already answers: set or CLEARED. It said "They left you a note" either
      // way, so deleting a note sent the couple to open a note that is not
      // there — a trip made for nothing, and the second time it teaches them to
      // ignore the notification.
      if (changed.includes('note')) {
        parts.push(guestNote ? 'They left you a note.' : 'They removed their note.');
      }
      // The three the guest could never give until 2026-08-21. Each says WHICH
      // detail moved and never the value: a phone number and an email address
      // in an inbox are contact data leaving the app, and the deep link keeps
      // them inside it — the same line already drawn on dietary notes.
      if (changed.includes('email')) {
        // ⛔ NO REMOVAL BRANCH, AND ITS ABSENCE IS THE POINT. Since the owner's
        // 2026-08-23 ruling an empty box leaves the stored address alone, so a
        // change here can only be an address arriving or being replaced. A
        // "They removed their email." line would narrate a state the data can
        // no longer reach — the data changing while the words stay put is the
        // half-done shape this project keeps paying for.
        parts.push(
          before?.email ? 'They updated their email.' : 'They added their email.',
        );
      }
      if (changed.includes('mobile')) {
        parts.push(contactMobile ? 'They added their mobile number.' : 'They removed their mobile number.');
      }
      if (changed.includes('name')) {
        parts.push(contactName ? 'They told you what to call them.' : 'They cleared what to call them.');
      }

      const { data: coupleMembers } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('member_type', 'couple');
      // ⚠ Two rows can carry the same user_id. Without this the couple gets the
      // same allergy twice.
      const seen = new Set<string>();
      for (const m of coupleMembers ?? []) {
        if (!m.user_id || seen.has(m.user_id as string)) continue;
        seen.add(m.user_id as string);
        await emitNotification({
          userId: m.user_id,
          type: 'rsvp_received',
          title,
          body: parts.length ? parts.join(' ') : null,
          relatedUrl: `/dashboard/${eventId}/guests/${guestId}`,
        });
      }
    } catch {
      // Notification failures must not break the guest-side RSVP submit.
    }
  }

  // ── THE PERSON THEY ARE BRINGING — `nameTheSeats`, below. A seat that does
  // not take never costs the guest their reply, so its outcome is not awaited
  // into a refusal here (Me's "Save name" is where it is said).
  await nameTheSeats(admin, eventId, guestId, formData, ask);

  /*
    🎵 THE SONG ON THE RSVP (owner 2026-09-27: the "Song request" switch must
    ask something). Through the SAME door the day-of card uses —
    `guest_submit_song_request`, which checks the guest, the couple's inbox and
    the rate limit — after the same moderation the song route runs. Only when
    the couple still asks (`ask.song_request`, re-read above) and only for a
    guest who is coming. Best-effort by design: a song that does not take must
    never cost the guest their reply, so a refusal is logged for us, not thrown.
  */
  const songTitle = clean(formData.get('song_title')).slice(0, SONG_TITLE_MAX);
  const songArtist = clean(formData.get('song_artist')).slice(0, SONG_ARTIST_MAX);
  if (songTitle && ask.song_request && !replyLocked && status === 'attending') {
    if (moderateKwentoText(`${songTitle}\n${songArtist}`).state !== 'blocked') {
      const { error: songErr } = await admin.rpc('guest_submit_song_request', {
        p_guest_id: guestId,
        p_title: songTitle,
        p_artist: songArtist,
        p_requester_name: null,
      });
      if (songErr) {
        await insertFaultLog({
          event_type: 'SUPABASE_SAVE_ERROR',
          element_name: 'RSVP song request',
          file_path: 'app/[slug]/actions.ts',
          error_message: songErr.message,
          payload_snapshot: { eventId, guestId },
        });
      }
    }
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  /*
    ⚠ BEFORE THE `redirect`, WHICH THROWS. An RSVP selfie sets this guest's
    `photo_consent` to true, and the story's veto is built from guests who opted
    OUT — so the answer given here can LIFT a veto, and photographs the story was
    withholding may now be shown. A change in that direction publishes exactly as
    urgently as one in the other, and it went through no public surface at all
    before this.
  */
  await everyCopyIsNowStale(eventId);
  // 📵 Saving the reply sends NOTHING (owner 2026-09-29, "NO EMAIL TO GUESTS") —
  // "Save to my account" is the thank-you's own press, with no email in it.
  // `details` = their information was saved and their answer was left alone
  // (the list is final). `refused` additionally says an attempted CHANGE of
  // answer did not take — the one outcome a guest would otherwise never learn.
  const outcome = answerRefused ? 'refused' : replyLocked ? 'details' : 'ok';
  // From the invite arrival the reply's next door is Enter (door 03) — one tap
  // from the Event Hub. The site's own line below is left BYTE-IDENTICAL: its
  // guard (only-the-answer-freezes.test.ts, "replying lands the guest on the
  // event hub") pins it, and adding a branch ahead of it re-points no guard.
  if (toInvite && ev?.slug) redirect(`${inviteEnterPath(ev.slug)}?rsvp=${outcome}`);
  redirect(ev?.slug ? `/${ev.slug}?rsvp=${outcome}` : '/');
}

/**
 * THE SEATS A GUEST NAMES — the reply's per-seat boxes and Me's in-place "Add
 * name" (owner 2026-09-29, prototype frame E) are ONE write, so both obey the
 * same entitlement re-read, the same "ask" switches and the same seat rule.
 * Called only after the caller has matched THIS guest to THIS event.
 *
 * Returns what happened rather than throwing: the reply keeps its own answer
 * when a seat does not take (a name must never cost a guest their RSVP), while
 * Me's "Save name" says so and keeps the boxes open.
 */
async function nameTheSeats(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  guestId: string,
  formData: FormData,
  ask: ReturnType<typeof resolveRsvpAsk>,
): Promise<{ ok: true; named: number } | { ok: false; error: string }> {
  // ── THE PERSON THEY ARE BRINGING ──────────────────────────────────────────
  // The couple is promised in writing that this name arrives; until now nothing
  // on the guest side could send it. No name ⇒ no row ⇒ no QR ⇒ no camera for
  // that person.
  //
  // 🔒 THE ENTITLEMENT IS RE-READ FROM THE DATABASE, NEVER TAKEN FROM THE FORM.
  // The block only RENDERS when `plus_one_allowed`, but a rendered gate is not a
  // gate: these two fields can be posted by anyone with the URL. Without this
  // read, any guest could mint themselves a second seat — with its own QR and
  // its own camera — at an event whose host allowed them none.
  //
  // ⚖ A BLANK BOX IS NOT A REMOVAL, the same rule the contact boxes follow.
  const seatNames = readSeatNames(formData);
  if (seatNames.length > 0) {
    const { data: primary, error: primaryErr } = await admin
      .from('guests')
      .select('plus_one_allowed, plus_one_count, plus_one_mode, side, group_category')
      .eq('guest_id', guestId)
      .eq('event_id', eventId)
      .maybeSingle();
    // Unread is not "not allowed": said, never shown as a saved name.
    if (primaryErr) return { ok: false, error: 'Their name did not save — try again.' };

    // ⚙ ASK TOGGLE (owner 2026-09-25): `ask.plus_ones` off refuses the write
    // regardless of what a crafted POST carries — a MASTER switch beside the
    // per-guest `plus_one_allowed` re-read above, which still decides WHO may
    // have one.
    if (primary?.plus_one_allowed && ask.plus_ones) {
      /*
        ⚖ Owner 2026-09-21 ("2. yes"): one name box per seat — up to +4, each
        seat a row beside this guest. `planSeatNames` decides which seat each
        name fills and REFUSES to mint a seat beyond what the couple gave (the
        form is postable by anyone with the link). It replaced a `.maybeSingle()`
        lookup that errored on two seats and inserted another every reply.
      */
      const { data: seatRows, error: seatsErr } = await admin
        .from('guests')
        .select('guest_id, first_name, plus_one_name_confirmed_at, created_at')
        .eq('event_id', eventId)
        .eq('plus_one_of_guest_id', guestId)
        .is('deleted_at', null);
      if (seatsErr) return { ok: false, error: 'Their name did not save — try again.' };
      const seats: ExtraSeatRow[] = (seatRows ?? []).map((r) => ({
        guest_id: r.guest_id as string,
        first_name: (r.first_name as string | null) ?? null,
        confirmed_at: (r.plus_one_name_confirmed_at as string | null) ?? null,
        created_at: (r.created_at as string | null) ?? null,
      }));
      // 🔒 A seat whose person linked their own account keeps their name
      // (owner 2026-09-29, OWNER ANSWERS (10)) — asked here, not only on screen.
      const seatIds = seats.map((s) => s.guest_id);
      const { data: linkedRows, error: linkedErr } = seatIds.length
        ? await admin.from('event_members').select('guest_id').eq('event_id', eventId).in('guest_id', seatIds)
        : { data: [], error: null };
      if (linkedErr) return { ok: false, error: 'Their name did not save — try again.' };
      const linkedSeats = new Set(((linkedRows ?? []) as Array<{ guest_id: string | null }>).map((r) => r.guest_id).filter((x): x is string => Boolean(x)));
      const ops = lockLinkedSeatNames(planSeatNames(seatNames, seats, plusOneSeats(primary)), linkedSeats);
      const stamp = new Date().toISOString();
      let failed = false;
      let namedCount = 0;

      for (const op of ops) {
        // ⚖ Owner 2026-09-29: each plus-one is asked ONLY first name, last
        // name, meal and dietary. The two answers ride on THEIR row, under the
        // couple's same switches the bringer's own answers obey — and a meal
        // outside the list is dropped, never stored.
        const seatAnswers = {
          ...(ask.meal && op.meal !== undefined && MEAL_VALUES.includes(op.meal as MealPreference)
            ? { meal_preference: op.meal }
            : {}),
          ...(ask.dietary && op.dietary !== undefined ? { dietary_restrictions: op.dietary } : {}),
        };
        if (op.kind === 'details') {
          if (Object.keys(seatAnswers).length > 0) {
            const { error } = await admin
              .from('guests')
              .update({ ...seatAnswers, updated_at: stamp })
              .eq('guest_id', op.seatId)
              .eq('event_id', eventId)
              .eq('plus_one_of_guest_id', guestId);
            if (error) {
              logQueryError('submitRsvp.seatAnswers', error, { event_id: eventId, guest_id: op.seatId }, 'graceful_degrade');
              failed = true;
            }
          }
          continue;
        }
        const first = op.first || 'TBA';
        const last = op.last || '+1';
        if (op.kind === 'name') {
          const { error } = await admin
            .from('guests')
            .update({
              ...seatAnswers,
              first_name: first,
              last_name: last,
              // The other three parts, as the Guest list stores them (owner
              // 2026-09-30: five parts) — only the ones the reply posted.
              ...seatNamePartColumns(op),
              // Clearing this is what actually replaces "+ TBA · brought by …":
              // guestDisplayName PREFERS display_name, so leaving it would keep
              // the placeholder on the seating chart and in the emcee script.
              display_name: null,
              plus_one_name_confirmed_at: stamp,
              updated_at: stamp,
            })
            .eq('guest_id', op.seatId)
            .eq('event_id', eventId)
            .eq('plus_one_of_guest_id', guestId);
          if (error) {
            logQueryError('submitRsvp.nameSeat', error, { event_id: eventId, guest_id: op.seatId }, 'graceful_degrade');
            failed = true;
          } else namedCount += 1;
        } else {
          // Same shape the host's own "add a guest" form inserts, so the seat
          // gets a real row — and with it the qr_token the column mints by DEFAULT.
          const { error } = await admin.from('guests').insert({
            ...seatAnswers,
            event_id: eventId,
            first_name: first,
            last_name: last,
            ...seatNamePartColumns(op),
            side: primary.side,
            group_category: primary.group_category,
            role: 'guest',
            rsvp_status: 'pending',
            photo_consent: true,
            plus_one_of_guest_id: guestId,
            plus_one_mode: primary.plus_one_mode,
            plus_one_name_confirmed_at: stamp,
          });
          if (error) {
            logQueryError('submitRsvp.mintSeat', error, { event_id: eventId, bringer_guest_id: guestId }, 'graceful_degrade');
            failed = true;
          } else namedCount += 1;
        }
      }

      // Mirror onto the primary so the host's list chips stop reading "+ TBA":
      // the first name given, as the single-seat reply always did.
      const named = ops.find((o) => o.kind !== 'details');
      const firstNamed = named ? `${named.first} ${named.last}`.trim() : '';
      if (firstNamed) {
        const { error } = await admin
          .from('guests')
          .update({ plus_one_name: firstNamed, updated_at: stamp })
          .eq('guest_id', guestId)
          .eq('event_id', eventId);
        if (error) {
          logQueryError('submitRsvp.mirrorPlusOneName', error, { event_id: eventId, guest_id: guestId }, 'graceful_degrade');
          failed = true;
        }
      }
      return failed ? { ok: false, error: 'Their name did not save — try again.' } : { ok: true, named: namedCount };
    }
    return { ok: false, error: 'The couple is not taking names for your guests right now.' };
  }
  return { ok: true, named: 0 };

}

/**
 * THE ERASURE ITSELF — face vector nulled + enrollment tombstoned, the guest's
 * own selfie objects deleted from R2, a linked account's face profile nulled,
 * the selfie display photo cleared, and every live auto-face tag pulled. ONE
 * body for both doors that remove a guest's face data: "Delete my face data"
 * (`withdrawFaceConsent`) and the RSVP's "No thanks" after a selfie, confirmed
 * (owner 2026-09-29, OWNER ANSWERS (3): *"Selfie: yes"* — "same path as the
 * existing delete button"). Never two copies of an erasure.
 */
async function eraseGuestFaceData(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  guestId: string,
): Promise<void> {
  const now = new Date().toISOString();

  // Grab the live enrollment rows FIRST so we can erase the R2 selfie objects
  // they point at. (Read before we tombstone — after revoke we still could
  // read them, but this keeps the asset list crisp.)
  const { data: liveEnrollments } = await admin
    .from('guest_face_enrollments')
    .select('id, asset_url')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .is('revoked_at', null);

  // Erase the biometric: null the face vector AND tombstone the row. Nulling
  // face_vector is the actual biometric deletion; revoked_at keeps the matcher
  // excluding it and preserves an audit trail of the withdrawal.
  await admin
    .from('guest_face_enrollments')
    .update({ revoked_at: now, face_vector: null, vector_model: null })
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .is('revoked_at', null);

  // Best-effort R2 delete of each enrolled selfie. asset_url is stored as an
  // `r2://bucket/key` ref (see /api/guest-selfie → encodeR2Ref).
  //
  // 🔒 ONLY THIS GUEST'S OWN SELFIE (2026-09-10). The object must sit under
  // `events/<event>/guest-selfies/<guest>/` or it is not deleted — the couple's
  // face-enrollment policy is FOR ALL, so this column is not written only by
  // the actions that gate it, and a withdrawal must never become a way to
  // delete somebody else's file. A refused ref is logged and its (already
  // tombstoned) row keeps pointing at it. A legacy plain URL is refused too —
  // its tenancy cannot be proven. Wrapped: a stale/absent object (or
  // unconfigured R2) must never abort the rest of the withdrawal.
  for (const row of liveEnrollments ?? []) {
    const assetUrl = (row as { asset_url: string | null }).asset_url;
    if (!assetUrl) continue;
    const decision = planFaceSelfieDelete({ event_id: eventId, guest_id: guestId, asset_url: assetUrl });
    if (!decision?.ok) {
      console.warn('[withdrawFaceConsent] REFUSED a selfie ref outside this guest’s own folder — kept', {
        eventId,
      });
      continue;
    }
    try {
      await executeCleanupDelete(decision.target);
    } catch (err) {
      // Idempotent + non-fatal: log and continue. An orphaned object is
      // reaped later by the R2 lifecycle rule; the withdrawal still completes.
      console.warn('[withdrawFaceConsent] selfie R2 delete failed (continuing)', {
        eventId,
        guestId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // If this guest is linked to a real Setnayan account, null the dormant
  // account-level face vector too (feature ships DORMANT, but erase what
  // exists). The guest→account bridge is event_members.guest_id → user_id.
  const { data: linkedMember } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .not('user_id', 'is', null)
    .maybeSingle();
  const linkedUserId = (linkedMember as { user_id: string | null } | null)?.user_id;
  if (linkedUserId) {
    await admin
      .from('user_face_profiles')
      .update({ face_vector: null, vectors: null, revoked_at: now })
      .eq('user_id', linkedUserId);
  }

  await admin
    .from('guests')
    .update({
      photo_url: null,
      photo_source: null,
      photo_updated_at: now,
    })
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .eq('photo_source', 'selfie');

  // Revoking the enrollment stops FUTURE auto-tags, but the photos this guest is
  // ALREADY auto-tagged in would otherwise stay tagged — a full RA 10173 "remove
  // me from face recognition" must also pull those. Soft-tombstone every live
  // auto_face tag of this guest (human QR/manual tags are left — those are the
  // couple/photographer's assertion, not a face guess). The removed_at rows keep
  // excluding the guest in alreadyTaggedGuestIds, so nothing re-tags later.
  await admin
    .from('photo_tags')
    .update({ removed_at: now, removed_by: 'guest' })
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .eq('source', 'auto_face')
    .is('removed_at', null);

  // The tags pulled above are what the story's veto is built from — every copy
  // of the story, recap, keepsake and share card is thrown away here, in the
  // one erasure, whichever door called it.
  await everyCopyIsNowStale(eventId);
}

/**
 * Guest withdraws face-recognition consent (RA 10173 — the data subject's
 * right to withdraw / erasure). This is a real erasure, not just a revoke:
 * we (1) null the biometric `face_vector`, (2) delete the enrolled selfie
 * object from R2, and (3) tombstone the enrollment via `revoked_at`, so the
 * privacy policy's promise that withdrawal "permanently deletes your face
 * vector and enrolled selfie" is literally true. The selfie display photo is
 * also cleared (reverting to initials); a Gmail avatar, being display-only
 * and non-biometric, is left intact. Admin-client + guest-session authorized,
 * the same trust model as submitRsvp.
 */
export async function withdrawFaceConsent(
  eventId: string,
  guestId: string,
  _formData: FormData,
): Promise<void> {
  const session = await readGuestSession();
  if (!session || session.event_id !== eventId || session.guest_id !== guestId) {
    return;
  }
  const admin = createAdminClient();
  await eraseGuestFaceData(admin, eventId, guestId);

  const { data: ev } = await admin
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();
  revalidatePath(`/dashboard/${eventId}/guests`);
  /*
    ⚠ BEFORE THE `redirect`, WHICH THROWS. Withdrawing face consent tombstones
    every auto-face tag this guest carries, and those tags are what the story's
    veto is built from — so the story, the recap, the keepsake and the share
    card all have to be thrown away here, not on their own clocks.
  */
  await everyCopyIsNowStale(eventId);
  redirect(ev?.slug ? `/${ev.slug}?face_removed=1` : '/');
}

/**
 * THE GUEST'S OWN FACEBLOCK SWITCH — "blur me on the screens at the venue".
 *
 * Owner ruling 3 of 2026-08-17: *"Either side toggles it, freely — guest or
 * couple, on or off."* (He was told the couple can therefore undo a guest's own
 * choice, and chose it anyway. Ruling 4 is the counterweight: the guest is told
 * when that happens.)
 *
 * ─── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * The live `/privacy` notice has always said: *"A guest who does not want to
 * appear on an event's live photo wall can turn on FaceBlock… You can opt out of
 * the live wall this way at any time."* The only writer of `faceblock_enabled`
 * was the COUPLE'S per-guest screen, so a guest had to ask the couple to keep
 * themselves off a wall. We promised a control and shipped somebody else's.
 *
 * ⚖ NARROWER THAN `withdrawFaceConsent`, AND THAT IS THE POINT. Withdrawing
 * consent deletes the face data and pulls every auto-tag — it is "forget me".
 * This is "keep finding my photos, just blur my face on the projection", which
 * is what most people actually want and what the notice describes. Neither
 * replaces the other, and this one is reversible by design.
 *
 * 🔒 Same trust model as `withdrawFaceConsent` and `submitRsvp`: the guest
 * session cookie must match BOTH the event and the guest. A guest can only ever
 * move their own switch.
 */
export async function setGuestFaceBlock(
  eventId: string,
  guestId: string,
  enabled: boolean,
): Promise<void> {
  const session = await readGuestSession();
  if (!session || session.event_id !== eventId || session.guest_id !== guestId) {
    return;
  }
  const admin = createAdminClient();

  const { error } = await admin
    .from('guests')
    .update({ faceblock_enabled: enabled })
    .eq('event_id', eventId)
    .eq('guest_id', guestId);
  if (error) {
    console.warn('[setGuestFaceBlock] update failed', { eventId, error: error.message });
    return;
  }

  if (enabled) {
    // Mirror the couple-side path exactly (dashboard/[eventId]/guests/[guestId]):
    // hide this guest as the PUBLIC author of their messages, then re-bake the
    // newest wall tiles so the wall does not go dark. Both best-effort — the
    // read path is already fail-closed the instant the flag flips, so a failed
    // re-bake costs tiles, never a face.
    after(async () => {
      try {
        await admin.rpc('set_guest_messages_hidden_by_faceblock', { p_guest_id: guestId });
      } catch {
        /* message-hide is best-effort; the re-bake below is the priority */
      }
      try {
        const { rebakeWallForEvent } = await import('@/lib/face-blur');
        await rebakeWallForEvent(eventId);
      } catch {
        /* un-baked tiles stay withheld — fail-closed, never exposed */
      }
    });
  }

  const { data: ev } = await admin
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();
  revalidatePath(`/dashboard/${eventId}/guests`);
  /*
    ⚠ BEFORE THE `redirect`, WHICH THROWS. FaceBlock decides whether this
    guest's face is blurred wherever it appears and hides their photo messages
    with it — both of which the story renders — so it is a consent write like
    any other and comes down on every copy.
  */
  await everyCopyIsNowStale(eventId);
  if (ev?.slug) redirect(`/${ev.slug}?faceblock=${enabled ? 'on' : 'off'}`);
}

/**
 * THE GUEST'S OWN SCAN-TRAIL SWITCH — "don't keep a record of my scans".
 *
 * `guests.scan_tracking_opt_out` was added on 2026-05-13 citing RA 10173, in the
 * same migration as `scan_events` itself, and until now had NO WRITER AND NO
 * READER anywhere in the application. It sat in
 * `tests/db/gates-have-handles.baseline.txt` as `NOT INVESTIGATED` — a gate with
 * no handle. This is the handle; `lib/scan-trail.ts` is the gate.
 *
 * ⚖ NARROWER THAN THE FACE CONTROLS, DELIBERATELY. FaceBlock is about the
 * guest's likeness on a screen; this is about the behavioural trail — which
 * door, at what time, from what device — that `scan_events` keeps. Neither
 * substitutes for the other, and both are reversible.
 *
 * 🔒 GUEST-ONLY, unlike faceblock (owner ruling 3 of 2026-08-17 lets EITHER side
 * move that one). No host-side writer is added here: a host un-setting a data
 * subject's own RA 10173 objection is not a defensible flip, and no host screen
 * has ever shown this flag. If the owner wants the couple to see or move it,
 * that is a decision to take, not a default to inherit.
 *
 * Same trust model as `setGuestFaceBlock`: the guest-session cookie must match
 * BOTH the event and the guest, so a guest can only ever move their own switch.
 */
export async function setGuestScanTracking(
  eventId: string,
  guestId: string,
  optOut: boolean,
): Promise<void> {
  const session = await readGuestSession();
  if (!session || session.event_id !== eventId || session.guest_id !== guestId) {
    return;
  }
  const admin = createAdminClient();

  const { error } = await admin
    .from('guests')
    .update({ scan_tracking_opt_out: optOut })
    .eq('event_id', eventId)
    .eq('guest_id', guestId);
  if (error) {
    console.warn('[setGuestScanTracking] update failed', { eventId, error: error.message });
    return;
  }

  // No `revalidatePath` for the couple: this flag appears on no host screen.
  // The control itself re-reads the stored value at render, so the sentence and
  // the button the guest lands back on ARE the confirmation.
  const { data: ev } = await admin
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();
  if (ev?.slug) redirect(`/${ev.slug}?scan_trail=${optOut ? 'off' : 'on'}`);
}

/**
 * Guest removes a single incorrect auto_face tag of THEMSELVES ("Not me" on one
 * candid). Narrower than withdrawFaceConsent: the guest stays enrolled and keeps
 * auto-finding their other photos; only this one shot is dropped.
 *
 * Soft tombstone (removed_at), not a delete — see the migration header: a hard
 * delete would be re-added by the next auto-tag pass. The WHERE clause is pinned
 * to source='auto_face' + the cookie's own guest_id, so a guest can only drop a
 * FACE guess of themselves — never a photographer's QR/manual tag, never another
 * guest's tag. Works for both papic_photos and papic_guest_captures (keyed on
 * source_table + source_id). Admin-client + guest-session authorized, the same
 * trust model as submitRsvp / withdrawFaceConsent.
 */
export async function removeMyTag(
  eventId: string,
  sourceTable: 'papic_photos' | 'papic_guest_captures',
  sourceId: string,
  _formData: FormData,
): Promise<void> {
  const session = await readGuestSession();
  if (!session || session.event_id !== eventId) {
    return;
  }
  const admin = createAdminClient();
  /*
    🔴 THE `source = 'auto_face'` FILTER IS GONE, AND IT WAS MAKING THIS BUTTON
    DO NOTHING AT ALL.

    "Not me" renders on EVERY photograph in a guest's gallery, and this update
    only ever matched a FACE-RECOGNITION guess. Measured in production: 2 photo
    tags exist in total and BOTH are `manual_pick` — there has never been a
    single `auto_face` tag, because face matching is switched off on every
    event. So the control rendered everywhere, said "Removing…", revalidated the
    page, and left the tag exactly where it was. No error, nothing logged, and
    the only symptom an absence.

    ⚖ AND THE NARROW VERSION WAS ANSWERING THE WRONG QUESTION. Whether a wrong
    tag came from a face model or a mis-scanned QR is our implementation detail;
    the guest's problem is identical either way — a photograph of somebody else
    is filed under their name. Detaching themselves is theirs to do, it removes
    the ASSOCIATION and never the photograph, and `removed_by: 'guest'` records
    who did it.

    ⛔ STILL SCOPED TO THIS GUEST'S OWN TAG ON THIS ONE PHOTO. `guest_id` comes
    from the session cookie, never from the form, so nobody can untag anybody
    else — and asking for the PHOTOGRAPH itself to come down is a different
    control (`askToTakeMyPhotoDown` below), because that is not theirs to
    decide alone.
  */
  await admin
    .from('photo_tags')
    .update({ removed_at: new Date().toISOString(), removed_by: 'guest' })
    .eq('event_id', eventId)
    .eq('guest_id', session.guest_id)
    .eq('source_table', sourceTable)
    .eq('source_id', sourceId)
    .is('removed_at', null);

  /*
    A DETACHED TAG IS A CONSENT FACT, AND IT WAS ONLY EVER REACHING ONE PAGE.
    The story's RA 10173 veto (`consent-veto.ts`) is built from `photo_tags`
    joined to opted-out guests, so removing a tag changes what the story, the
    recap AND the print keepsake may show. This used to revalidate `/{slug}`
    alone, which left the other two on their own five-minute clock and the share
    card on an hour's.
  */
  await everyCopyIsNowStale(eventId);
}

export type TakedownResult =
  | { ok: true; alreadyAsked: boolean }
  | { ok: false; message: string };

/**
 * A GUEST ASKS FOR A PHOTOGRAPH OF THEMSELVES TO BE TAKEN DOWN.
 *
 * ─── THE PERSON THIS IS FOR ────────────────────────────────────────────────
 * Somebody who scanned a QR at a wedding, has no Setnayan account, and never
 * will. Until now they could ask us for exactly nothing: no settings page
 * exists under an event's address, the "Report" control shipped on public
 * profiles and chat threads is not mounted anywhere they can reach, and the
 * only button on their own gallery — "Not me" — detaches a tag and leaves the
 * photograph up.
 *
 * ⚖ AND WE PROMISE THEM OTHERWISE, IN WRITING, AT THE MOMENT WE COLLECT IT.
 * The consent box on the selfie step reads *"I can remove my photo anytime in
 * my settings"* and cites RA 10173. They have no settings. This is the door
 * that sentence has always implied.
 *
 * ─── WHY IT IS A REQUEST AND NOT A DELETE ──────────────────────────────────
 * 🔑 THE PHOTOGRAPH IS NOT THEIRS. It was taken by somebody else, at somebody
 * else's celebration, and it may hold four other people. A guest pressing a
 * button that erases it outright would let any one person in a group shot
 * destroy it for the rest — so the tag comes off immediately (that IS theirs)
 * and the photograph goes to a person.
 *
 * ⚖ THE TAG IS DROPPED FIRST AND ON PURPOSE. Whatever we decide about the
 * photograph, somebody objecting to their own likeness should stop being FILED
 * under it in the same press — that half needs nobody's permission and should
 * not wait in a queue.
 *
 * ─── WHERE IT LANDS ────────────────────────────────────────────────────────
 * `user_reports`, the one moderation queue, using `reporter_guest_id` — a
 * column built in 20261108000000 for exactly this accountless person and, until
 * today, written by only one path. The reason is `remove_my_likeness`, added by
 * 20271179297156 for the same reason a name matters anywhere: filed as `other`
 * it would arrive indistinguishable from spam, and this is the one report that
 * carries a statutory clock.
 */
export async function askToTakeMyPhotoDown(
  eventId: string,
  sourceTable: 'papic_photos' | 'papic_guest_captures',
  sourceId: string,
  formData: FormData,
): Promise<TakedownResult> {
  const session = await readGuestSession();
  /*
    🔒 THE SESSION IS THE WHOLE GATE, AND IT IS NOT DECORATION. This page is
    PUBLIC — an event address serves anybody with the link — so without this a
    stranger could post takedowns against a wedding's photographs all day. The
    cookie proves they were let in and which celebration they belong to; the
    id it carries is never read from the form.
  */
  if (!session || session.event_id !== eventId) {
    return {
      ok: false,
      message: 'Open this from your own invitation link and we can help.',
    };
  }
  if (!sourceId) return { ok: false, message: 'Which photo?' };

  const note = String(formData.get('note') ?? '')
    .trim()
    .slice(0, 2000);

  const admin = createAdminClient();

  // Their tag comes off now — see the docblock. Best-effort: a failure here
  // must not swallow the request, which is the half that needs a person.
  try {
    await admin
      .from('photo_tags')
      .update({ removed_at: new Date().toISOString(), removed_by: 'guest' })
      .eq('event_id', eventId)
      .eq('guest_id', session.guest_id)
      .eq('source_table', sourceTable)
      .eq('source_id', sourceId)
      .is('removed_at', null);
  } catch (err) {
    console.error('[takedown] could not drop the guest tag', err);
  }

  /*
    🪤 ONE OPEN ASK PER PHOTO PER GUEST — checked, because there is no unique
    index to lean on and a person who presses twice must not fill a moderation
    queue with the same objection. Read first, then insert: a race here costs a
    duplicate row for a human to glance past, never a lost request, and that is
    the correct direction to be wrong in.
  */
  const { data: existing } = await admin
    .from('user_reports')
    .select('report_id')
    .eq('event_id', eventId)
    .eq('reporter_guest_id', session.guest_id)
    .eq('target_type', 'photo')
    .eq('target_id', sourceId)
    .eq('reason', 'remove_my_likeness')
    .eq('status', 'open')
    .maybeSingle();

  if (existing) {
    await revalidateEventSlug(eventId);
    return { ok: true, alreadyAsked: true };
  }

  const { error } = await admin.from('user_reports').insert({
    event_id: eventId,
    reporter_guest_id: session.guest_id,
    target_type: 'photo',
    target_id: sourceId,
    reason: 'remove_my_likeness',
    /*
      The photo's own table is recorded in the details, because `target_id`
      alone cannot say which of the two capture tables it belongs to and the
      person answering has to find the picture.
    */
    details: `${sourceTable}${note ? ` — ${note}` : ''}`,
  });

  if (error) {
    console.error('[takedown] request failed', error);
    return {
      ok: false,
      message: 'We couldn’t send that just now. Please try again.',
    };
  }

  await revalidateEventSlug(eventId);
  return { ok: true, alreadyAsked: false };
}

export type WallPullResult =
  | { ok: true; state: 'off_the_wall' | 'on_the_wall' }
  | { ok: false; message: string };

/**
 * A GUEST TAKES HER OWN PHOTOGRAPH OFF THE LIVE WALL — no request, no queue.
 *
 * Owner ruling 2026-09-02, settling item 6: *"On the wall, when her photo is
 * posted she can un-post it."* She controls the photographs she SHOT and the
 * ones she is TAGGED in, both, and nobody else's — per photo, not per audience.
 *
 * ⚖ THIS IS THE THIRD CONTROL ON THE TILE, AND THE THREE ARE NOT THE SAME WISH.
 *
 *   "Not me"          → that is somebody else. Drops the TAG. The photograph
 *                       stays up, because it was never about her.
 *   "Take it down"    → the photograph should not exist anywhere. It is not
 *                       hers to delete — it may hold four other people — so it
 *                       goes to a PERSON (`askToTakeMyPhotoDown`).
 *   "Off the wall"    → it IS her, it is being PROJECTED IN THIS ROOM RIGHT
 *                       NOW, and she wants it to stop. That one is hers alone
 *                       and it happens immediately. This action.
 *
 * 🔑 THE MIDDLE ONE COULD NOT DO THIS JOB, AND THAT IS WHY THIS EXISTS. A
 * request that a person reads is the right answer to "delete my likeness"; it
 * is the wrong answer to a photograph on a wall at a party that is happening,
 * where the only useful latency is none. The mechanism was already sitting
 * there — `wall_hidden_at`, reversible and wall-only — with every writer but
 * the person in the picture.
 *
 * 🔒 The session cookie is the gate and the identity. This page is PUBLIC, so
 * the guest id is read from the signed cookie and NEVER from the arguments; the
 * event must match it too. Which photographs that guest may touch is decided in
 * lib/guest-wall-unpost.ts, which re-checks every predicate on the returned row
 * rather than trusting the filters it sent.
 */
export async function takeMyPhotoOffTheWall(
  eventId: string,
  sourceTable: 'papic_photos' | 'papic_guest_captures',
  sourceId: string,
): Promise<WallPullResult> {
  return wallPull('off', eventId, sourceTable, sourceId);
}

/**
 * SHE CHANGES HER MIND — and only about her OWN pull.
 *
 * Reversible by design: `wall_hidden_at` is documented in-schema as a transient
 * wall-only switch, and a one-way privacy control is one people are afraid to
 * press. If the couple or a coordinator took the photograph down, this refuses
 * and says which — their moderation is not hers to undo.
 */
export async function putMyPhotoBackOnTheWall(
  eventId: string,
  sourceTable: 'papic_photos' | 'papic_guest_captures',
  sourceId: string,
): Promise<WallPullResult> {
  return wallPull('back', eventId, sourceTable, sourceId);
}

async function wallPull(
  direction: 'off' | 'back',
  eventId: string,
  sourceTable: 'papic_photos' | 'papic_guest_captures',
  sourceId: string,
): Promise<WallPullResult> {
  const session = await readGuestSession();
  if (!session || session.event_id !== eventId) {
    return { ok: false, message: 'Open this from your own invitation link and we can help.' };
  }
  if (!sourceId) return { ok: false, message: 'Which photo?' };

  const admin = createAdminClient();
  const target = {
    eventId,
    // 🔒 From the cookie. Never an argument — see the docblock above.
    guestId: session.guest_id,
    sourceTable,
    sourceId,
  };
  const run = direction === 'off' ? takePhotoOffTheWall : putPhotoBackOnTheWall;
  const res = await run(admin, target);

  if (!res.ok) {
    /*
      Each refusal gets its OWN sentence. A single "something went wrong" would
      make "that is not your photo" and "we could not reach the database" look
      identical to the one person who most needs to know which it was — and one
      of the two is worth pressing again.
    */
    const message =
      res.reason === 'not_yours'
        ? 'You can take down photos you took or are tagged in — this one is somebody else’s.'
        : res.reason === 'not_your_pull'
          ? 'The hosts took this one off the wall, so it’s theirs to put back.'
          : 'We couldn’t reach the wall just now. Please try again.';
    return { ok: false, message };
  }

  await revalidateEventSlug(eventId);
  // The couple's control strip lists the same tiles; leaving it stale would
  // show a photograph as "on the wall now" that a guest has just pulled.
  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  revalidatePath(`/dashboard/${eventId}/live`);
  return { ok: true, state: res.state };
}

/**
 * Refresh the celebration page after a guest-side change.
 *
 * 🔴 IT REFRESHED ONE PAGE OUT OF FOUR. Every caller of this helper is a consent
 * write — a takedown request and both directions of the wall pull — and each one
 * changes what `/{slug}/recap` and `/{slug}/print` may show as surely as it
 * changes `/{slug}`. Those two are their own cached routes at `revalidate = 300`
 * and the share card is cached for an hour, so a guest's withdrawal stayed up on
 * all three after this returned. The list of everywhere now lives in one place.
 */
async function revalidateEventSlug(eventId: string): Promise<void> {
  await everyCopyIsNowStale(eventId);
}

export type UnnameResult = { ok: true; changed: number } | { ok: false; message: string };

/**
 * A GUEST ASKS TO BE UNNAMED — on their own words, immediately, no queue.
 *
 * `01_The_Story.md` §3.7 · owner gate Q2, ruled 2026-09-09: *a photo message
 * carries a name only if the guest asked*, and **the role rides the same
 * consent as the name** — there is exactly one maid of honour, so a role badge
 * over an unnamed column identifies her to everybody who was at the wedding.
 *
 * ⚖ WHY THIS ONE DOES NOT GO TO A PERSON, WHEN "TAKE MY PHOTO DOWN" DOES.
 * A photograph is not the guest's to delete — it was taken by somebody else and
 * may hold four other people, which is why `askToTakeMyPhotoDown` above files a
 * request instead of erasing anything. **Their own name on their own sentence
 * is nobody else's.** Making them wait in a moderation queue to stop being
 * named would be the product asking permission to keep publishing their
 * identity.
 *
 * 🔑 IT CAN ONLY EVER REMOVE A NAME. There is no branch that sets
 * `author_named_publicly` to true — the same monotone construction
 * `redactStoryLayers` and `consent-veto.ts` use, so a bug in here cannot name
 * somebody who asked not to be.
 *
 * 🔒 The signed guest session is the gate AND the identity. This page is public;
 * the guest id comes from the cookie and never from the arguments, so nobody can
 * unname anybody else — and nobody can unname a person at another celebration,
 * because the event must match the session's too.
 *
 * ⚠ IT TOUCHES BOTH TABLES THE NAME CAN BE ON. A guest who wrote a Kwento AND a
 * letter is one person making one decision; unnaming half of it and leaving the
 * other half bylined would be worse than not offering the control.
 */
export async function askToBeUnnamed(eventId: string): Promise<UnnameResult> {
  const session = await readGuestSession();
  if (!session || session.event_id !== eventId) {
    return { ok: false, message: 'Open this from your own invitation link and we can help.' };
  }

  const admin = createAdminClient();

  /*
    ⚠ TWO SPELLED-OUT CALLS, NOT A LOOP OVER A TABLE NAME. The obvious shape
    here is `for (const table of [...]) admin.from(table)`, and it is the wrong
    one: `lib/security/select-column-scan.test.ts` reads every `.from(…)` in
    the app to check the columns a query selects against the schema, and a
    `.from(variable)` is a select it CANNOT CHECK. Measured — the loop pushed
    the unresolvable count to 6 over a ceiling of 5, and the ceiling is
    deliberately not raisable ("Fix the resolver or the call site"). Two lines
    of repetition buys a write path that stays inside the scanner.

    ⚠ AND BOTH TABLES ARE WRITTEN EVEN IF THE FIRST FAILS. A guest who wrote a
    Kwento AND a letter is one person making one decision; unnaming half of it
    and leaving the other half bylined is worse than not offering the control.

    A REFUSED QUERY IS NOT A THROWN ERROR — the column is missing on any
    checkout that never ran S4's migration, and PostgREST answers that with
    `{ error }` and no exception, so `.error` is the only way it is visible.
  */
  const unname = async (
    write: () => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  ): Promise<{ rows: number; failed: boolean }> => {
    try {
      const { data, error } = await write();
      return error ? { rows: 0, failed: true } : { rows: data?.length ?? 0, failed: false };
    } catch {
      return { rows: 0, failed: true };
    }
  };

  const messages = await unname(() =>
    admin
      .from('photo_messages')
      .update({ author_named_publicly: false })
      .eq('event_id', eventId)
      .eq('guest_id', session.guest_id)
      .eq('author_named_publicly', true)
      .select('event_id'),
  );
  const columns = await unname(() =>
    admin
      .from('guest_columns')
      .update({ author_named_publicly: false })
      .eq('event_id', eventId)
      .eq('guest_id', session.guest_id)
      .eq('author_named_publicly', true)
      .select('event_id'),
  );

  const changed = messages.rows + columns.rows;
  const failed = messages.failed || columns.failed;

  if (failed && changed === 0) {
    return { ok: false, message: 'We couldn’t change that just now. Please try again.' };
  }

  await revalidateEventSlug(eventId);
  return { ok: true, changed };
}
