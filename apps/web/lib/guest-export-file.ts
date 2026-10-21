/**
 * lib/guest-export-file.ts — 📥 THE GUEST LIST AS A FILE EXCEL OPENS (owner 2026-10-16: *"wouldnt it be
 * better for someone to just have a excel file for their guests"*).
 *
 * The host's own list, written in the IMPORT TEMPLATE's columns and words (`lib/guest-import-file.ts`,
 * DECISION_LOG 2026-10-01 "GUEST IMPORT = A TEMPLATE FILE YOU DOWNLOAD… UPLOAD AGAIN TO UPDATE"), so the
 * same file can be edited in Excel and uploaded again: every row comes back "already on the list" until
 * the host changes it. Two read-only columns follow the template's — RSVP and Table — which the importer
 * does not read (an upload never overwrites an answer a guest gave).
 *
 * CSV, not .xlsx: no spreadsheet writer is in the dependencies, and this costs the phone nothing (the
 * route writes it on the server). Made for Excel on purpose:
 *   · a UTF-8 byte-order mark first, so "Peñaflor" and "Nuñez" open as themselves, never as Latin-1 garble;
 *   · CRLF line ends; a cell with a comma, quote or line break is quoted;
 *   · a Philippine number is written the local way ("0917 123 4567") — "+63 917…" would open in Excel as a
 *     FORMULA (#NAME?), and the importer reads the local way back to the same number;
 *   · any other cell that starts with = + - @ gets a leading apostrophe, so it is shown as text and never
 *     run as a formula (CSV injection); the importer strips that apostrophe again (`readGuestFile`).
 *
 * Pure (no server, no Supabase): `guest-export-file.test.ts` writes a file and reads it back with the
 * importer's own reader and planner.
 */
import { parsePhPhone } from './ph-phone';
import {
  GROUP_CATEGORY_LABELS,
  RSVP_LABELS,
  guestRoleLabel,
  replyMarkedByHost,
  type GuestGroupCategory,
  type GuestRole,
  type GuestSide,
  type RsvpStatus,
} from './guests';
import type { RoleNames } from './role-names';
import { seatNameAsTyped } from './extra-seats';

export type ExportGuest = {
  guest_id: string;
  name_prefix: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  name_suffix: string | null;
  side: GuestSide;
  group_category: GuestGroupCategory | null;
  role: GuestRole;
  plus_one_count: number | null;
  mobile: string | null;
  rsvp_status: RsvpStatus;
  passed_away?: boolean | null;
  /** Set on a +1's seat row — whose seat it is. */
  plus_one_of_guest_id?: string | null;
  display_name?: string | null;
  /** 🖐 Who set the reply (owner 2026-10-21) — the read-only "Reply set by" column. */
  rsvp_set_by?: 'guest' | 'host' | null;
};

/**
 * 🤝 THE FILE'S ROWS, IN ORDER (owner 2026-10-21, on the downloaded sheet: *"looking at excel there are so many +1
 * without names which shouldn't be listed as such"* — 25 rows of "TBA" · "'+1" sorted to the top, tied to nobody, each
 * also counted in its guest's "Their guests (+)").
 *   · an UNNAMED +1 is not a row: it is a seat, and their guest's "Their guests (+)" already counts it;
 *   · a NAMED +1 is a row DIRECTLY UNDER their guest, its "Guest of" their guest's name — and it is one of the seats
 *     that guest's "Their guests (+)" counts, so the sheet's people = the rows with no "Guest of" + every "Their
 *     guests (+)" (`exportHeadcount`), never the +1 twice;
 *   · "Their guests (+)" stays the guest's own number — the column an upload writes back, so the same file uploaded
 *     again changes no seat;
 *   · a +1 whose guest is not in the file keeps their own place, with no "Guest of" (counted as their own row).
 * `guests` arrive in the caller's order (the route's sort); a guest's +1s follow in that same order.
 * 🔒 lib/an-unnamed-plus-one-has-no-name.test.ts
 */
export function exportRows<G extends ExportGuest>(guests: readonly G[]): { g: G; guestOf: string }[] {
  const byId = new Map(guests.map((x) => [x.guest_id, x] as const));
  const seatsOf = new Map<string, G[]>();
  const placedUnder = (x: G) => Boolean(x.plus_one_of_guest_id && x.plus_one_of_guest_id !== x.guest_id && byId.has(x.plus_one_of_guest_id));
  for (const x of guests) {
    if (!placedUnder(x) || seatNameAsTyped(x).unnamed) continue;
    const host = x.plus_one_of_guest_id as string;
    seatsOf.set(host, [...(seatsOf.get(host) ?? []), x]);
  }
  const out: { g: G; guestOf: string }[] = [];
  for (const x of guests) {
    if (placedUnder(x)) continue; // drawn under their guest, or (unnamed) not a row at all
    if (seatNameAsTyped(x).unnamed) continue; // an unnamed seat whose guest is gone — still not a person
    out.push({ g: x, guestOf: '' });
    // Their guest's name as THIS file writes it — the same five cells their own row holds, so "Guest of" always matches a row.
    const bringer = [x.name_prefix, x.first_name, x.middle_name, x.last_name, x.name_suffix].map((v) => (v ?? '').trim()).filter(Boolean).join(' ');
    for (const seat of seatsOf.get(x.guest_id) ?? []) out.push({ g: seat, guestOf: bringer });
  }
  return out;
}

