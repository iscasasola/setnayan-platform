/**
 * guest-one-path.ts — ONE path for an invited guest, in either order. Pure:
 * executed by `guest-one-path.test.ts`.
 *
 * ── THE RULING (owner, verbatim 2026-09-25) ────────────────────────────────
 * *"the process should be: Fillup your form. and sign up. or sign up then a form
 * must still be completed. The link process must be easy to understand and
 * manoeuvered."* · *"When a new account is created via an event must be simple
 * and easy."*
 *
 * What the audit measured (`audits/GUEST_SIGNUP_FLOW_MAP_2026-09-25.md`):
 *   · the `/{slug}` reply sheet saved `contact_email` and sent NO link, then a
 *     second box on the same page asked for the same address again;
 *   · up to FIVE account prompts on one page (the claim box, "Link to account",
 *     the provider buttons, the host pitch, the photos/vendor notes);
 *   · a signed-in guest on a new device met the ANONYMOUS page — the cookie is
 *     the only thing the render keyed on, and it names one event.
 *
 * This module holds the decisions those fixes share, so the page, the actions
 * and the reply door cannot answer them differently:
 *   1. `resolveGuestViewer` — WHO is this viewer on this event: the guest the
 *      cookie names, the seat the signed-in account is bound to, or nobody.
 *   2. `guestAccountState` — the ONE account prompt, and what it says.
 *   3. `saveMethodFor` — how "Save to my account" works on THIS device.
 *
 * 📵 Saving the reply sends NOTHING (owner 2026-09-29, "NO EMAIL TO GUESTS").
 */

import { isAppleTouchDevice } from './apple-device';
import { formatCount } from './format-number';

/** The shape `lib/guest-session.ts` signs. Re-declared so this stays pure. */
export type GuestSessionLike = {
  guest_id: string;
  event_id: string;
  qr_token: string;
};

export type GuestViewer =
  /** The browser's own guest cookie, for THIS event. Unchanged behaviour. */
  | { kind: 'cookie'; session: GuestSessionLike }
  /**
   * A SIGNED-IN account bound to a seat on this event (`event_members.guest_id`),
   * with no cookie for it. The session is BUILT from the seat, never minted here:
   * a render cannot write cookies (see lib/guest-membership-session.ts).
   */
  | { kind: 'seat'; session: GuestSessionLike }
  | { kind: 'anonymous'; reason: 'wrong_event' | null };

/**
 * Who is looking at this event, as a guest.
 *
 * 🔑 THE COOKIE STILL WINS WHEN IT NAMES THIS EVENT. A shared phone where a guest
 * scanned their own QR keeps showing that guest — the same answer the page gave
 * before this existed. The seat only answers when the cookie does not.
 *
 * 🔑 AND THE SEAT BEATS A COOKIE FOR A *DIFFERENT* EVENT. That cookie was the
 * `wrong_event` dead end: a person invited to two weddings could be recognised
 * at only one of them at a time. Their account holds both seats, so both pages
 * now know them.
 */
export function resolveGuestViewer(input: {
  eventId: string;
  cookie: GuestSessionLike | null;
  seat: { guestId: string; qrToken: string } | null;
}): GuestViewer {
  const { eventId, cookie, seat } = input;
  if (cookie && cookie.event_id === eventId) return { kind: 'cookie', session: cookie };
  if (seat && seat.guestId && seat.qrToken) {
    return {
      kind: 'seat',
      session: { guest_id: seat.guestId, event_id: eventId, qr_token: seat.qrToken },
    };
  }
  return { kind: 'anonymous', reason: cookie ? 'wrong_event' : null };
}

/**
 * 🗳 WHO A REPLY IS SENT AS (owner bug 2026-10-24 — the host, "Viewing as you" on cale-ice, tapped Reply and the sheet
 * greeted "Gabriel dela Peña": the host card's Reply carried `?preview=draft`, the Maker preview's SAMPLE guest).
 *
 * The rule: the reply is sent as EXACTLY the identity the Event Hub says it is viewing as —
 *   pass     the browser's pass for THIS event, as the account rule honours it (`readGuestSession`: a set-aside pass
 *            is never in `viewer` — it is not a candidate here at all);
 *   seat     a signed-in guest's own seat (`resolveGuestViewer`);
 *   own_row  a signed-in account bound to ONE guest row here by any other membership — the host's own row (the groom),
 *            which `findGuestSeatForUser` (guest seats only) never answers. The Hub says "Viewing as you"; this is you.
 *   none     nobody to answer as. `not_on_list`: signed in, no row of their own here — the page SAYS so, never a sample
 *            and never somebody else. `several_rows`: bound to more than one row — never silently one of them.
 *            `unread`: the account's rows could not be read (fail closed). `no_key`: signed out with no pass.
 *
 * Pure; the reads are `readReplyIdentityForEvent` (guest-one-path.server.ts), and both the reply page and the save
 * (`submitRsvp`) ask it, so the form and the write can never name two different people.
 */
