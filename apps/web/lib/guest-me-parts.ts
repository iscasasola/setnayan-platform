/**
 * lib/guest-me-parts.ts — 👤 THE FOUR FOR-EACH-GUEST PARTS ON INVITATION › ME,
 * AND THE REPLY CARD — what a guest is shown, decided once (plan
 * `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3 PR 6).
 *
 * Owner, 2026-10-06, verbatim: *"they will have their own elements per custom
 * part for each guest"* · *"these personalization will not be available of they
 * are not actual guests with roles and personalization."* DECISION_LOG
 * "'YOUR DETAILS' LIVES ON INVITATION › ME", "PERSONAL PARTS ARE FOR REAL LISTED
 * GUESTS ONLY", "THE INVITATION HAS A REPLY CARD, NOT A SECOND FORM".
 *
 * ── THE FOUR (the Maker's `my` keys, `lib/maker-parts.ts`) ──────────────────
 *   role    Your role        `guests.role` (never the plain "guest"), in the
 *                            couple's words (`roleLabel` → `guestRoleLabel`)
 *   wear    What to wear     the outfit and colours the couple set for that
 *                            role (`dress_code_config.roles`/`groups` +
 *                            the Mood Board, `resolveGuestAttireWithGroups`) —
 *                            NEVER a default style: no outfit and no colour set
 *                            = no part
 *   arrive  Arrive by        the role's call time — the one per-role time the
 *                            shipped data holds today (`callTime` on the same
 *                            dress-code rule). The Schedule's "For ▾" moment is
 *                            step 4c's and not on main yet; when it lands this
 *                            is where it joins.
 *   guests  Coming with you  the named companions on this guest's own seats
 *                            (`plus_one_of_guest_id`, `yourGuestsFor`)
 *
 * 🔒 WHO SEES THEM — ALL THREE MUST HOLD, AND THEN ONLY THE FACTS THE ROW HAS:
 *   1. How guests get in = List only · Guests reply (`readGuestsGetIn` = 'list');
 *   2. the reader is a guest ON THE LIST — opened their own invitation, and not
 *      a request still waiting (`entry_source` ≠ `self_added_unlisted`). A
 *      visitor on the plain address has no guest row at all; an open-QR guest
 *      or an approved request only exists under the other four choices, which
 *      rule 1 already closes;
 *   3. the part's own fact is on their row — a part with nothing to say is not
 *      drawn (no "Outfit to be confirmed", no "—").
 *
 * Pure. No I/O, no React.
 */
import { type ReaderPerson } from '@/lib/attire-rows';
import { guestOutfitOf } from './guest-outfit';
import { replyWindowWords, type ReplyWindow } from './reply-window';
import type { GuestsGetIn } from './who-can-reply';
import type { GuestRole } from './guests';
import { REQUEST_ENTRY_SOURCE, guestRoleLabel } from './guests';
import type { RoleNames } from './role-names';
import { roleLabel } from './entourage';
import { sanitizeRolePalette } from './mood-board';
import { resolveDisplayPalette } from './room-palette';
import type { ArrivalAction } from './arrival-action';
import { hostNoteHeading, hostNoteShown } from './guest-host-note';
import { moreAnswersWords } from './guest-one-path';

/** The four, in the Me page's order (`MAKER_STAGE_PAGES.rsvp.me`). */
export const GUEST_ME_PARTS = ['role', 'wear', 'arrive', 'guests'] as const;
export type GuestMePart = (typeof GUEST_ME_PARTS)[number];

/** Each part's heading — the Maker's tile words (`MAKER_PARTS.my*.label`). */
export const GUEST_ME_PART_LABEL: Readonly<Record<GuestMePart, string>> = {
  role: 'Your role',
  wear: 'What to wear',
  arrive: 'Arrive by',
  guests: 'Coming with you',
};

/** What this guest's own row says, read through the shipped resolvers. */
export type GuestMeFacts = {
  /** The role in the couple's words — null for a plain guest. */
  role: string | null;
  /** An outfit or a colour the couple set for this role. */
  wear: boolean;
  /** The role's call time, formatted ("2:00 PM") — else the guests' own arrival (`guestsArriveBy`); null when neither is set. */
  arriveBy: string | null;
  /** The named companions on this guest's seats. */
  comingWith: string[];
};

