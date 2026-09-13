/**
 * THE DESK — one queue over four sources (08 step 1.2 · design `02` §2).
 *
 * The host used to visit FOUR screens to decide what their own story shows:
 * the letters queue, the Kwento moderation queue, what a supplier sent, and the
 * editor itself. This module is the shape all four collapse into.
 *
 * ⛔ THE FOUR EDITORS STAY WHERE THEY ARE. Nothing here moves or replaces them;
 * the desk is the single QUEUE that decides what reaches the story, and each
 * decision is written back to that source's OWN status column.
 *
 * PURE ON PURPOSE — no `server-only`, no client, no Supabase import. Every rule
 * that decides what a host may do is a function of plain row data, so a unit
 * test can exercise it without a database. The reads live in
 * `app/dashboard/[eventId]/story/_lib/load-desk.ts`; the writes in that route's
 * `desk-actions.ts`.
 */

/** Which of the four tables a card came from. */
export type DeskSource = 'kwento' | 'letter' | 'challenge' | 'supplier';

/**
 * The host's decision. Deliberately THREE values and not a boolean: the desk's
 * progress meter reads "n% of the desk decided" and its "Still waiting on you"
 * filter both need to tell *undecided* apart from *turned down*.
 */
export type DeskStatus = 'pending' | 'accepted' | 'rejected';

/** The lane a card is filed under on the desk (design `02` §2 filters). */
export type DeskLane = 'guest' | 'supplier';

/**
 * Why an item is HELD BACK — a state the host cannot overrule.
 *
 * ⚖ HELD BACK IS NOT "REJECTED". Rejected is the host's choice and is undoable
 * at any time; held back is somebody else's consent or the screen, and no
 * host action can clear it. The two must never be rendered as the same thing.
 */
export type HeldBackReason =
  | 'unscreened'
  | 'blocked'
  | 'guest_opted_out'
  | 'withdrawn'
  | 'nothing_to_show';

export type DeskItem = {
  source: DeskSource;
  /** The source's own app-facing UUID (message_id / column_id / completion_id / media_id). */
  id: string;
  status: DeskStatus;
  /** ISO instant the thing ARRIVED — the source's own column, not a shared one. */
  arrivedAt: string;
  /** Where accepting files it, in the host's words ("→ Letters"). */
  landsIn: string;
  lane: DeskLane;
  title: string;
  /** The content itself. Editable in place only where `editable` is true. */
  body: string;
  /** Whose words these are — decides whether editing them is a bigger thing. */
  authorKind: 'guest' | 'supplier';
  /** Rendered byline, or null when the words run unnamed. */
  byline: string | null;
  /** The one thing the host must know about this item (the card's ⚑ line). */
  flag: string;
  editable: boolean;
  /** Non-null ⇒ the host CANNOT accept this, by any route. */
  heldBack: HeldBackReason | null;
  /** For a capture SET: how many are acceptable, and how many are held back. */
  set: { acceptable: number; heldBack: number } | null;
};

/* ─── The consent sentences (design `04`) ─────────────────────────────────────
 *
 * ⚠ THE PROTOTYPE WRITES "She asked to be named." — that is one named person on
 * a mock-up (Tita Bing), not a template. A real guest's gender is not a column
 * we hold and not one we will add, so the shipped sentence keeps the design's
 * words and drops the pronoun rather than assuming one for every guest.
 *
 * 🔑 THE ROLE RIDES THE SAME CONSENT AS THE NAME (owner/DPO ruling 2026-09-09).
 * There is one maid of honour — a role is exactly as identifying as a name — so
 * a single flag governs both and there is no "unnamed but with their role" state.
 */

export const NAMED_BY_REQUEST =
  'Asked to be named. Accepting shows their name; you can accept it unnamed instead.';

export const NOT_NAMED_BY_CHOICE = 'Not named, by choice. These words run unnamed.';

/**
 * The five yeses behind a challenge answer (design `04` rule 5).
 *
 * ⚠ THE FIFTH IS NOT "asked to be named" ON THIS SOURCE, AND SAYING SO WOULD BE
 * A LIE. `papic_mission_completions` carries no naming column — the 2026-09-09
 * ruling added one to `photo_messages` (Kwento) only — and the shipped public
 * reader hardcodes `byline: null`, so NOBODY is ever named on a challenge
 * answer. The safe state is already the shipped state; the sentence says what
 * is true rather than what the prototype's mock-up said.
 */
export const FIVE_YESES =
  'Five yeses passed: share this answer · captures may be public · screened ' +
  'clean · not opted out of photos · and nobody is named on an answer.';

export const SUPPLIER_CREDIT_IS_FREE =
  'You can turn a supplier’s note down without turning the supplier down — ' +
  'their credit on your day is free and stays either way.';

export const EDITING_SOMEONE_ELSES_WORDS =
  'Editing someone else’s words is a bigger thing. Trim for length freely; if ' +
  'you change what she meant, we ask her before it publishes.';