export type ReplyIdentity =
  | { kind: 'pass' | 'seat' | 'own_row'; session: GuestSessionLike }
  | { kind: 'none'; why: 'no_key' | 'not_on_list' | 'several_rows' | 'unread' };

export function resolveReplyIdentity(input: {
  eventId: string;
  viewer: GuestViewer;
  signedIn: boolean;
  /** The account's own, live guest rows on this event (any membership). Null = could not be read. */
  ownRows: readonly { guestId: string; qrToken: string }[] | null;
}): ReplyIdentity {
  const { viewer } = input;
  if (viewer.kind === 'cookie') return { kind: 'pass', session: viewer.session };
  if (viewer.kind === 'seat') return { kind: 'seat', session: viewer.session };
  if (!input.signedIn) return { kind: 'none', why: 'no_key' };
  if (input.ownRows === null) return { kind: 'none', why: 'unread' };
  const ids = [...new Set(input.ownRows.filter((r) => r.guestId && r.qrToken).map((r) => r.guestId))];
  if (ids.length === 0) return { kind: 'none', why: 'not_on_list' };
  if (ids.length > 1) return { kind: 'none', why: 'several_rows' };
  const row = input.ownRows.find((r) => r.guestId === ids[0])!;
  return { kind: 'own_row', session: { guest_id: row.guestId, event_id: input.eventId, qr_token: row.qrToken } };
}

/**
 * THE ONE ACCOUNT PROMPT on a guest's page, and which sentence it carries.
 *
 *   offer          — no account here yet. "Save to my account" by the device's
 *                    own method (`saveMethodFor`) — never an email.
 *   sign_in        — this seat is already kept in an account, and this browser
 *                    is not signed in to it. One link: sign in.
 *   link_this_seat — signed in, and this seat is free. One press binds it —
 *                    and the press is ASKED first: "This invitation is for
 *                    <seatName>. Save it to <accountEmail>?" (2026-09-30). A
 *                    couple seat (`coupleSeat`) offers no press at all: it is
 *                    kept only by the couple's own accounts (lib/seat-binding.ts).
 *   linked         — "Linked to <email> ✓". Only NOW may the host pitch show.
 *   held_elsewhere — signed in, but the seat is bound to a DIFFERENT account.
 *                    Said plainly, never silently re-bound.
 *   host_viewing   — signed in as somebody who MANAGES this event (host ·
 *                    co-host · coordinator · helper) looking at a guest's seat
 *                    that is not their own (owner 2026-10-21). No press: one
 *                    quiet line, "You're viewing <name>'s invitation as the
 *                    host" (`hostViewingLine`). The server refuses the bind too
 *                    (`seatBindRefusal` → 'manager', lib/link-guest-account.ts).
 *
 * 📵 NO `link_sent` STATE ANY MORE (owner 2026-09-29, DECISION_LOG "NO EMAIL TO
 * GUESTS — THE QR AND THE LINK DO EVERYTHING"): *"No email. Either use the qr
 * and link only"*. Nothing emails a guest a sign-in link, so no screen can say
 * "Check your email".
 */
export type GuestAccountState =
  | { kind: 'offer' }
  | { kind: 'sign_in' }
  | { kind: 'link_this_seat'; seatName: string | null; accountEmail: string | null; coupleSeat: boolean }
  | { kind: 'linked'; accountEmail: string | null }
  | { kind: 'held_elsewhere' }
  | { kind: 'host_viewing'; seatName: string | null };