/** Read the facts. Every input is the page's own already-loaded row. */
export function guestMeFacts(input: {
  role: GuestRole | null | undefined;
  dressCodeConfig: unknown;
  rolePalette: unknown;
  roleNames?: RoleNames | null;
  comingWith?: ReadonlyArray<string | null | undefined>;
  /** ⏰ When GUESTS arrive ("2:30 PM", `guestsArriveTime` — the invitation's first moment, the dress code's Guests call
   *  time, owner 2026-10-19). A plain guest's Arrive by; a role's own call time still wins. */
  guestsArriveBy?: string | null;
  /** 👤 The reader's own row (`guestNamePartsOf` + attire) — the role word and their own Wear, as the parts draw them. */
  person?: (NonNullable<ReaderPerson> & { attire?: unknown }) | null;
}): GuestMeFacts {
  const role = input.role ?? null;
  const board = resolveDisplayPalette(sanitizeRolePalette(input.rolePalette));
  /* 👗 THE ONE READING (`guestOutfitOf`, lib/guest-outfit.ts): the role's answer (`resolveGuestAttireWithGroups`), then
     the reader's OWN pick of it (`readerAttire`, the same reader the Dress code's "You are …" and the checklist use) — a
     man of honor or a best woman is not told they have a Wear because the other column of their honour row has one.
     The guest card's "Attire · 3D seat plan" line and the 3D seat plan's figure read the very same call. */
  const outfit = guestOutfitOf({ role, dressCodeConfig: input.dressCodeConfig, palette: board, roleNames: input.roleNames ?? null, person: input.person ?? null });
  const panel = outfit.panel;
  const named =
    role && role !== 'guest'
      ? panel?.roleLabel ?? roleLabel(role, input.roleNames) ?? guestRoleLabel(role, input.roleNames)
      : null;
  return {
    role: named && named.trim() ? named : null,
    wear: Boolean(panel && (outfit.styleLabel !== null || (outfit.hexes?.length ?? 0) > 0)),
    arriveBy: panel?.callTime ?? input.guestsArriveBy ?? null,
    comingWith: (input.comingWith ?? []).map((n) => (n ?? '').trim()).filter((n) => n.length > 0),
  };
}

/** Is this reader a guest on the couple's list (rule 2)? */
export function readerIsListed(reader: { kind: 'guest'; entrySource?: string | null } | { kind: 'visitor' }): boolean {
  return reader.kind === 'guest' && reader.entrySource !== REQUEST_ENTRY_SOURCE;
}

/** 🔒 Rules 1 and 2 — the Me page's personal half is open to this reader at all. */
function meIsPersonal(input: { getIn: GuestsGetIn; listed: boolean }): boolean {
  return input.getIn === 'list' && input.listed;
}

/** 🔒 The parts this reader sees, in order — [] whenever any rule fails. */
export function guestMePartsShown(input: {
  getIn: GuestsGetIn;
  listed: boolean;
  facts: GuestMeFacts;
}): GuestMePart[] {
  if (!meIsPersonal(input)) return [];
  const f = input.facts;
  return GUEST_ME_PARTS.filter((p) =>
    p === 'role' ? f.role !== null : p === 'wear' ? f.wear : p === 'arrive' ? f.arriveBy !== null : f.comingWith.length > 0,
  );
}

/**
 * 💌 THE HOSTS' NOTE TO THIS GUEST, on Me under Your role (owner 2026-10-20, DECISION_LOG "A NOTE FOR ONE GUEST" —
 * `lib/guest-host-note.ts`). Not one of the four parts (those are the Maker's `my` tiles); it sits between Your role and
 * What to wear and follows the SAME three rules: the personal half is open (1 · 2), and THIS row carries a note (3).
 * `note` is the reader's own `guests.host_note_for_guest` — read from their own row, so it can only ever be theirs.
 * Null: nothing drawn, not even the heading.
 */
export function guestMeNoteShown(input: {
  getIn: GuestsGetIn;
  listed: boolean;
  note: string | null | undefined;
  /** The event's names ("Jodalicca & Claire") — the heading's "from". */
  eventNames: string | null | undefined;
  /** The event's own word for its hosts ("the couple") — when the event has no name. */
  theOrganizer: string;
}): GuestMeNote | null {
  if (!meIsPersonal(input)) return null;
  const text = hostNoteShown(input.note);
  return text ? { heading: hostNoteHeading(input.eventNames, input.theOrganizer), text } : null;
}
export type GuestMeNote = { heading: string; text: string };