/** Copy for each held-back reason. Every one of these ends the matter. */
export function heldBackSentence(reason: HeldBackReason): string {
  switch (reason) {
    case 'guest_opted_out':
      return (
        'This shows a guest who opted out of photos. It is already held back — ' +
        'you cannot accept it. Their choice beats your curation.'
      );
    case 'unscreened':
      return 'Still being screened. It cannot be accepted until that settles.';
    case 'blocked':
      return 'The screen held this one back. It cannot be accepted.';
    case 'withdrawn':
      return 'The person who sent this has taken it back, so it cannot be accepted.';
    case 'nothing_to_show':
      return 'There is nothing left to show for this one, so it cannot be accepted.';
  }
}

/**
 * The sentence a capture SET carries when part of it is held back — the
 * design's own words (`02` §2), with the two counts filled in.
 *
 * 🔑 "IT IS NOT COUNTED ABOVE" IS A PROMISE ABOUT THE OTHER NUMBER, so the
 * acceptable count MUST exclude the held-back ones. `partiallyHeldBackSet`
 * takes them apart rather than trusting a caller to subtract.
 */
export function setHoldSentence(acceptable: number, held: number): string {
  const total = acceptable + held;
  const which = held === 1 ? 'One' : `${held}`;
  const shows = held === 1 ? 'shows' : 'show';
  return (
    `${which} of the ${total} ${shows} a guest who opted out of photos. ` +
    `That ${held === 1 ? 'one is' : 'those are'} already held back — you cannot ` +
    `accept ${held === 1 ? 'it' : 'them'}, and ${held === 1 ? 'it is' : 'they are'} ` +
    'not counted above.'
  );
}

/**
 * THE ONE PLACE THAT DECIDES WHETHER A CAPTURE MAY BE ACCEPTED.
 *
 * ⚖ MONOTONE BY CONSTRUCTION, exactly like `consent-veto.ts`
 * `publicKeyForCapture`, which is the gate this mirrors on the host's side: it
 * can only ever refuse MORE than the raw row does, never permit more. Every
 * unknown resolves to held back.
 *
 * ⛔ THIS IS NOT THE ONLY ENFORCEMENT AND MUST NOT BE THE ONLY ONE. The host
 * holds a per-column UPDATE grant on `status`, so they can PATCH PostgREST
 * directly with the public anon key and never run this function. The database
 * refuses that route on its own (trigger
 * `papic_mission_completions_refuse_held_back`, migration 20271214724787), and
 * the predicate here is the app-side MIRROR of it — kept deliberately identical
 * so the desk never offers a button the database will refuse.
 */
export function captureHeldBack(capture: {
  exists: boolean;
  hiddenAt: string | null;
  consentToPublic: boolean;
  moderationState: string;
  taggedGuestOptedOut: boolean;
}): HeldBackReason | null {
  if (!capture.exists) return 'nothing_to_show';
  if (capture.hiddenAt) return 'withdrawn';
  if (!capture.consentToPublic) return 'withdrawn';
  if (capture.moderationState === 'unscreened') return 'unscreened';
  if (capture.moderationState !== 'clean') return 'blocked';
  // Last, so a capture that is BOTH unscreened and vetoed reports the screen —
  // but a clean one still cannot pass the veto. The veto is the final word.
  if (capture.taggedGuestOptedOut) return 'guest_opted_out';
  return null;
}

/**
 * The same question for the two TEXT sources, whose safety is a column on the
 * row itself and whose DB CHECK (`approved_needs_screen` / its guest-columns
 * twin) already refuses an unscreened acceptance.
 *
 * 'flagged' is NOT held back: the shipped constraint permits approving a
 * flagged item — a human looked at it — and narrowing that here would refuse
 * something the database allows, which is its own kind of wrong.
 */
export function wordsHeldBack(row: {
  moderationState: string;
  userDeletedAt: string | null;
  /** The raw database status, so a withdrawal is caught by EITHER signal. */
  status?: string | null;
}): HeldBackReason | null {
  /*
    ⚖ BELT AND BRACES ON THE GUEST'S OWN WITHDRAWAL. Both shipped withdrawal
    paths — `guest_delete_own_message` and `guest_withdraw_column` — set
    `status = 'user_deleted'` AND `user_deleted_at = now()` in the SAME update,
    read out of production by the function bodies, so today either signal alone
    would do. Both are checked anyway, because this is the one decision a host
    must never be able to overturn: if a future path ever sets one without the
    other, the guest is still protected. Losing one still leaves the other.
  */
  if (row.userDeletedAt) return 'withdrawn';
  if (row.status === 'user_deleted') return 'withdrawn';
  if (row.moderationState === 'unscreened') return 'unscreened';
  if (row.moderationState === 'blocked') return 'blocked';
  return null;
}

/** A supplier submission is held until the NSFW screen settles on 'clean'. */
export function supplierHeldBack(row: {
  moderationState: string;
}): HeldBackReason | null {
  if (row.moderationState === 'unscreened') return 'unscreened';
  if (row.moderationState !== 'clean') return 'blocked';
  return null;
}

/**
 * Split a capture set into what may be accepted and what is held back.
 * Returns the counts the set sentence promises are separate.
 */