/** The people a file says: its rows with no "Guest of", plus every "Their guests (+)". Equals the list's rows when each
 *  guest's seats are rows (the app keeps them so — `syncExtraSeats`, and Remove takes the seat with it). */
export function exportHeadcount(rows: readonly { g: Pick<ExportGuest, 'plus_one_count'>; guestOf: string }[]): number {
  return rows.reduce((n, r) => n + (r.guestOf ? 0 : 1 + (r.g.plus_one_count ?? 0)), 0);
}

/** "You" for a reply a host set, "Guest" for their own, blank when the row does not say (never guessed). */
export function replySetByWord(g: Pick<ExportGuest, 'rsvp_status' | 'rsvp_set_by' | 'passed_away'>): string {
  if (g.passed_away) return '';
  if (replyMarkedByHost(g)) return 'You';
  return g.rsvp_set_by === 'guest' && g.rsvp_status !== 'pending' ? 'Guest' : '';
}

/** The byte-order mark Excel needs to read UTF-8. */
export const UTF8_BOM = '﻿';

const SIDE_WORD: Record<GuestSide, string> = { bride: 'Bride', groom: 'Groom', both: 'Both' };

/** The import template's headers, in its order (public/templates/setnayan-guest-list*.csv). */
export function guestExportHeaders(hasSides: boolean, withTable: boolean): string[] {
  return [
    'Prefix',
    'First name',
    'Middle name',
    'Last name',
    'Suffix',
    ...(hasSides ? ['Side'] : []),
    'Group',
    'Role',
    'Their guests (+)',
    'Mobile (optional)',
    // Read-only, like RSVP and Table: whose +1 a row is (the importer does not read it).
    'Guest of',
    'RSVP',
    // Read-only, like RSVP and Table: who set the reply (the importer does not read it).
    'Reply set by',
    ...(withTable ? ['Table'] : []),
  ];
}

/** A Philippine number the local way, with spaces (so Excel keeps the 0); anything else as given. */
export function exportMobile(raw: string | null | undefined): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  const ph = parsePhPhone(s);
  if (!ph.ok) return s;
  const national = `0${ph.e164.replace(/^\+63/, '')}`;
  if (ph.kind === 'mobile') return `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`;
  return national.startsWith('02') ? `02 ${national.slice(2)}` : `${national.slice(0, 3)} ${national.slice(3)}`;
}

/** One cell: never a formula, quoted when it must be. */
export function csvCell(raw: string | number | null | undefined): string {
  let v = raw === null || raw === undefined ? '' : String(raw);
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function guestListCsv(
  guests: readonly ExportGuest[],
  opts: { hasSides: boolean; roleNames?: RoleNames | null; tableByGuest?: Record<string, string> | null },
): string {
  const withTable = Boolean(opts.tableByGuest);
  const lines = [guestExportHeaders(opts.hasSides, withTable).map(csvCell).join(',')];
  for (const { g, guestOf } of exportRows(guests)) {
    /* 🪪 No cell ever holds a stand-in as a name (owner 2026-10-21: "there is no last name yet"): a +1 named "Ben"
       keeps "+1" stored as its last name — it is written blank. */
    const typed = seatNameAsTyped(g);
    const cells: (string | number)[] = [
      g.name_prefix ?? '',
      typed.first_name,
      g.middle_name ?? '',
      typed.last_name,
      g.name_suffix ?? '',
      ...(opts.hasSides ? [SIDE_WORD[g.side] ?? ''] : []),
      g.group_category ? (GROUP_CATEGORY_LABELS[g.group_category] ?? '') : '',
      guestRoleLabel(g.role, opts.roleNames),
      g.plus_one_count ?? 0,
      exportMobile(g.mobile),
      guestOf,
      g.passed_away ? 'In loving memory' : RSVP_LABELS[g.rsvp_status],
      replySetByWord(g),
      ...(withTable ? [opts.tableByGuest?.[g.guest_id] ?? ''] : []),
    ];
    lines.push(cells.map(csvCell).join(','));
  }
  return UTF8_BOM + lines.join('\r\n') + '\r\n';
}

/** "Indalecio-and-Claire-guest-list-2026-10-16.csv" — plain letters, so every phone saves it. */
export function guestListFileName(eventName: string | null | undefined, now: Date = new Date()): string {
  const who = (eventName ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const day = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  return `${who || 'Guest'}-guest-list-${day}.csv`;
}
