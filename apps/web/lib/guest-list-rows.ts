/**
 * lib/guest-list-rows.ts — WHAT THE GUEST LIST'S ROWS NEED, AND WHAT THE PHONE KEEPS OF THEM.
 *
 * Owner, 2026-10-16: *"wouldnt it be better for someone to just have a excel file for their guests that
 * loads fast instead of always waiting for that 2.5 sec load everytime?"* · *"We want us to be a practical
 * reason to use."*
 *
 * Two lists of fields, one per audience, both PURE (no React, no server) so the guards execute them:
 *
 *   · `GUEST_LIST_ROW_FIELDS` — what `GuestsScreen` (the client half of /guests) DRAWS and SEARCHES. The page
 *     reads whole guest rows on the server (it sorts by `created_at`, signs `photo_url`, opens a card from
 *     them), but only these travel to the phone in the page's payload. The other ~18 columns — the guest's
 *     QR token among them — never left the server for the list's sake. The guest CARD reads its own row
 *     when it opens (`loadGuestCard`), so nothing it shows depends on this list.
 *     🔒 `app/dashboard/[eventId]/guests/the-list-sends-only-what-it-draws.test.ts` renders the real screen
 *     over rows that record every field read, through every Sort, the map and the search.
 *
 *   · `GUEST_COPY_ROW_FIELDS` — what the PHONE KEEPS (the last-seen store, `lib/last-seen/store.ts`) so the
 *     next open draws the list at once: only what a row SHOWS — the name, the side dot, the reply, the
 *     +N, the guest's own note, the role that places it in a section. Never the mobile, the email, the
 *     couple's private notes or the diet; the search over a kept copy matches names, roles, groups and
 *     tables, and the fresh list (moments later) brings the rest.
 */
import type { GuestRow } from './guests';
import type { RoleNames } from './role-names';

/** Drawn or searched by the list (and read by the quick-add sheet's duplicate check, a subset). */
export const GUEST_LIST_ROW_FIELDS = [
  'guest_id',
  'first_name',
  'last_name',
  'name_prefix',
  'middle_name',
  'name_suffix',
  'display_name',
  'side',
  'role',
  'extra_roles',
  'rsvp_status',
  'entry_source',
  'passed_away',
  'invitation_sent_at',
  'plus_one_count',
  'plus_one_of_guest_id',
  'plus_one_name',
  'guest_note',
  // The search's words (lib/guest-search.ts) — never drawn on a row.
  'custom_tags',
  'group_category',
  'email',
  'mobile',
  'meal_preference',
  'dietary_restrictions',
  'notes',
  'relation',
] as const satisfies readonly (keyof GuestRow)[];

export type GuestListRow = Pick<GuestRow, (typeof GUEST_LIST_ROW_FIELDS)[number]>;

/** One row as the list needs it — a new object holding ONLY those fields. */
export function toGuestListRow(g: GuestRow): GuestListRow {
  const out = {} as Record<string, unknown>;
  for (const k of GUEST_LIST_ROW_FIELDS) out[k] = (g as Record<string, unknown>)[k] ?? null;
  // Arrays the search spreads must be arrays, never null.
  out.extra_roles = g.extra_roles ?? [];
  out.custom_tags = g.custom_tags ?? [];
  return out as GuestListRow;
}

/** What a ROW SHOWS — and so all the phone keeps of a guest. */
export const GUEST_COPY_ROW_FIELDS = [
  'guest_id',
  'first_name',
  'last_name',
  'name_prefix',
  'middle_name',
  'name_suffix',
  'display_name',
  'side',
  'role',
  'extra_roles',
  'rsvp_status',
  'entry_source',
  'passed_away',
  'invitation_sent_at',
  'plus_one_count',
  'plus_one_of_guest_id',
  'guest_note',
] as const satisfies readonly (typeof GUEST_LIST_ROW_FIELDS)[number][];

export type GuestCopyRow = Pick<GuestRow, (typeof GUEST_COPY_ROW_FIELDS)[number]>;

