/**
 * guest-import-file.ts — the guest list FILE: which template a host downloads,
 * and how a filled-in file becomes rows the importer understands.
 *
 * ⚖ Owner 2026-10-01 (DECISION_LOG "GUEST IMPORT = A TEMPLATE FILE YOU
 * DOWNLOAD…" + "…UPLOAD AGAIN TO UPDATE"): the host downloads a template that
 * opens in Excel, Numbers and Google Sheets, fills in names, and uploads it.
 * The importer had only ever read raw keys (`first_name,last_name,…`) pasted
 * into a box; this module is the bridge from the template's plain headers.
 *
 * Pure on purpose (no `server-only`, no Supabase): the server action and the
 * page are thin, and everything that can be got wrong here is EXECUTED by
 * guest-import-file.test.ts.
 */
import { parseCsv, type CsvRow } from './csv';
import { normalizeGuestName } from './guest-name';
import { parsePersonName } from './person-name-parse';
import { norm } from './guest-dedupe';
import { parsePhPhone } from './ph-phone';
import { formatCount } from './format-number';
import type { RoleNames } from './role-names';
import { SIDELESS_SIDE } from './guest-side-question';
import {
  GROUP_CATEGORY_LABELS,
  guestRoleLabel,
  plusOnesFromCsv,
  type GuestGroupCategory,
  type GuestRole,
  type GuestSide,
  type RsvpStatus,
} from './guests';

/** The two ready-made files (copied from the spec corpus `templates/`). */
export const GUEST_TEMPLATES = {
  /** Weddings — carries the Side column (Bride · Groom · Both). */
  withSides: {
    xlsx: '/templates/setnayan-guest-list-wedding.xlsx',
    csv: '/templates/setnayan-guest-list-wedding.csv',
  },
  /** Every other event type — no Side column. */
  withoutSides: {
    xlsx: '/templates/setnayan-guest-list.xlsx',
    csv: '/templates/setnayan-guest-list.csv',
  },
} as const;

/**
 * Which template THIS event gets. Keyed on "does the event have sides" —
 * `eventHasSides(roleSet)` from guest-side-question.ts — never on a list of
 * event-type names, so a new type inherits the right file from its profile.
 */
export function guestTemplateFor(hasSides: boolean) {
  return hasSides ? GUEST_TEMPLATES.withSides : GUEST_TEMPLATES.withoutSides;
}

// ---------------------------------------------------------------------------
// Reading a filled-in file
// ---------------------------------------------------------------------------


/** One file is one guest list; the importer has always capped a run at 200. */
export const MAX_IMPORT_ROWS = 200;

/**
 * The template's plain headers → the importer's keys. `parseCsv` has already
 * lower-cased the header and turned spaces into `_`; {@link canonicalHeader}
 * then drops anything in brackets and every non-letter, so "Their guests (+)"
 * and "Mobile (optional)" arrive here as `their_guests` and `mobile`.
 * The old raw keys (`first_name`, `plus_one_allowed`, …) still pass through
 * unchanged, so a file made the old way keeps working.
 */
const HEADER_ALIASES: Record<string, string> = {
  prefix: 'name_prefix',
  title: 'name_prefix',
  first: 'first_name',
  given_name: 'first_name',
  middle: 'middle_name',
  last: 'last_name',
  surname: 'last_name',
  suffix: 'name_suffix',
  their_guests: 'plus_ones',
  guests: 'plus_ones',
  plus_ones: 'plus_ones',
  group_category: 'group',
  mobile_number: 'mobile',
  phone: 'mobile',
};

export function canonicalHeader(key: string): string {
  const k = key
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return HEADER_ALIASES[k] ?? k;
}

/** Parse the uploaded text into rows keyed the importer's way. */
export function readGuestFile(text: string): CsvRow[] {
  // Excel and Numbers both write a UTF-8 byte-order mark at the top of a CSV;
  // left in, it glues itself to the first header and "Prefix" stops matching.
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  return rows.map((row) => {
    const out: CsvRow = {};
    for (const [k, v] of Object.entries(row)) {
      const key = canonicalHeader(k);
      // First non-empty wins if two headers land on one key.
      if (!(key in out) || (!out[key] && v)) out[key] = v;
    }
    return out;
  });
}

/** True when the bytes are a spreadsheet package (.xlsx / .numbers), not text. */
export function looksLikeSpreadsheetPackage(fileName: string, firstBytes: string): boolean {
  return /\.(xlsx|xls|numbers|ods)$/i.test(fileName) || firstBytes.startsWith('PK');
}