export function guestAccountState(input: {
  /** The signed-in account, or null for a cookie-only guest. */
  viewerUserId: string | null;
  viewerEmail: string | null;
  /** Who `event_members` says holds THIS guest's seat, or null if nobody. */
  seatHolderUserId: string | null;
  /** The seat's name as the couple wrote it — said back before any press binds it. */
  seatName?: string | null;
  /** The seat is one of the celebration's own people (bride · groom · celebrant). */
  seatIsCouple?: boolean;
  /**
   * The signed-in viewer MANAGES this event (the page's host check: a `couple` /
   * `coordinator` membership or an accepted delegate). Then a seat that is not
   * their own is never offered to them — `host_viewing`, never `link_this_seat`.
   */
  viewerManagesEvent?: boolean;
}): GuestAccountState {
  const { viewerUserId, viewerEmail, seatHolderUserId } = input;
  if (viewerUserId) {
    if (seatHolderUserId === viewerUserId) return { kind: 'linked', accountEmail: viewerEmail };
    if (input.viewerManagesEvent === true) return { kind: 'host_viewing', seatName: input.seatName ?? null };
    if (seatHolderUserId) return { kind: 'held_elsewhere' };
    return {
      kind: 'link_this_seat',
      seatName: input.seatName ?? null,
      accountEmail: viewerEmail,
      coupleSeat: input.seatIsCouple === true,
    };
  }
  if (seatHolderUserId) return { kind: 'sign_in' };
  return { kind: 'offer' };
}

/**
 * "Planning your own celebration?" — shown ONLY once the guest's invitation is
 * kept in their account (owner 2026-09-25: the host pitch comes after the link,
 * and stays subtle). Before that it was a fifth account prompt competing with
 * the one that matters to a guest.
 */
export function hostPitchShows(state: GuestAccountState): boolean {
  return state.kind === 'linked';
}

// ═══ THE GUEST PATHWAY (owner 2026-09-26/27) ═══════════════════════════════
// "We handle the chaos … everything is smooth for the users" — ONE button per
// screen, and WE choose the method for the guest. Spec corpus
// `DECISION_LOG.md` rows "NOBODY WITHOUT A KEY", "SWAP A NON-REPLIER'S SPOT",
// "OWNER: YES TO ALL" (b), and build-sessions/GUEST-PATHWAY-BUILD-BRIEF.

/**
 * The answers the key gate can ask for. `attending` is always asked (the
 * couple cannot switch the answer itself off); `meal` and `mobile` only when
 * the couple's "What do you ask your guests?" has them on.
 *
 * ⚖ WHY NOT dietary · note · song · plus-one names. Each of those has a real
 * EMPTY answer ("no allergies", "nothing to add", a seat still TBA — which the
 * owner ruled may be filled later from Me), and the row cannot tell an empty
 * answer from a question never seen. Gating on them would re-ask a guest who
 * already answered "nothing" on every visit, forever. `meal` is different: the
 * reply form ALWAYS writes one (its default is "No preference"), so a NULL meal
 * means the form was never sent — the one blank that is unambiguous.
 */
export type RsvpAnswer = 'attending' | 'meal' | 'mobile';

export type RsvpGate =
  /** Inside. `didntReply` = the final count locked with no answer from them —
   *  owner 2026-09-26 "yes to all" (b): inside, marked, no headcount questions. */
  | { kind: 'inside'; didntReply: boolean }
  /** The RSVP page FIRST, unskippable, asking only `missing`. `coupleMarked` =
   *  the couple already has them down as attending (confirmed by text or call),
   *  so the answer is not asked again — only the remaining details. */
  | { kind: 'ask'; missing: RsvpAnswer[]; coupleMarked: boolean };

/**
 * THE KEY GATE — does this identified guest see the RSVP page before anything
 * else? Pure; the page, the reply door and the tests ask this ONE function.
 *
 * 🔒 AFTER THE LOCK THE GATE NEVER CLOSES. The venue scanner never blocks over
 * a missing form, and neither does this page: a locked list admits everyone
 * with a key — an unreplied one marked "Didn't reply · you're in".
 *
 * ⚖ `maybe` is an answer. "Undecided, for now" is a choice the guest made on
 * the form; they are let in and can change it from the RSVP tab.
 */
export function rsvpGate(input: {
  rsvpStatus: string | null | undefined;
  mealPreference: string | null | undefined;
  mobile: string | null | undefined;
  askMeal: boolean;
  askMobile: boolean;
  /** `guestListIsClosed(...)` — the final count is locked. */
  locked: boolean;
  /**
   * 🎟 `readGuestsReply(event.rsvp_ask_config)` — FALSE when the host answered
   * "Will guests reply? No" (owner 2026-09-30, "no RSVP needed"). Then the key
   * opens the door: nobody is stopped at the reply page. OPTIONAL and absent =
   * true, so every caller written before it keeps today's gate.
   */
  guestsReply?: boolean;
}): RsvpGate {
  const status = input.rsvpStatus ?? 'pending';
  const unanswered = status !== 'attending' && status !== 'declined' && status !== 'maybe';
  if (input.locked) return { kind: 'inside', didntReply: unanswered };
  // "No reply needed. They get in with a QR." — the key is the whole answer.
  if (input.guestsReply === false) return { kind: 'inside', didntReply: false };
  // A decliner is not asked for a meal or a number — "a decline must not go on
  // to ask for the rest" (owner 2026-09-11, the reply card's own rule).
  if (status === 'declined') return { kind: 'inside', didntReply: false };
  const missing: RsvpAnswer[] = [];
  if (unanswered) missing.push('attending');
  if (input.askMeal && !(input.mealPreference ?? '').trim() && status !== 'maybe') missing.push('meal');
  if (input.askMobile && !(input.mobile ?? '').trim()) missing.push('mobile');
  if (missing.length === 0) return { kind: 'inside', didntReply: false };
  return { kind: 'ask', missing, coupleMarked: status === 'attending' };
}

