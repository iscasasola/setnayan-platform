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
 *   · a UTF-8 byte-order mark first, so "Peñaflor" and "Nuñez" open as themselves, not "PeÃ±aflor";
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
  type GuestGroupCategory,
  type GuestRole,
  type GuestSide,
  type RsvpStatus,
} from './guests';
import type { RoleNames } from './role-names';

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
};

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
    'RSVP',
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
  for (const g of guests) {
    const cells: (string | number)[] = [
      g.name_prefix ?? '',
      g.first_name,
      g.middle_name ?? '',
      g.last_name,
      g.name_suffix ?? '',
      ...(opts.hasSides ? [SIDE_WORD[g.side] ?? ''] : []),
      g.group_category ? (GROUP_CATEGORY_LABELS[g.group_category] ?? '') : '',
      guestRoleLabel(g.role, opts.roleNames),
      g.plus_one_count ?? 0,
      exportMobile(g.mobile),
      g.passed_away ? 'In loving memory' : RSVP_LABELS[g.rsvp_status],
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
