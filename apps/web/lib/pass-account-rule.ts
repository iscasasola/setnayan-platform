/**
 * 🪪 THE ACCOUNT OUTRANKS THE PASS — the pure rule (owner bug 2026-10-19).
 *
 * ⚖ Owner, signed in to his own event as the groom, met the guest page with
 * "Mrs. Milagros E. Buanhog · YOU" marked in the entourage — *"why was milagros
 * highlighted when i was not logged in on her?"* — because this browser still
 * held the 60-day guest pass her personal link had minted when he opened it
 * earlier. The page asked the pass who was looking and never asked the account.
 *
 * The ruling (controller, from the owner's words; privacy-first): **when a
 * person is SIGNED IN, who is looking comes from the ACCOUNT.** A guest pass
 * stands for the viewer only when it is the account's own row, or when nothing
 * says it belongs to somebody else:
 *
 *   own              the pass is the guest row this account is bound to on that
 *                    event (`event_members.guest_id`) — the groom opening his own
 *                    link, a guest who saved their invitation. Honoured.
 *   claimant         a signed-in account that is NOT a host of that event, holds
 *                    no row there, and the pass's row is bound to NOBODY. This is
 *                    the ordinary guest who opened their own link while signed in
 *                    and has not pressed "Save to my account" yet — the claim
 *                    prompt ("This invitation is for <name>. Save it to <email>?")
 *                    needs the pass. Honoured, exactly as before.
 *   host_preview     a host who pressed "Open as <name>" — the pass is honoured
 *                    for this browser session only, on purpose (hosts preview
 *                    guests). Never without that press.
 *   set_aside_host   a host of that event holding another guest's pass. IGNORED:
 *                    the host is looking at their own event as themselves.
 *   set_aside_seat   the account is bound to a DIFFERENT row on that event.
 *                    IGNORED: they are that row (the page answers from the seat).
 *   set_aside_held   the pass's row is bound to a DIFFERENT account. IGNORED: it
 *                    is somebody else's invitation, and this is not them.
 *   set_aside_unread the facts could not be read. IGNORED — fail closed: showing
 *                    one person another person's name, reply, table and photos is
 *                    the harm this rule exists to stop; a signed-in guest who
 *                    loses their pass for one render can reload.
 *
 * Signed OUT, there is no account to ask: the pass is the identity, unchanged.
 *
 * 🔒 READS ONLY. Nothing here writes; nothing in its caller writes either (the
 * ruling: "Never write to the database for this").
 *
 * Executed by `lib/the-account-outranks-the-pass.test.ts` against the real
 * reader (`readGuestSession`), not only this function.
 */

/** What the database says about one account and one pass, on the pass's own event. */
export type PassAccountFacts = {
  /** Guest rows this account is bound to on the pass's event (`event_members.guest_id`, any member type). */
  ownGuestIds: readonly string[];
  /** A couple / coordinator member, or an accepted, not-removed delegate, of the pass's event. */
  isHost: boolean;
  /** Accounts bound to the PASS's guest row on that event (any member type). */
  passRowHolders: readonly string[];
};

export type PassStanding =
  | 'signed_out'
  | 'own'
  | 'claimant'
  | 'host_preview'
  | 'set_aside_host'
  | 'set_aside_seat'
  | 'set_aside_held'
  | 'set_aside_unread';

/** Does this standing let the pass speak for the viewer? */
export function passIsHonoured(standing: PassStanding): boolean {
  return standing === 'signed_out' || standing === 'own' || standing === 'claimant' || standing === 'host_preview';
}

/**
 * The one rule. `facts` null = the read failed (fail closed). `hostPreviewGuestId`: the guest a HOST asked to open
 * this browser's pass as (the "Open as <name>" press), or null.
 */
export function passStanding(input: {
  userId: string | null;
  passGuestId: string;
  facts: PassAccountFacts | null;
  hostPreviewGuestId?: string | null;
}): PassStanding {
  const { userId, passGuestId, facts } = input;
  if (!userId) return 'signed_out';
  if (!facts) return 'set_aside_unread';
  if (facts.ownGuestIds.includes(passGuestId)) return 'own';
  if (facts.isHost) {
    return input.hostPreviewGuestId && input.hostPreviewGuestId === passGuestId ? 'host_preview' : 'set_aside_host';
  }
  if (facts.ownGuestIds.length > 0) return 'set_aside_seat';
  if (facts.passRowHolders.some((holder) => holder !== userId)) return 'set_aside_held';
  return 'claimant';
}

/** The sentence Me says when the browser holds an invitation that is not the viewer's (owner-ruled words). */
export function heldPassLine(firstName: string | null): string {
  const who = firstName?.trim() ? `${firstName.trim()}’s` : 'another guest’s';
  return `This browser also holds ${who} invitation. Viewing as you.`;
}

/** The host's way back from "Open as <name>". */
export function hostPreviewLine(firstName: string | null): string {
  const who = firstName?.trim() || 'this guest';
  return `You’re viewing as ${who} — this browser holds their invitation.`;
}

// ── The host's "Open as <name>" mark — a SESSION cookie (no max-age), names exactly one event's one guest. ──
export const HOST_PREVIEW_PASS_COOKIE_NAME = 'setnayan_host_opens_pass';

export function hostPreviewCookieValue(eventId: string, guestId: string): string {
  return `${eventId}.${guestId}`;
}

/** The guest the host asked to open, for THIS event only; anything malformed or another event's is nothing. */
export function hostPreviewGuestFor(raw: string | null | undefined, eventId: string): string | null {
  if (!raw) return null;
  const dot = raw.indexOf('.');
  if (dot <= 0) return null;
  if (raw.slice(0, dot) !== eventId) return null;
  const guestId = raw.slice(dot + 1);
  return /^[0-9a-f-]{36}$/i.test(guestId) ? guestId : null;
}
