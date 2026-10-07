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
import type { GuestsGetIn } from './who-can-reply';
import type { GuestRole } from './guests';
import { REQUEST_ENTRY_SOURCE, guestRoleLabel } from './guests';
import type { RoleNames } from './role-names';
import { roleLabel } from './entourage';
import { sanitizeRolePalette } from './mood-board';
import { resolveDisplayPalette } from './room-palette';
import { sanitizeRoleAttire } from './role-dress-code';
import { resolveGuestAttireWithGroups, sanitizeGroupAttire } from './role-group-dress-code';
import type { ArrivalAction } from './arrival-action';

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
  /** The role's call time, formatted ("2:00 PM") — null when unset. */
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
}): GuestMeFacts {
  const role = input.role ?? null;
  const config = (input.dressCodeConfig && typeof input.dressCodeConfig === 'object' ? input.dressCodeConfig : {}) as {
    roles?: unknown;
    groups?: unknown;
  };
  const roles = sanitizeRoleAttire(config.roles, (v) => roleLabel(v as GuestRole) !== null);
  const groups = sanitizeGroupAttire(config.groups);
  const board = resolveDisplayPalette(sanitizeRolePalette(input.rolePalette));
  const { panel } = resolveGuestAttireWithGroups({ role, roles, groups, palette: board, names: input.roleNames ?? null });
  const named =
    role && role !== 'guest'
      ? panel?.roleLabel ?? roleLabel(role, input.roleNames) ?? guestRoleLabel(role, input.roleNames)
      : null;
  return {
    role: named && named.trim() ? named : null,
    wear: Boolean(panel && (panel.styleLabel !== null || panel.hexes.length > 0)),
    arriveBy: panel?.callTime ?? null,
    comingWith: (input.comingWith ?? []).map((n) => (n ?? '').trim()).filter((n) => n.length > 0),
  };
}

/** Is this reader a guest on the couple's list (rule 2)? */
export function readerIsListed(reader: { kind: 'guest'; entrySource?: string | null } | { kind: 'visitor' }): boolean {
  return reader.kind === 'guest' && reader.entrySource !== REQUEST_ENTRY_SOURCE;
}

/** 🔒 The parts this reader sees, in order — [] whenever any rule fails. */
export function guestMePartsShown(input: {
  /** The new Maker's guest side is on for this event (`guestStagesOn`). */
  on: boolean;
  getIn: GuestsGetIn;
  listed: boolean;
  facts: GuestMeFacts;
}): GuestMePart[] {
  if (!input.on || input.getIn !== 'list' || !input.listed) return [];
  const f = input.facts;
  return GUEST_ME_PARTS.filter((p) =>
    p === 'role' ? f.role !== null : p === 'wear' ? f.wear : p === 'arrive' ? f.arriveBy !== null : f.comingWith.length > 0,
  );
}

/* ── THE REPLY CARD ─────────────────────────────────────────────────────── */

/**
 * ✉ THE REPLY CARD — under the names on Welcome and at the top of Me (owner
 * 2026-10-06). It is the doorway to the shipped reply sheet, never a second
 * form: ONE control, and never the Yes / No buttons.
 *
 *   before   "Will you join us?" · "Reply by …" · Reply
 *   coming   "You're coming · N seats" · Change my reply
 *   can't    "You can't make it" · Change my reply
 *
 * Built on the page's ONE action (`resolveArrivalAction`): only its three
 * reply states become the card; on the day and after, the action keeps its
 * own words ("Show your ticket", "See the photos"). Null: no card.
 */
export type ReplyCard = {
  kind: 'ask' | 'going' | 'declined';
  /** The line above the control. */
  line: string;
  /** "Reply by Friday, March 12, 2027" — the host's own date only, or null. */
  replyBy: string | null;
  /** The control's words. */
  cta: 'Reply' | 'Change my reply';
  href: string;
};

export function replyCardOf(input: {
  action: ArrivalAction | null;
  /** The formatted host-set reply-by date (`guestReplyBy`), or null. */
  replyBy: string | null;
  /** This guest's seats: themself plus the extra seats they bring (`plusOneSeats`). */
  seats: number;
  solemn?: boolean;
}): ReplyCard | null {
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
    return { kind: 'going', line: `You’re coming · ${n} ${n === 1 ? 'seat' : 'seats'}`, replyBy: null, cta: 'Change my reply', href: a.href };
  }
  return { kind: 'declined', line: 'You can’t make it', replyBy: null, cta: 'Change my reply', href: a.href };
}
