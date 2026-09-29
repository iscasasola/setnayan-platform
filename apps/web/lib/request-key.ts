/**
 * lib/request-key.ts — A REQUESTER HOLDS THEIR OWN KEY FROM THE MOMENT THEY SEND
 * (owner 2026-09-29, DECISION_LOG "AMENDS THE TWO ROWS ABOVE — A REQUESTER GETS
 * THEIR QR AT ONCE; IT UNLOCKS ONLY WHEN THE COUPLE ACCEPTS" and "CORRECTS THE
 * ROW ABOVE — IT IS THEIR DIGITAL TICKET, IN A 'REQUEST PENDING' STATE").
 * Owner, verbatim: *"The they get a qr. Already. But only unlocks when we accept.
 * The qr says, sorry your request did not approve"*. Screens and door copy from
 * the approved prototype `Setnayan/prototypes/guest_ticket_flow_2026-09-29.html`
 * (frames B · C · D · E · H1–H3).
 *
 * THE KEY IS THE REQUEST ROW'S OWN `qr_token` — the same 32-hex credential every
 * invitation QR carries (`?invite=<token>`). What it OPENS is decided live, from
 * the row, every time it is used, by ONE function (`requestKeyState`):
 *
 *   pending   — still a request (`entry_source = 'self_added_unlisted'`, not
 *               removed): "Waiting for the couple to confirm you" — nothing
 *               private, no guest session, and the door says "Not confirmed yet";
 *   accepted  — the couple pressed Accept (Keep): the row is on the list now, so
 *               the SAME key opens their invitation ("You're in!");
 *   linked    — the couple joined the request to a name already on the list
 *               (Link): the request row is removed and carries a forward
 *               (`linked_into:<guest id>`, written by Link) — the key opens THAT
 *               guest's invitation;
 *   declined  — the couple pressed Decline (Remove): "Sorry, your request was not
 *               approved." The door says "Not approved";
 *   none      — no such request (a removed list guest, a stranger's token).
 *
 * 🔑 A SAVED PICTURE CANNOT CHANGE, SO THE DOOR NEVER TRUSTS ONE. A pending
 * ticket saved on Send still reads "Request pending" after Accept, and its QR
 * then admits — because the scanner and the link ask this function, not the
 * picture (frame D / rule 4).
 *
 * Pure: no I/O — executed by `lib/request-key.test.ts`.
 */

export const REQUEST_SOURCE = 'self_added_unlisted';

/** The forward Link leaves on the removed request row: `linked_into:<guest id>`. */
export const LINKED_INTO_PREFIX = 'linked_into:';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function linkedIntoTag(guestId: string): string {
  return `${LINKED_INTO_PREFIX}${guestId}`;
}

/** The guest a Linked request forwards to, or null. Only a well-formed id is honoured. */
export function linkedIntoFrom(tags: readonly string[] | null | undefined): string | null {
  for (const t of tags ?? []) {
    if (typeof t === 'string' && t.startsWith(LINKED_INTO_PREFIX)) {
      const id = t.slice(LINKED_INTO_PREFIX.length);
      if (UUID.test(id)) return id;
    }
  }
  return null;
}

export type RequestKeyRow = {
  entry_source: string | null;
  deleted_at: string | null;
  custom_tags?: readonly string[] | null;
};

export type RequestKeyState =
  | { kind: 'pending' }
  | { kind: 'accepted' }
  | { kind: 'linked'; into: string }
  | { kind: 'declined' }
  | { kind: 'none' };

/**
 * What a key opens RIGHT NOW. `wasRequest` = this row is known to have been a
 * request (the browser's remembered key, or a row that still says so) — an
 * accepted request's row reads exactly like any guest on the list, and that is
 * the point: accepted IS on the list.
 */
