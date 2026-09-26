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
 * This module holds the three decisions those fixes share, so the page, the
 * actions and the reply door cannot answer them differently:
 *   1. `resolveGuestViewer` — WHO is this viewer on this event: the guest the
 *      cookie names, the seat the signed-in account is bound to, or nobody.
 *   2. `guestAccountState` — the ONE account prompt, and what it says.
 *   3. `shouldSendKeepLink` — does saving the reply also send the sign-in link.
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
 *   offer          — no account here yet. "This is me — keep this invitation in
 *                    my account." The address comes from the REPLY (never a
 *                    second box), plus Google / Apple.
 *   link_sent      — a sign-in link is on its way. Nothing to fill in.
 *   sign_in        — this seat is already kept in an account, and this browser
 *                    is not signed in to it. One link: sign in.
 *   link_this_seat — signed in, and this seat is free. One press binds it.
 *   linked         — "Linked to <email> ✓". Only NOW may the host pitch show.
 *   held_elsewhere — signed in, but the seat is bound to a DIFFERENT account.
 *                    Said plainly, never silently re-bound.
 */
export type GuestAccountState =
  | { kind: 'offer'; failed?: boolean }
  | { kind: 'link_sent' }
  | { kind: 'sign_in' }
  | { kind: 'link_this_seat' }
  | { kind: 'linked'; accountEmail: string | null }
  | { kind: 'held_elsewhere' };

export function guestAccountState(input: {
  /** The signed-in account, or null for a cookie-only guest. */
  viewerUserId: string | null;
  viewerEmail: string | null;
  /** Who `event_members` says holds THIS guest's seat, or null if nobody. */
  seatHolderUserId: string | null;
  /** A keep-link was already sent to this browser for this event. */
  linkSentForThisEvent: boolean;
}): GuestAccountState {
  const { viewerUserId, viewerEmail, seatHolderUserId, linkSentForThisEvent } = input;
  if (viewerUserId) {
    if (seatHolderUserId === viewerUserId) return { kind: 'linked', accountEmail: viewerEmail };
    if (seatHolderUserId) return { kind: 'held_elsewhere' };
    return { kind: 'link_this_seat' };
  }
  if (seatHolderUserId) return { kind: 'sign_in' };
  if (linkSentForThisEvent) return { kind: 'link_sent' };
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

/**
 * May the reply form offer "keep this invitation in my account"? Only in the
 * `offer` state — a sent link is not re-sent from the form, and an account-held
 * seat has nothing to offer.
 */
export function replyOffersKeep(state: GuestAccountState): boolean {
  return state.kind === 'offer';
}

/** Loose on purpose — the address is the guest's to get right; this only stops a typo sending mail. */
export const KEEP_EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Does saving the reply ALSO email the passwordless sign-in link?
 *
 * 🔑 THE EMAIL IS THE LOGIN (owner 2026-09-10), asked ONCE: the reply's own
 * email box is the address the link goes to. There is no second box.
 *
 * 🔒 AND IT IS AN AFFIRMATIVE ACT. Sending this link CREATES a Setnayan account,
 * so it rides on the same unticked "keep this invitation · I agree to the Terms"
 * checkbox the website's sign-up uses (lib/terms-agreement.ts) — never on the
 * mere presence of an address, which the couple may have typed in for them.
 */
export function shouldSendKeepLink(input: {
  email: string | null;
  termsAgreed: boolean;
  signedIn: boolean;
  seatHeld: boolean;
  alreadySent: boolean;
}): boolean {
  const email = (input.email ?? '').trim();
  if (!email || !KEEP_EMAIL_SHAPE.test(email)) return false;
  if (!input.termsAgreed) return false;
  // A signed-in guest already has their account (Google / Apple / email)…
  if (input.signedIn) return false;
  // …and so does a seat someone has already connected to an account.
  if (input.seatHeld) return false;
  // One link per browser per event per day — a second Save is not a second email.
  if (input.alreadySent) return false;
  return true;
}
