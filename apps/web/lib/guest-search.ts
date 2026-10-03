/**
 * apps/web/lib/guest-search.ts
 *
 * ONE QUESTION, ONE ANSWER: DOES THIS GUEST MATCH WHAT WAS TYPED?
 *
 * ⚖ Owner 2026-10-03 (live screenshots — "VIP" and "Bestman" found nobody): the
 * Guests search must match ANY part of a guest — every name part, the reply in
 * any of the words people use for it, the role however it is spelled
 * ("bestman" = "Best Man"), the group, the side, the tags, the table, and every
 * answer they gave on their RSVP (meal, dietary note, +1 name, song request,
 * their note to you).
 *
 * 🔑 THERE IS ONE MATCHER. The Guest list answers `?q=` with it (`page.tsx`), and
 * the top bar's "Search guests" box writes that `?q=` (`guests-top-search.tsx`) —
 * so the box at the top and the list under it can never disagree about who
 * matches. Before this file the rule lived inline in the page's filter loop, a
 * plain `haystack.includes(q)` — which is why "bestman" missed "Best Man".
 *
 * Pure: no I/O. Everything that is not on the guest row itself (their groups,
 * their table, their song requests, the couple's own role words) arrives in
 * `facts`, read once by the caller.
 *
 * ⛔ No custom RSVP questions exist in the schema today (the RSVP form asks the
 * six fixed things in `lib/rsvp-ask.ts`). When one does, its answers belong in
 * `facts.answers` — the slot is here so it never needs a second matcher.
 */

import {
  GROUP_CATEGORY_LABELS,
  MEAL_LABELS,
  ROLE_LABELS,
  RSVP_LABELS,
  RSVP_ROW_WORDS,
  SIDE_LABELS,
  guestRoleLabel,
  type GuestRow,
  type RsvpStatus,
} from '@/lib/guests';
import { importanceGroupOf, roleGroupLabel, ROLE_GROUP_LABELS } from '@/lib/role-groups';
import type { RoleNames } from '@/lib/role-names';

/** The parts of a guest row the search reads. */
export type GuestSearchRow = Pick<
  GuestRow,
  | 'first_name'
  | 'last_name'
  | 'role'
  | 'side'
  | 'group_category'
  | 'rsvp_status'
  | 'custom_tags'
> &
  Partial<
    Pick<
      GuestRow,
      | 'name_prefix'
      | 'middle_name'
      | 'name_suffix'
      | 'display_name'
      | 'email'
      | 'mobile'
      | 'extra_roles'
      | 'meal_preference'
      | 'dietary_restrictions'
      | 'plus_one_name'
      | 'guest_note'
      | 'notes'
      | 'relation'
    >
  >;

/** What the caller knows about a guest that is not on their row. */
export type GuestSearchFacts = {
  /** The couple's own words for roles (`events.role_names`). */
  roleNames?: RoleNames | null;
  /** A sideless event: no side words (every guest is "both", so "both" would match all). */
  hasSides?: boolean;
  /** Their custom groups' labels (and those groups' team-side words). */
  groupLabels?: readonly string[];
  /** The label of the table they are placed at, if any. */
  tableLabel?: string | null;
  /** Their song requests, "Title Artist". */
  songRequests?: readonly string[];
  /** Any further answers (custom RSVP questions, when they exist). */
  answers?: readonly string[];
};

// ── THE REPLY, IN EVERY WORD PEOPLE USE FOR IT ─────────────────────────────
// The roster says "No reply" / "Not coming"; other screens say Pending /
// Declined; people type "accepted", "coming", "going". Each is the same answer.
const REPLY_WORDS: Record<RsvpStatus, readonly string[]> = {
  attending: ['attending', 'accepted', 'accept', 'coming', 'going', 'confirmed', 'yes'],
  pending: ['no reply', 'pending', 'not replied', 'no answer', 'waiting', 'awaiting'],
  declined: ['declined', 'not coming', 'not going', 'cant come', 'regrets', 'no'],
  maybe: ['maybe', 'not sure', 'unsure'],
};

/**
 * A query that IS a reply word answers by the reply alone: "coming" is a
 * substring of "not coming", so without this the attending search would also
 * list everybody who declined.
 */
function replyStatusOf(normalizedQuery: string): RsvpStatus | null {
  // "yes" / "no" alone are too easily the start of a name ("Nora") — they only
  // count inside the haystack, never as a whole-query reply filter.
  if (normalizedQuery === 'yes' || normalizedQuery === 'no') return null;
  for (const status of Object.keys(REPLY_WORDS) as RsvpStatus[]) {
    const words = [...REPLY_WORDS[status], RSVP_LABELS[status], RSVP_ROW_WORDS[status]].map(normalizeSearchText);
    if (words.includes(normalizedQuery) || words.map(squash).includes(squash(normalizedQuery))) return status;
  }
  return null;
}