export function requestKeyState(row: RequestKeyRow | null | undefined): RequestKeyState {
  if (!row) return { kind: 'none' };
  const isRequest = row.entry_source === REQUEST_SOURCE;
  if (row.deleted_at) {
    if (!isRequest) return { kind: 'none' };
    const into = linkedIntoFrom(row.custom_tags);
    return into ? { kind: 'linked', into } : { kind: 'declined' };
  }
  return isRequest ? { kind: 'pending' } : { kind: 'accepted' };
}

/** How long a just-decided request keeps its Undo (frame G2: "Undo sits on the row for a minute"). */
export const UNDO_WINDOW_MS = 2 * 60 * 1000;

/** Is a decision taken at `at` still undoable at `now`? */
export function undoStillOpen(at: string | null | undefined, now: number): boolean {
  if (!at) return false;
  const t = new Date(at).getTime();
  return Number.isFinite(t) && now - t >= 0 && now - t < UNDO_WINDOW_MS;
}

// ─── The door ────────────────────────────────────────────────────────────────

/**
 * THE DOOR'S VERDICT (frames H1–H3), from the same state. `valid` names the
 * seat that is admitted — for a Linked request that is the guest they were
 * joined to, never the removed request row.
 */
export type DoorVerdict =
  | { kind: 'valid'; guestId: string }
  | { kind: 'pending' }
  | { kind: 'declined' }
  | { kind: 'unknown' };

export function doorVerdict(row: (RequestKeyRow & { guest_id: string }) | null | undefined): DoorVerdict {
  const s = requestKeyState(row);
  if (s.kind === 'accepted') return { kind: 'valid', guestId: row!.guest_id };
  if (s.kind === 'linked') return { kind: 'valid', guestId: s.into };
  if (s.kind === 'pending') return { kind: 'pending' };
  if (s.kind === 'declined') return { kind: 'declined' };
  return { kind: 'unknown' };
}

/** The door's words, verbatim from frames H1–H3. */
export const DOOR_WORDS = {
  valid: 'Valid ticket',
  pending: 'Not confirmed yet',
  pendingWhy: 'Asked to join from the general link · the couple hasn’t accepted this request. No table, nothing to admit yet.',
  pendingOpen: 'Open in Guest List → Pending',
  declined: 'Not approved',
  declinedWhy: 'The couple declined this request. This code does not admit anyone.',
  next: 'Scan the next guest',
  checkedLive: (time: string, arrived: number, of: number) => `Checked live at ${time} · ${arrived} of ${of} arrived`,
} as const;

// ─── The guest's screens ─────────────────────────────────────────────────────

/** The requester's words, verbatim from frames B · C · D · E. */
export const REQUEST_WORDS = {
  sentTitle: 'Sent to the couple',
  sentSub: (couple: string) => `${couple} will check their list.`,
  sentUnlocks: 'Your Digital ticket unlocks the moment they confirm you.',
  saveThis: 'Save this — it opens your invitation once the couple confirms you. The same QR unlocks; nothing new is sent.',
  waiting: 'Waiting for the couple to confirm you',
  waitingSub: (couple: string) => `${couple} have your request.`,
  waitingKeep: 'This link and your QR stay yours — they open your invitation the moment you’re in.',
  back: 'Back to the details',
  backSub: 'the date, the place, how to get there',
  inTitle: 'You’re in!',
  inSub: (couple: string, table: string | null) => `${couple} confirmed you${table ? ` · ${table}` : ''}`,
  saveUpdated: 'Save your Digital ticket',
  saveUpdatedWhy: 'the one you saved earlier still says “pending” — a picture can’t change itself',
  declined: 'Sorry, your request was not approved.',
  declinedSub: (couple: string) => `${couple} couldn’t add you this time.`,
  declinedThanks: 'Thank you for wanting to be there.',
  /** The pending ticket's band and foot (frame B). */
  band: 'Request pending',
  bandSub: (couple: string) => `waiting for ${couple}`,
  notValid: 'Not valid at the door yet',
} as const;