/**
 * ✉️ "YOU'RE COMING ✓ · N MORE ANSWERS" — N, for a guest the couple has down as ATTENDING (owner 2026-10-20, DECISION_LOG
 * "THE COVER'S REPLY BUTTON HAS THREE STATES": *"Show "You're coming ✓ · N more answers" when answers are missing (tap
 * opens only the missing ones)"*). Measured live that day: an attending guest who skipped the couple's switched-on meal
 * and mobile questions met "You're coming ✓ · Change" — byte for byte the complete reply's button — while the reply page
 * asked them "Two more things".
 *
 * 🔒 N IS THE REPLY PAGE'S OWN MISSING SET, COUNTED — never a second count. It reads the verdict of `rsvpGate` (above),
 * the ONE rule the reply page asks for which questions to show (`invite/reply/page.tsx` → `RsvpWidget gate`), so the
 * number on the button and the questions behind it cannot disagree. Held by
 * `lib/the-cover-counts-the-reply-pages-questions.test.ts`.
 *
 *   · attending, and the gate asks for something  → its `missing.length` (attendance itself is never in it then);
 *   · attending and complete, or not attending    → 0: the shipped words stand ("Change", "Confirm attendance");
 *   · a decline → 0 by the gate's own rule: a decliner is asked nothing more (owner 2026-09-11, "a decline must not go
 *     on to ask for the rest"), so the decline keeps its shipped "You can't make it · Change";
 *   · `null` gate — the answers could not be read (`guestAnswersRead`) → null: the caller draws the plain "Change" and
 *     logs. A failure must not look like success, and must never draw a wrong number.
 */
export function moreAnswersOf(gate: RsvpGate | null): number | null {
  if (!gate) return null;
  return gate.kind === 'ask' && gate.coupleMarked ? gate.missing.length : 0;
}

/** "1 more answer" · "2 more answers" — the words after "You're coming ✓ ·" (owner 2026-10-20, singular for one). */
export function moreAnswersWords(n: number): string {
  return n === 1 ? '1 more answer' : `${formatCount(n)} more answers`;
}

/**
 * 🔍 DID THE ROW CARRY THE ANSWERS `rsvpGate` COUNTS? A column left out of a `.select(...)` comes back `undefined`, and
 * the gate reads `undefined` exactly like a blank answer — so a read that dropped `mobile` would tell every attending
 * guest they owe one more answer. Only a row that HAS the keys (null is an answer: "not given") may be counted.
 */
export function guestAnswersRead(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false;
  return ['rsvp_status', 'meal_preference', 'mobile'].every((k) => k in row);
}

/**
 * HOW "Save to my account" SIGNS THEM IN — the device's method (owner 2026-09-26, "THE GUEST PATHWAY — ONE BUTTON
 * AT A TIME"). ⚠ CHANGED 2026-10-25 for THIS offer only — owner, verbatim: "Show both". With Apple AND Google
 * switched on, both buttons draw (`saveProvidersInOrder`) and this method only decides which comes FIRST; the
 * press then names its own provider (`saveMethodFromForm`). With one provider on, this is still the one button.
 *
 *   · an in-app webview (Messenger · Instagram · Facebook · LINE · WeChat) →
 *     `browser`: "Open in your browser". Google REFUSES OAuth inside these
 *     webviews (`disallowed_useragent`), and most invitations are opened in one.
 *     The button copies the guest's OWN link and says how to paste it into
 *     Safari or Chrome, where Apple / Google is one tap;
 *   · an Apple device — iOS Safari, or the Setnayan iOS app → Apple. The iPad
 *     app's user-agent says `Macintosh` (measured 2026-10-19), so "Apple
 *     device" is `isAppleTouchDevice` (lib/apple-device.ts), never a bare
 *     `/iPhone|iPad/`: on that test the iPad app offered Google with no Sign
 *     in with Apple — an App Store 4.8 rejection. iPad SAFARI cannot be told
 *     from a Mac by a server at all; `SaveToAccount` lets the browser correct
 *     it (`AppleOnTouch`);
 *   · everything else (Android Chrome, a desktop browser) → Google.
 *
 * A provider the deployment has not switched on falls back to the other; with
 * neither on, `link` — "Copy my link", the one way back that always works.
 *
 * 📵 NEVER AN EMAIL (owner 2026-09-29, DECISION_LOG "NO EMAIL TO GUESTS"). The
 * webview arm used to be the emailed sign-in link; the owner ruled it out on
 * cost — *"No email. Either use the qr and link only"*.
 */