// ── ROLE SPELLINGS ─────────────────────────────────────────────────────────
// Extra words a role answers to, beyond its label. Joined forms ("bestman",
// "flowergirl") need no entry — `squash` below matches them already.
const ROLE_ALIASES: Partial<Record<GuestRow['role'], readonly string[]>> = {
  bride: ['host', 'couple'],
  groom: ['host', 'couple'],
  maid_of_honor: ['moh'],
  matron_of_honor: ['moh'],
  best_man: ['bm'],
  principal_sponsor: ['ninong', 'ninang', 'godparent'],
  principal_sponsor_ninong: ['godfather', 'sponsor'],
  principal_sponsor_ninang: ['godmother', 'sponsor'],
  officiant: ['priest', 'pastor', 'minister'],
  soloist_musician: ['singer', 'band'],
};

/**
 * Lower-case, accents off, British "-our" read as "-or", apostrophes dropped
 * ("Bride's" → "brides"), every other mark a space, spaces collapsed.
 */
export function normalizeSearchText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/honour/g, 'honor')
    .replace(/colour/g, 'color')
    .replace(/&/g, ' and ')
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9@.+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Spaces out — so "bestman" meets "best man" and "maidofhonor" meets "Maid of Honor". */
function squash(s: string): string {
  return s.replace(/\s+/g, '');
}

/** Levenshtein distance, capped — a role word typed one or two letters off still counts. */
function within(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return false;
    prev = cur;
  }
  return prev[b.length]! <= max;
}

/** Every word a guest's role(s) answer to — labels, the couple's words, the group heading, aliases. */
function roleWords(g: GuestSearchRow, names?: RoleNames | null): string[] {
  const roles = [g.role, ...(g.extra_roles ?? [])];
  const out: string[] = [];
  for (const r of roles) {
    out.push(ROLE_LABELS[r], guestRoleLabel(r, names), r.replace(/_/g, ' '), ...(ROLE_ALIASES[r] ?? []));
  }
  const grp = importanceGroupOf(roles);
  if (grp !== 'guest') out.push(ROLE_GROUP_LABELS[grp], roleGroupLabel(grp, names));
  return out;
}

/** Everything the search reads about one guest, as one normalized string. */
export function guestSearchText(g: GuestSearchRow, facts: GuestSearchFacts = {}): string {
  const hasSides = facts.hasSides !== false;
  const table = facts.tableLabel?.trim();
  const parts: (string | null | undefined)[] = [
    // Every name part.
    g.name_prefix,
    g.first_name,
    g.middle_name,
    g.last_name,
    g.name_suffix,
    g.display_name,
    g.email,
    g.mobile,
    // Role, however it is said.
    ...roleWords(g, facts.roleNames),
    // Side — never on a sideless event.
    hasSides ? SIDE_LABELS[g.side] : null,
    GROUP_CATEGORY_LABELS[g.group_category],
    ...(facts.groupLabels ?? []),
    // Tags (VIP…).
    ...g.custom_tags,
    // The table, with its word, so "table 9" and "9" both land.
    table ? (/^table\b/i.test(table) ? table : `table ${table} ${table}`) : null,
    // The reply, in every word for it.
    ...REPLY_WORDS[g.rsvp_status],
    RSVP_LABELS[g.rsvp_status],
    RSVP_ROW_WORDS[g.rsvp_status],
    // Every RSVP answer.
    g.meal_preference ? MEAL_LABELS[g.meal_preference] : null,
    g.dietary_restrictions,
    g.plus_one_name,
    g.guest_note,
    ...(facts.songRequests ?? []),
    ...(facts.answers ?? []),
    // The couple's own note and the relation (tea ceremony).
    g.notes,
    g.relation,
  ];
  return normalizeSearchText(parts.filter((p): p is string => Boolean(p && p.trim())).join(' | '));
}

/**
 * Does `query` match this guest? Empty → yes.
 *
 *   1. A query that IS a reply word ("coming", "no reply") → by the reply alone.
 *   2. Every typed word must land somewhere — as typed, or with the spaces out
 *      ("bestman"), or (a role word of 5+ letters) one or two letters off.
 */
export function guestMatchesSearch(query: string, g: GuestSearchRow, facts: GuestSearchFacts = {}): boolean {
  const q = normalizeSearchText(query ?? '');
  if (!q) return true;
  const status = replyStatusOf(q);
  if (status) return g.rsvp_status === status;

  const hay = guestSearchText(g, facts);
  if (hay.includes(q)) return true;
  const flat = squash(hay);

  const roleTerms = roleWords(g, facts.roleNames).flatMap((w) => {
    const n = normalizeSearchText(w);
    return [...n.split(' '), squash(n)];
  });
  return q.split(' ').every((t) => {
    if (hay.includes(t) || flat.includes(t)) return true;
    if (t.length < 5) return false;
    const max = t.length >= 8 ? 2 : 1;
    return roleTerms.some((w) => w.length >= 4 && within(t, w, max));
  });
}