const SIDE_WORDS: Record<string, GuestSide> = {
  bride: 'bride',
  brides: 'bride',
  bridesside: 'bride',
  brideside: 'bride',
  groom: 'groom',
  grooms: 'groom',
  groomsside: 'groom',
  groomside: 'groom',
  both: 'both',
  bothsides: 'both',
};

function sideFromCell(v: string): GuestSide | null {
  return SIDE_WORDS[norm(v)] ?? null;
}

function groupFromCell(v: string): GuestGroupCategory | null {
  const n = norm(v);
  for (const [key, label] of Object.entries(GROUP_CATEGORY_LABELS)) {
    if (norm(key) === n || norm(label) === n) return key as GuestGroupCategory;
  }
  return null;
}

/**
 * A role cell matches its key (`bridesmaid`), its usual word ("Bridesmaid"),
 * or the couple's own word for it ("Bride's Crew", events.role_names).
 */
function roleFromCell(v: string, offered: readonly string[], names?: RoleNames | null): GuestRole | null {
  const n = norm(v);
  for (const role of offered as readonly GuestRole[]) {
    if (norm(role) === n || norm(guestRoleLabel(role)) === n || norm(guestRoleLabel(role, names)) === n) return role;
  }
  return null;
}

/** Comparable form of a mobile: E.164 for a Philippine number, else digits. */
export function mobileKey(raw: string | null | undefined): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  const ph = parsePhPhone(s);
  return ph.ok ? ph.e164 : s.replace(/\D/g, '');
}

/** What the importer writes for one person. */
export type GuestImportRecord = {
  first_name: string;
  last_name: string;
  name_prefix: string | null;
  middle_name: string | null;
  name_suffix: string | null;
  side: GuestSide;
  group_category: GuestGroupCategory;
  role: GuestRole;
  mobile: string | null;
  plus_one_count: number;
  plus_one_allowed: boolean;
  plus_one_name: string | null;
  rsvp_status: RsvpStatus;
  notes: string | null;
};

/** A guest already on the list, as the matcher needs to see them. */
export type ExistingGuest = {
  guest_id: string;
  first_name: string;
  last_name: string;
  name_prefix: string | null;
  middle_name: string | null;
  name_suffix: string | null;
  side: GuestSide;
  group_category: GuestGroupCategory;
  role: GuestRole;
  mobile: string | null;
  plus_one_count: number | null;
};

export type ImportRowStatus = 'new' | 'changed' | 'same' | 'look';

export type ImportRow = {
  /** Spreadsheet line (the header is line 1). */
  line: number;
  /** The person's name as the host will read it. */
  name: string;
  status: ImportRowStatus;
  /** Plain-words reason, for a row that needs a look. */
  reason?: string;
  /** Plain-words list of what changes, for an update. */
  changes?: string[];
  /** The guest this row updates. */
  guestId?: string;
  /** What a new row inserts. */
  record?: GuestImportRecord;
  /** What an update writes (only the fields that differ). */
  patch?: Partial<GuestImportRecord>;
};

export type ImportPlan = {
  rows: ImportRow[];
  counts: Record<ImportRowStatus, number>;
};

export type ImportContext = {
  offeredRoles: readonly string[];
  singletonRoles: readonly string[];
  hasSides: boolean;
  existing: readonly ExistingGuest[];
  /** The couple's words for roles (events.role_names) — read AND shown. */
  roleNames?: RoleNames | null;
};

const SIDE_LABEL: Record<GuestSide, string> = { bride: "Bride's side", groom: "Groom's side", both: 'Both sides' };

const nameKey = (first: string, last: string) => `${norm(first)}|${norm(last)}`;

function displayName(r: { name_prefix?: string | null; first_name: string; middle_name?: string | null; last_name: string; name_suffix?: string | null }) {
  return [r.name_prefix, r.first_name, r.middle_name, r.last_name, r.name_suffix].filter(Boolean).join(' ');
}

/**
 * THE PREVIEW. Every row of the file becomes exactly one {@link ImportRow}:
 *
 *   new      — nobody on the list matches; it will be added.
 *   changed  — the same person is already on the list; these fields update.
 *   same     — already on the list, nothing to change.
 *   look     — not added or changed until the host fixes it (reason given).
 *
 * 🔒 ONE PERSON PER ROW, NEVER MERGED. A guest on the list can be matched by
 * at most ONE row; a second row reaching the same guest — or the same name
 * twice in the file, or a name that two guests on the list already share —
 * becomes `look`, never a silent merge. Suffix is part of who someone is:
 * Juan Reyes and Juan Reyes Jr. are two people.
 *
 * Matching (owner: "same first+last name, or mobile"): by first+last first;
 * by mobile only when the first OR last name also agrees (a fixed typo, a new
 * surname) — a shared family phone never folds one person into another.
 *
 * An update never blanks a field: an empty cell leaves what is on the list,
 * and RSVP is never overwritten (the guest may have answered since the file
 * was made).
 */