/** A face URL is a signed link that lasts a day; past this the copy draws initials instead of a broken picture. */
export const COPY_FACES_MAX_AGE_MS = 20 * 60 * 60 * 1000;

/** The kept Guest list — exactly what its List draws, nothing it does not. */
export type GuestListCopy = {
  v: 1;
  rows: GuestCopyRow[];
  hasSides: boolean;
  /** guest_id → their groups' labels (a section under Sort › Group). */
  groupsByGuest: Record<string, string[]>;
  /** guest_id → "Table 9". */
  tableByGuest: Record<string, string>;
  /** guest_id → a face to draw (a signed link — see COPY_FACES_MAX_AGE_MS). */
  faceByGuest: Record<string, string>;
  /** Requests to join, as the row said. */
  requests: number;
  rootLabel: string;
  /** The couple's own words for roles — the section headings. */
  roleNames: RoleNames;
};

/** What the list was showing → what the phone keeps. */
export function guestListCopyOf(input: {
  guests: readonly GuestListRow[];
  hasSides: boolean;
  groupsByGuest: Record<string, string[]>;
  tableByGuest: Record<string, string>;
  faceByGuest: Record<string, string>;
  requests: number;
  rootLabel: string;
  roleNames: RoleNames;
}): GuestListCopy {
  const rows = input.guests.map((g) => {
    const out = {} as Record<string, unknown>;
    for (const k of GUEST_COPY_ROW_FIELDS) out[k] = (g as Record<string, unknown>)[k] ?? null;
    out.extra_roles = g.extra_roles ?? [];
    return out as GuestCopyRow;
  });
  const ids = new Set(rows.map((r) => r.guest_id));
  const only = <T,>(m: Record<string, T>) => Object.fromEntries(Object.entries(m).filter(([id]) => ids.has(id)));
  return {
    v: 1,
    rows,
    hasSides: input.hasSides,
    groupsByGuest: only(input.groupsByGuest),
    tableByGuest: only(input.tableByGuest),
    faceByGuest: only(input.faceByGuest),
    requests: input.requests,
    rootLabel: input.rootLabel,
    roleNames: input.roleNames ?? {},
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/**
 * A kept copy read back → rows the list can draw, or null when it is not a copy this code wrote. The search
 * fields the phone never kept come back EMPTY (an empty tag list, no mobile) — never undefined, which the
 * search would trip on.
 */
export function guestListFromCopy(
  raw: unknown,
  savedAt: number,
  now: number = Date.now(),
): (Omit<GuestListCopy, 'rows'> & { rows: GuestListRow[] }) | null {
  if (!isRecord(raw) || raw.v !== 1 || !Array.isArray(raw.rows)) return null;
  const rows: GuestListRow[] = [];
  for (const r of raw.rows) {
    if (!isRecord(r) || typeof r.guest_id !== 'string' || typeof r.first_name !== 'string' || typeof r.last_name !== 'string') return null;
    rows.push({
      custom_tags: [],
      group_category: null as unknown as GuestRow['group_category'],
      email: null,
      mobile: null,
      meal_preference: null,
      dietary_restrictions: null,
      notes: null,
      relation: null,
      plus_one_name: null,
      ...(r as Partial<GuestListRow>),
      extra_roles: Array.isArray(r.extra_roles) ? (r.extra_roles as GuestRow['extra_roles']) : [],
    } as GuestListRow);
  }
  const rec = (v: unknown) => (isRecord(v) ? (v as Record<string, never>) : {});
  return {
    v: 1,
    rows,
    hasSides: raw.hasSides === true,
    groupsByGuest: rec(raw.groupsByGuest),
    tableByGuest: rec(raw.tableByGuest),
    // A day-old signed link no longer opens — initials, not a broken picture.
    faceByGuest: now - savedAt > COPY_FACES_MAX_AGE_MS ? {} : rec(raw.faceByGuest),
    requests: typeof raw.requests === 'number' ? raw.requests : 0,
    rootLabel: typeof raw.rootLabel === 'string' ? raw.rootLabel : '',
    roleNames: rec(raw.roleNames) as RoleNames,
  };
}
