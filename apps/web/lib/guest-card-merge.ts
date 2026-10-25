/**
 * lib/guest-card-merge.ts — THE GUEST CARD SAVES ONLY WHAT THIS SCREEN CHANGED (owner 2026-10-18, two hosts never
 * overwrite — the "merge from base" pattern, `lib/merge-from-base.ts`, in its row shape).
 *
 * 🔴 BEFORE: the card autosaves every pause by posting the WHOLE card (`updateGuest` writes ~25 columns), and its Undo
 * posts the whole previous card. A card left open on one screen while another host — or the GUEST, answering from their
 * phone — changed that guest wrote every old value straight back: the other host's phone number, the guest's own
 * "Attending", their photo consent. Silently.
 *
 * 🔑 NOW the card posts, beside its fields, the card it started from (`MERGE_BASE_FIELD`: field → posted values, the
 * autosave's own `fieldsOf` spelling). `updateGuest` writes only the columns whose fields this screen changed; every
 * other column keeps what the row holds now. A column both changed: this later save wins (`clashed`). `fresh` names
 * the fields the row holds differently from what this screen started with — measured, not yet drawn on the open card
 * (the card rides in the Maker's first load, at its ceiling; it shows the newest when it next opens). A post with no
 * base (the standalone route, an older page) is written whole, exactly as before.
 *
 * Pure — no I/O. The FormData spelling: every value of a field, as JSON (`["Juan"]`); an unticked box posts nothing.
 */
import { changedFields } from './merge-from-base';

export { MERGE_BASE_FIELD } from './merge-from-base';

/** Plumbing, never a field — not compared, not written. */
export const GUEST_CARD_PLUMBING = new Set(['quiet', 'return_to', 'base']);

/**
 * Each `guests` column `updateGuest` writes → the card fields it is made from. A column is written when ANY of its
 * fields changed. A column missing here is always written (the safe direction: the old behaviour).
 */
export const GUEST_COLUMN_FIELDS: Readonly<Record<string, readonly string[]>> = {
  first_name: ['first_name'],
  last_name: ['last_name'],
  name_prefix: ['name_title', 'name_prefix'],
  gender: ['name_title'],
  middle_name: ['middle_name'],
  name_suffix: ['name_suffix'],
  display_name: ['display_name'],
  side: ['side'],
  group_category: ['group_category'],
  role: ['role'],
  attire: ['attire'],
  email: ['email'],
  mobile: ['mobile'],
  meal_preference: ['meal_preference'],
  dietary_restrictions: ['dietary_restrictions'],
  relation: ['relation'],
  seniority_rank: ['seniority_rank'],
  // The couple's answer is forced to attending by role, so a role change rewrites it too.
  rsvp_status: ['rsvp_status', 'role'],
  rsvp_responded_at: ['rsvp_status', 'role'],
  photo_consent: ['photo_consent'],
  faceblock_enabled: ['faceblock_enabled'],
  face_recognition_excluded: ['face_recognition_excluded'],
  passed_away: ['passed_away', 'role'],
  plus_one_count: ['plus_one_count'],
  plus_one_allowed: ['plus_one_allowed'],
  notes: ['notes'],
  host_note_for_guest: ['host_note_for_guest'],
  // Extra roles are filtered by the primary role, so a role change rewrites them.
  extra_roles: ['extra_roles', 'role'],
};

/** How a row's value reads as the card posts it — the fields compared with what the screen started from. */
type Kind = 'text' | 'bool' | { fallback: string };
export const GUEST_CARD_COMPARED: Readonly<Record<string, Kind>> = {
  first_name: 'text',
  last_name: 'text',
  middle_name: 'text',
  name_suffix: 'text',
  display_name: 'text',
  side: 'text',
  group_category: 'text',
  role: { fallback: 'guest' },
  attire: { fallback: 'neutral' },
  email: 'text',
  mobile: 'text',
  meal_preference: { fallback: 'no_preference' },
  dietary_restrictions: 'text',
  relation: 'text',
  seniority_rank: 'text',
  rsvp_status: { fallback: 'pending' },
  notes: 'text',
  host_note_for_guest: 'text',
  plus_one_count: { fallback: '0' },
  photo_consent: 'bool',
  faceblock_enabled: 'bool',
  face_recognition_excluded: 'bool',
  passed_away: 'bool',
};

/** The guest columns `updateGuest` reads to compare (the field names above are the column names). */
export const GUEST_CARD_COMPARED_COLUMNS = Object.keys(GUEST_CARD_COMPARED);

/** A form's fields in the autosave's spelling: field → JSON of every posted value. */
export function guestCardFields(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of new Set(fd.keys())) {
    if (GUEST_CARD_PLUMBING.has(key)) continue;
    out[key] = JSON.stringify(fd.getAll(key).map((v) => (typeof v === 'string' ? v : '')));
  }
  return out;
}

function rowField(kind: Kind, v: unknown): string | undefined {
  if (kind === 'bool') return v === true ? JSON.stringify(['on']) : undefined;
  const s = v === null || v === undefined || v === '' ? (typeof kind === 'object' ? kind.fallback : '') : String(v);
  return JSON.stringify([s]);
}

export type GuestCardMerge = {
  /** The post said what it started from. False: write the whole card, as before. */
  based: boolean;
  /** Fields this screen changed. */
  changed: Set<string>;
  /** Fields both this screen and another changed — this save's value kept. */
  clashed: string[];
  /** Fields the row now holds differently from what this screen started with, and this screen did NOT change: their values, for the card. */
  fresh: Record<string, string[]>;
};

/**
 * `rawBase`: the posted base (JSON text of field → JSON values). `row`: the guest as it is now (null = unread — then
 * nothing is said about other screens, and only the changed columns are still written).
 */
export function guestCardMerge(rawBase: unknown, fd: FormData, row: Record<string, unknown> | null): GuestCardMerge {
  let base: Record<string, string> | null = null;
  if (typeof rawBase === 'string' && rawBase) {
    try {
      const parsed = JSON.parse(rawBase) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        base = Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'));
      }
    } catch {
      base = null;
    }
  }
  if (!base) return { based: false, changed: new Set(), clashed: [], fresh: {} };
  const mine = guestCardFields(fd);
  const changed = changedFields(base, mine);
  const clashed: string[] = [];
  const fresh: Record<string, string[]> = {};
  if (row) {
    for (const [field, kind] of Object.entries(GUEST_CARD_COMPARED)) {
      // A field this card does not carry (the couple's row has no Passed away) says nothing.
      if (!(field in base) && !(field in mine) && kind !== 'bool') continue;
      if (kind === 'bool' && !(field in base) && !(field in mine) && !(field in row)) continue;
      const now = rowField(kind, row[field]);
      if (now === base[field]) continue; // nobody else moved it
      if (changed.has(field)) {
        if (now !== mine[field]) clashed.push(field);
      } else {
        fresh[field] = now === undefined ? [] : (JSON.parse(now) as string[]);
      }
    }
  }
  return { based: true, changed, clashed, fresh };
}

/** Is this column written by this save? Every column when the post had no base. */
export function guestColumnWritten(column: string, m: GuestCardMerge): boolean {
  if (!m.based) return true;
  const fields = GUEST_COLUMN_FIELDS[column];
  if (!fields) return true;
  return fields.some((f) => m.changed.has(f));
}