export type SaveMethod = 'apple' | 'google' | 'browser' | 'link';

const IN_APP_WEBVIEW =
  /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|\bLine\/|MicroMessenger|Snapchat|musical_ly|BytedanceWebview/i;

export function isInAppWebview(userAgent: string | null | undefined): boolean {
  return IN_APP_WEBVIEW.test(userAgent ?? '');
}

export function saveMethodFor(
  userAgent: string | null | undefined,
  providers: { apple: boolean; google: boolean },
): SaveMethod {
  const ua = userAgent ?? '';
  if (isInAppWebview(ua)) return 'browser';
  if (isAppleTouchDevice(ua)) return providers.apple ? 'apple' : providers.google ? 'google' : 'link';
  return providers.google ? 'google' : providers.apple ? 'apple' : 'link';
}

/**
 * 🔒 THE LABEL AND THE ACTION ARE ONE PICK (owner's live test, 2026-10-02: the
 * button read "with Apple" and the tap opened Google sign-in). The page decided
 * the method from the PAGE request's user-agent and the Server Action decided it
 * AGAIN from the POST's — two decisions that are only the same when two requests
 * look the same. Now the form carries the method the button SAID
 * (`SAVE_METHOD_FIELD`), and the action takes it — while that provider is still
 * switched on — so the provider opened is the one the guest read. A field that
 * names no provider (absent, tampered) falls back to the device rule; a provider
 * since switched off is refused (2026-10-25, below). Choosing a sign-in provider is not a
 * privilege, so a tampered value can only pick the other one-tap door.
 */
export const SAVE_METHOD_FIELD = 'save_method';
export function saveMethodFromForm(
  posted: unknown,
  userAgent: string | null | undefined,
  providers: { apple: boolean; google: boolean },
): SaveMethod {
  /* 🍏🤖 SHOW BOTH (owner 2026-10-25, verbatim: "Show both"). With both providers on, the guest sees an Apple AND
     a Google button and PRESSES one — so the press names a provider the device rule did not pick, and that is the
     provider opened. A pressed provider that is switched OFF is REFUSED (`link`: no sign-in — the action sends the
     guest back to the page, which draws only what is on), never swapped for the other one: opening a provider the
     guest did not press is the 2026-10-02 bug ("with Apple" opened Google) by another road. Only a field that names
     no provider at all (absent, or not a provider) falls back to the device rule. */
  if (posted === 'apple' || posted === 'google') return providers[posted] ? posted : 'link';
  return saveMethodFor(userAgent, providers);
}

/**
 * Which provider button was PRESSED, read from the form's pending submission (`useFormStatus().data`) — each
 * provider button posts its own name as `SAVE_METHOD_FIELD`. Null when the submission names none. Lets the pressed
 * button alone say "Opening Apple…" and the stall line name the provider that did not open (owner 2026-10-25,
 * "Show both": two buttons in one form share one pending state).
 */
export function pressedSaveMethod(data: { get(name: string): unknown } | null | undefined): 'apple' | 'google' | null {
  const v = data?.get(SAVE_METHOD_FIELD);
  return v === 'apple' || v === 'google' ? v : null;
}

/**
 * The provider buttons the offer draws, in order (owner 2026-10-25, "Show both"): the device's method first, then —
 * when the other provider is switched on too — the other one. One provider on → just that one. No provider to sign
 * in with (an in-app browser, or none switched on) → none: the page hands over the guest's own link instead.
 */
export function saveProvidersInOrder(
  method: SaveMethod,
  providers: { apple: boolean; google: boolean },
): Array<'apple' | 'google'> {
  if (method !== 'apple' && method !== 'google') return [];
  const other = method === 'apple' ? 'google' : 'apple';
  return providers[other] ? [method, other] : [method];
}

/** Is this method a provider sign-in (one tap), rather than the guest's own link? */
export function saveMethodSignsIn(method: SaveMethod): method is 'apple' | 'google' {
  return method === 'apple' || method === 'google';
}