export function partiallyHeldBackSet(
  captures: Array<Parameters<typeof captureHeldBack>[0]>,
): { acceptable: number; heldBack: number } {
  let acceptable = 0;
  let heldBack = 0;
  for (const c of captures) {
    if (captureHeldBack(c) === null) acceptable += 1;
    else heldBack += 1;
  }
  return { acceptable, heldBack };
}

/* ─── The filters and the meter (design `02` §2 · §1) ────────────────────── */

export type DeskFilter = 'all' | 'guest' | 'supplier' | 'open';

export function matchesFilter(item: DeskItem, filter: DeskFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'guest':
      return item.lane === 'guest';
    case 'supplier':
      return item.lane === 'supplier';
    case 'open':
      return isWaitingOnTheHost(item);
  }
}

/**
 * "Still waiting on you" means a decision the host can actually make.
 *
 * 🔑 A HELD-BACK ITEM IS NOT WAITING ON THE HOST. It is waiting on nobody —
 * there is no decision available. Counting it would leave a desk that can never
 * reach 100%, and `Publish` is disabled until the desk is empty, so that would
 * make publishing permanently impossible for any event with one opted-out guest.
 */
export function isWaitingOnTheHost(item: DeskItem): boolean {
  return item.status === 'pending' && item.heldBack === null;
}

export function deskCounts(items: DeskItem[]): {
  all: number;
  guest: number;
  supplier: number;
  open: number;
  heldBack: number;
} {
  return {
    all: items.length,
    guest: items.filter((i) => i.lane === 'guest').length,
    supplier: items.filter((i) => i.lane === 'supplier').length,
    open: items.filter(isWaitingOnTheHost).length,
    heldBack: items.filter((i) => i.heldBack !== null).length,
  };
}

/**
 * "n% of the desk decided" — the rail's meter.
 *
 * An EMPTY desk is 100% decided, not 0%: there is nothing left to decide, which
 * is the state `Publish` waits for. Held-back items are outside the fraction
 * entirely, for the reason given on `isWaitingOnTheHost`.
 */
export function percentDecided(items: DeskItem[]): number {
  const decidable = items.filter((i) => i.heldBack === null);
  if (decidable.length === 0) return 100;
  const decided = decidable.filter((i) => i.status !== 'pending').length;
  return Math.round((decided / decidable.length) * 100);
}

/** True when nothing is left for the host to decide — the Publish gate. */
export function deskIsClear(items: DeskItem[]): boolean {
  return items.every((i) => !isWaitingOnTheHost(i));
}

/**
 * The union's sort: newest arrival first, across four tables that name that
 * instant three different ways (`submitted_at` twice, `created_at` twice).
 * Ties break on source then id so the order is deterministic — a queue that
 * reshuffles between two renders loses the host's place.
 */
export function sortByArrival(items: DeskItem[]): DeskItem[] {
  return [...items].sort((a, b) => {
    if (a.arrivedAt !== b.arrivedAt) return a.arrivedAt < b.arrivedAt ? 1 : -1;
    if (a.source !== b.source) return a.source < b.source ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
}

/* ─── Writing a decision back to each source's OWN column ─────────────────── */

/**
 * The desk's three-value status ↔ each table's own vocabulary.
 *
 * ⚠ THE TWO TEXT TABLES SPELL IT `'approved'`, NOT `'accepted'`, and their CHECK
 * constraints permit exactly `pending|approved|rejected|user_deleted`. The two
 * new columns use `pending|approved|rejected`. One vocabulary reaches the
 * database; the desk's own word never does.
 *
 * ⛔ `'user_deleted'` IS NOT A DESK DECISION and this map cannot produce it. It
 * is the GUEST withdrawing their own words, and a host must never be able to
 * write it — that would record the guest as having taken something back that
 * they did not.
 */
export function statusForDatabase(status: DeskStatus): 'pending' | 'approved' | 'rejected' {
  return status === 'accepted' ? 'approved' : status;
}

export function statusFromDatabase(value: string | null | undefined): DeskStatus {
  if (value === 'approved') return 'accepted';
  if (value === 'rejected') return 'rejected';
  // 'user_deleted' reads as pending on purpose: it is not a decision the host
  // made, and the row is withheld by `wordsHeldBack` regardless.
  return 'pending';
}

/** Which table and key a decision is written to. Never derived at the call site. */
export const DESK_WRITE_TARGET: Record<
  DeskSource,
  { table: string; key: string; reviewedAtColumn: string | null }
> = {
  kwento: {
    table: 'photo_messages',
    key: 'message_id',
    reviewedAtColumn: 'reviewed_by_couple_at',
  },
  letter: {
    table: 'guest_columns',
    key: 'column_id',
    // ⚠ NOT `reviewed_by_couple_at` — the near-clone diverges here, and using
    // Kwento's name makes PostgREST refuse the WHOLE update as an unknown column.
    reviewedAtColumn: 'reviewed_at',
  },
  challenge: {
    table: 'papic_mission_completions',
    key: 'completion_id',
    reviewedAtColumn: null, // the host holds UPDATE on `status` and nothing else
  },
  supplier: {
    table: 'editorial_vendor_media',
    key: 'media_id',
    reviewedAtColumn: null, // same: one column granted, deliberately
  },
};