export function planGuestImport(rows: readonly CsvRow[], ctx: ImportContext): ImportPlan {
  const byName = new Map<string, ExistingGuest[]>();
  const byMobile = new Map<string, ExistingGuest[]>();
  for (const g of ctx.existing) {
    const k = nameKey(g.first_name, g.last_name);
    byName.set(k, [...(byName.get(k) ?? []), g]);
    const m = mobileKey(g.mobile);
    if (m) byMobile.set(m, [...(byMobile.get(m) ?? []), g]);
  }
  const claimed = new Map<string, number>(); // guest_id → line that took it
  const seenInFile = new Map<string, number>(); // name+suffix → line
  const singletonTaken = new Map<string, string>(); // role → who holds it
  for (const g of ctx.existing) {
    if (ctx.singletonRoles.includes(g.role)) singletonTaken.set(g.role, g.guest_id);
  }

  const out: ImportRow[] = [];
  rows.forEach((row, index) => {
    const line = index + 2;
    const has = (k: string) => (row[k] ?? '').trim() !== '';
    const cell = (k: string) => (row[k] ?? '').trim();

    // Names. The template has a column for each part, so trust the cells; a
    // file made the old way (first/last only) is still read through the
    // name parser so "Atty. Bob Casasola Jr." never becomes a first name.
    const rawFirst = normalizeGuestName(row.first_name);
    const rawLast = normalizeGuestName(row.last_name);
    let first_name = rawFirst;
    let last_name = rawLast;
    let name_prefix: string | null = cell('name_prefix') || null;
    let middle_name: string | null = normalizeGuestName(row.middle_name) || null;
    let name_suffix: string | null = cell('name_suffix') || null;
    if (!('middle_name' in row) && !('name_prefix' in row) && !('name_suffix' in row)) {
      const parts = parsePersonName(`${rawFirst} ${rawLast}`.trim());
      first_name = parts.firstName || rawFirst;
      last_name = parts.lastName || rawLast;
      name_prefix = parts.prefix || null;
      middle_name = parts.middleName || null;
      name_suffix = parts.suffix || null;
    }
    const name = displayName({ name_prefix, first_name, middle_name, last_name, name_suffix }) || `Line ${line}`;
    const look = (reason: string) => out.push({ line, name, status: 'look', reason });

    if (!first_name || !last_name) return look('Needs both a first name and a last name.');

    let side: GuestSide = SIDELESS_SIDE;
    if (ctx.hasSides && has('side')) {
      const s = sideFromCell(cell('side'));
      if (!s) return look(`Side "${cell('side')}" — use Bride, Groom or Both.`);
      side = s;
    }
    let group_category: GuestGroupCategory = 'friends';
    if (has('group')) {
      const g = groupFromCell(cell('group'));
      if (!g) return look(`Group "${cell('group')}" — use ${Object.values(GROUP_CATEGORY_LABELS).join(', ')}.`);
      group_category = g;
    }
    let role: GuestRole = 'guest';
    if (has('role')) {
      const r = roleFromCell(cell('role'), ctx.offeredRoles, ctx.roleNames);
      if (!r) return look(`Role "${cell('role')}" isn't one this event uses.`);
      role = r;
    }
    let rsvp_status: RsvpStatus = 'pending';
    if (has('rsvp_status')) {
      const v = cell('rsvp_status').toLowerCase();
      if (!['pending', 'attending', 'declined', 'maybe'].includes(v)) return look(`RSVP "${cell('rsvp_status')}" isn't one we know.`);
      rsvp_status = v as RsvpStatus;
    }
    const plusGiven = has('plus_ones') || has('plus_one_count') || has('plus_one_allowed');
    const plus_one_count = plusOnesFromCsv(row);
    const mobile = cell('mobile') || null;
    const household = cell('household') || null;

    // Same name twice in the file → the second is a question, never a merge.
    const fileKey = `${nameKey(first_name, last_name)}|${norm(name_suffix ?? '')}`;
    const firstLine = seenInFile.get(fileKey);
    if (firstLine) return look(`Same name as line ${firstLine}. If they are two people, add a middle name or suffix.`);
    seenInFile.set(fileKey, line);

    // Who on the list is this?
    let match: ExistingGuest | null = null;
    const sameFirstLast = byName.get(nameKey(first_name, last_name)) ?? [];
    const exact = sameFirstLast.filter((g) => norm(g.name_suffix ?? '') === norm(name_suffix ?? ''));
    if (exact.length > 1) {
      return look(`${formatCount(exact.length)} guests on your list already have this name — edit them on the list instead.`);
    }
    if (exact.length === 1) {
      match = exact[0]!;
    } else if (sameFirstLast.some((g) => !g.name_suffix || !name_suffix)) {
      // Juan Reyes vs Juan Reyes Jr.: the same person gaining a suffix, or a
      // father and son? Only the host knows — ask, never guess.
      const g = sameFirstLast.find((x) => !x.name_suffix || !name_suffix)!;
      return look(`Is this ${displayName(g)}, already on your list? Write the suffix the same way (or a different one) so we know.`);
    } else {
      const m = mobileKey(mobile);
      const byPhone = m ? byMobile.get(m) ?? [] : [];
      if (byPhone.length > 0) {
        const kin = byPhone.filter((g) => norm(g.first_name) === norm(first_name) || norm(g.last_name) === norm(last_name));
        if (kin.length !== 1) {
          return look(`Same mobile as ${displayName(byPhone[0]!)} on your list. If this is a different person, give them their own mobile or leave it blank.`);
        }
        match = kin[0]!;
      }
    }

    if (match) {
      const prior = claimed.get(match.guest_id);
      if (prior) return look(`Line ${prior} already matches ${displayName(match)} — one row per person.`);
      claimed.set(match.guest_id, line);
    }

    // Singleton roles (bride, groom, …) can be held by one guest only.
    if (ctx.singletonRoles.includes(role) && has('role')) {
      const holder = singletonTaken.get(role);
      if (holder && holder !== match?.guest_id && holder !== `line:${line}`) {
        return look(`Only one ${guestRoleLabel(role, ctx.roleNames)} per event — someone already has it.`);
      }
      singletonTaken.set(role, match?.guest_id ?? `line:${line}`);
    }

    if (!match) {
      out.push({
        line,
        name,
        status: 'new',
        record: {
          first_name,
          last_name,
          name_prefix,
          middle_name,
          name_suffix,
          side,
          group_category,
          role,
          mobile,
          plus_one_count,
          plus_one_allowed: plus_one_count > 0,
          plus_one_name: normalizeGuestName(row.plus_one_name) || (plus_one_count > 0 ? 'TBA' : null),
          rsvp_status,
          notes: household ? `Household: ${household}` : null,
        },
      });
      return;
    }

    // An update: only what the file states AND differs. Empty cells keep what is there.
    const patch: Partial<GuestImportRecord> = {};
    const changes: string[] = [];
    const diff = <K extends keyof GuestImportRecord>(key: K, next: GuestImportRecord[K], was: unknown, label: string) => {
      if ((next ?? '') !== (was ?? '')) {
        patch[key] = next;
        changes.push(label);
      }
    };
    if (first_name !== match.first_name || last_name !== match.last_name) {
      patch.first_name = first_name;
      patch.last_name = last_name;
      changes.push('name');
    }
    if (name_prefix) diff('name_prefix', name_prefix, match.name_prefix, 'prefix');
    if (middle_name) diff('middle_name', middle_name, match.middle_name, 'middle name');
    if (name_suffix) diff('name_suffix', name_suffix, match.name_suffix, 'suffix');
    if (ctx.hasSides && has('side')) diff('side', side, match.side, SIDE_LABEL[side].toLowerCase());
    if (has('group')) diff('group_category', group_category, match.group_category, 'group');
    if (has('role')) diff('role', role, match.role, 'role');
    if (mobile && mobileKey(mobile) !== mobileKey(match.mobile)) diff('mobile', mobile, match.mobile, 'mobile');
    if (plusGiven && plus_one_count !== (match.plus_one_count ?? 0)) {
      patch.plus_one_count = plus_one_count;
      patch.plus_one_allowed = plus_one_count > 0;
      changes.push('their guests');
    }
    out.push(
      changes.length
        ? { line, name, status: 'changed', guestId: match.guest_id, patch, changes }
        : { line, name, status: 'same', guestId: match.guest_id },
    );
  });

  const counts: Record<ImportRowStatus, number> = { new: 0, changed: 0, same: 0, look: 0 };
  for (const r of out) counts[r.status] += 1;
  return { rows: out, counts };
}