/* ── THE REPLY CARD ─────────────────────────────────────────────────────── */

/**
 * ✉ THE REPLY CARD — under the names on Welcome and at the top of Me (owner
 * 2026-10-06). It is the doorway to the shipped reply sheet, never a second
 * form: ONE control, and never the Yes / No buttons.
 *
 *   before   "Will you join us?" · "Reply by …" · Reply
 *   coming   "You're coming · N seats" · Change my reply
 *            …with switched-on answers still missing: "N more answers" in
 *            place of "Change my reply" (owner 2026-10-20 — `moreAnswersOf`)
 *   can't    "You can't make it" · Change my reply
 *
 * Built on the page's ONE action (`resolveArrivalAction`): only its three
 * reply states become the card; on the day and after, the action keeps its
 * own words ("Show your ticket", "See the photos"). Null: no card.
 */
export type ReplyCard =
  | {
      kind: 'ask' | 'going' | 'declined';
      /** The line above the control. */
      line: string;
      /** "Reply by Friday, March 12, 2027" — the host's own date only, or null. */
      replyBy: string | null;
      /** The control's words — "Reply", "Change my reply", or "N more answers" (`moreAnswersWords`). */
      cta: string;
      href: string;
      /**
       * ✉️ How many of the couple's switched-on questions this ATTENDING guest still owes — the reply page's own missing
       * set (`moreAnswersOf`, lib/guest-one-path.ts). Present only when > 0; the `href` then opens the reply page, which
       * asks only those.
       */
      more?: number;
    }
  | {
      /**
       * 📬 THE COUPLE'S REPLY WINDOW IS SHUT (owner 2026-10-14, DECISION_LOG 📬 items 2–3):
       *   not yet  "Replies open on Saturday, 14 November" — no button
       *   closed   "Replies are closed." · "Need to change? Message the couple." — no Reply, no Change
       */
      kind: 'not_yet' | 'closed';
      line: string;
      /** The line under it ("Need to change? Message the couple."), or null. */
      replyBy: string | null;
      cta: null;
      href: null;
    };

export function replyCardOf(input: {
  action: ArrivalAction | null;
  /** The formatted host-set reply-by date (`guestReplyBy`), or null. */
  replyBy: string | null;
  /** This guest's seats: themself plus the extra seats they bring (`plusOneSeats`). */
  seats: number;
  solemn?: boolean;
  /** 📬 The couple's reply window (`replyWindow`, lib/reply-window.ts). Absent = open. */
  window?: ReplyWindow;
  /** The event's word for its hosts ("the couple") — for "Need to change? Message …". */
  organizer?: string;
  /**
   * ✉️ `moreAnswersOf(rsvpGate(…))` — the answers this attending guest still owes (owner 2026-10-20). 0 / null / absent:
   * the card as shipped ("Change my reply"); null is "could not be read", never a number.
   */
  moreAnswers?: number | null;
}): ReplyCard | null {
  const shut = input.window ? replyWindowWords(input.window, input.organizer) : null;
  if (shut && input.window && input.window.state !== 'open') {
    return { kind: input.window.state, line: shut.line, replyBy: shut.sub, cta: null, href: null };
  }
  const a = input.action;
  if (!a || (a.kind !== 'ask' && a.kind !== 'going' && a.kind !== 'declined')) return null;
  if (a.kind === 'ask') {
    return {
      kind: 'ask',
      line: input.solemn ? 'Will you be with us?' : 'Will you join us?',
      replyBy: input.replyBy ? `Reply by ${input.replyBy}` : null,
      cta: 'Reply',
      href: a.href,
    };
  }
  if (a.kind === 'going') {
    const n = Math.max(1, Math.trunc(input.seats));
    const line = `You’re coming · ${n} ${n === 1 ? 'seat' : 'seats'}`;
    const more = typeof input.moreAnswers === 'number' && input.moreAnswers > 0 ? Math.trunc(input.moreAnswers) : 0;
    if (more > 0) return { kind: 'going', line, replyBy: null, cta: moreAnswersWords(more), href: a.href, more };
    return { kind: 'going', line, replyBy: null, cta: 'Change my reply', href: a.href };
  }
  return { kind: 'declined', line: 'You can’t make it', replyBy: null, cta: 'Change my reply', href: a.href };
}
