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
  | { kind: 'held_elsewhere' };

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
}): GuestAccountState {
  const { viewerUserId, viewerEmail, seatHolderUserId } = input;
  if (viewerUserId) {
    if (seatHolderUserId === viewerUserId) return { kind: 'linked', accountEmail: viewerEmail };
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
}): RsvpGate {
  const status = input.rsvpStatus ?? 'pending';
  const unanswered = status !== 'attending' && status !== 'declined' && status !== 'maybe';
  if (input.locked) return { kind: 'inside', didntReply: unanswered };
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
 * HOW "Save to my account" SIGNS THEM IN — chosen by the device, NEVER shown as
 * a choice (owner 2026-09-26, "THE GUEST PATHWAY — ONE BUTTON AT A TIME").
 *
 *   · an in-app webview (Messenger · Instagram · Facebook · LINE · WeChat) →
 *     `browser`: "Open in your browser". Google REFUSES OAuth inside these
 *     webviews (`disallowed_useragent`), and most invitations are opened in one.
 *     The button copies the guest's OWN link and says how to paste it into
 *     Safari or Chrome, where Apple / Google is one tap;
 *   · an Apple device — iOS Safari, or the Setnayan iOS app → Apple;
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
const APPLE_DEVICE = /iPhone|iPad|iPod/i;

export function isInAppWebview(userAgent: string | null | undefined): boolean {
  return IN_APP_WEBVIEW.test(userAgent ?? '');
}

export function saveMethodFor(
  userAgent: string | null | undefined,
  providers: { apple: boolean; google: boolean },
): SaveMethod {
  const ua = userAgent ?? '';
  if (isInAppWebview(ua)) return 'browser';
  if (APPLE_DEVICE.test(ua)) return providers.apple ? 'apple' : providers.google ? 'google' : 'link';
  return providers.google ? 'google' : providers.apple ? 'apple' : 'link';
}

/** Is this method a provider sign-in (one tap), rather than the guest's own link? */
export function saveMethodSignsIn(method: SaveMethod): method is 'apple' | 'google' {
  return method === 'apple' || method === 'google';
}

/** The one line under the Save button — what the device chose, said as a fact, never a choice. */
export function saveMethodLine(method: SaveMethod): string {
  if (method === 'apple') return 'with Apple · nothing to type';
  if (method === 'google') return 'with Google · nothing to type';
  if (method === 'browser') return 'copies your link · paste it into Safari or Chrome';
  return 'your own link · it opens this invitation on any phone';
}
