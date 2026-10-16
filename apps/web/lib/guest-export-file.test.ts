/**
 * guest-export-file.test.ts — 📥 "DOWNLOAD AS EXCEL" WRITES A FILE EXCEL OPENS CLEANLY, AND THE IMPORTER READS
 * IT BACK AS THE SAME LIST (owner 2026-10-16: *"just have a excel file for their guests"*; DECISION_LOG
 * 2026-10-01 "… UPLOAD AGAIN TO UPDATE").
 *
 *   · a UTF-8 byte-order mark, so "Peñaflor" opens as itself in Excel; CRLF line ends;
 *   · the import template's own headers, in its order (read from `public/templates/*.csv`, not retyped);
 *   · round trip: written, then read by `readGuestFile` and planned by `planGuestImport` against the same
 *     guests → every row "already on the list" (`same`) — nothing duplicated, nothing changed;
 *   · nothing in it runs as a formula: a Philippine mobile is written "0917 123 4567" (a "+63…" cell opens
 *     in Excel as #NAME?), any other cell starting = + - @ gets an apostrophe the importer strips again;
 *   · the route never sends an empty file for a refused read, and keeps it out of shared caches.
 *
 * Sabotage (2026-10-16): the BOM dropped → test 1 red; `exportMobile` returning the raw "+63…" → test 3 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { csvCell, exportMobile, guestExportHeaders, guestListCsv, guestListFileName, UTF8_BOM, type ExportGuest } from './guest-export-file';
import { planGuestImport, readGuestFile } from './guest-import-file';
import { resolveRoleSet } from './role-sets';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const g = (over: Partial<ExportGuest>): ExportGuest => ({
  guest_id: `g-${Math.random().toString(36).slice(2)}`,
  name_prefix: null,
  first_name: 'Ana',
  middle_name: null,
  last_name: 'Reyes',
  name_suffix: null,
  side: 'bride',
  group_category: 'family',
  role: 'guest',
  plus_one_count: 0,
  mobile: null,
  rsvp_status: 'pending',
  ...over,
});
const guests: ExportGuest[] = [
  g({ first_name: 'José', last_name: 'Peñaflor', role: 'groom', side: 'groom', rsvp_status: 'attending' }),
  g({ first_name: 'María', last_name: 'Nuñez', role: 'bride', rsvp_status: 'attending', mobile: '+63 917 123 4567' }),
  g({ name_prefix: 'Mr.', first_name: 'Manuel', middle_name: 'Cortez', last_name: 'Casasola', name_suffix: 'Jr.', role: 'principal_sponsor_ninong', side: 'groom', plus_one_count: 1 }),
  g({ first_name: 'Lola', last_name: 'Santos, Sr', group_category: 'friends', mobile: '09181234567' }),
  g({ first_name: '=HYPERLINK("x")', last_name: '-Dash', side: 'both', group_category: 'work' }),
];

test('1 · a byte-order mark, CRLF, and the accents as themselves', () => {
  const csv = guestListCsv(guests, { hasSides: true });
  assert.ok(csv.startsWith(UTF8_BOM), 'Excel needs the BOM to read UTF-8');
  assert.match(csv, /\r\n/);
  assert.match(csv, /José,,Peñaflor/);
  assert.match(csv, /María,,Nuñez/);
  assert.match(csv, /"Santos, Sr"/, 'a comma inside a name is quoted');
});

test('2 · the template’s own headers, in its order — and the two read-only columns after', () => {
  for (const [file, hasSides] of [
    ['setnayan-guest-list-wedding.csv', true],
    ['setnayan-guest-list.csv', false],
  ] as const) {
    const tmpl = readFileSync(join(WEB, 'public', 'templates', file), 'utf8').replace(/^﻿/, '').split(/\r?\n/)[0];
    const ours = guestExportHeaders(hasSides, true);
    assert.equal(ours.slice(0, -2).join(','), tmpl, `${file}: same columns, same order`);
    assert.deepEqual(ours.slice(-2), ['RSVP', 'Table']);
  }
});

test('3 · nothing opens as a formula', () => {
  assert.equal(exportMobile('+63 917 123 4567'), '0917 123 4567');
  assert.equal(exportMobile('09181234567'), '0918 123 4567');
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('-Dash'), "'-Dash");
  assert.equal(csvCell('+1 555 0100'), "'+1 555 0100");
  const csv = guestListCsv(guests, { hasSides: true });
  for (const line of csv.replace(UTF8_BOM, '').split('\r\n')) {
    for (const cell of line.split(',')) assert.doesNotMatch(cell.replace(/^"/, ''), /^[=+\-@]/, `cell ${cell} would run`);
  }
});

test('4 · uploaded again unchanged, the importer finds every guest already on the list', () => {
  const offered = resolveRoleSet('wedding').offeredRoles;
  const csv = guestListCsv(guests, { hasSides: true, tableByGuest: { [guests[0].guest_id]: 'Table 3' } });
  const plan = planGuestImport(readGuestFile(csv), {
    offeredRoles: offered,
    singletonRoles: ['bride', 'groom'],
    hasSides: true,
    existing: guests.map((x) => ({ ...x, group_category: x.group_category ?? 'family' })),
  });
  assert.equal(plan.rows.length, guests.length);
  assert.deepEqual(
    plan.rows.map((r) => `${r.name}:${r.status}${r.changes ? ` ${r.changes.join('|')}` : ''}${r.reason ? ` ${r.reason}` : ''}`),
    plan.rows.map((r) => `${r.name}:same`),
    'every row comes back "same" — no duplicate, no change',
  );
});

test('5 · a plain file name every phone can save', () => {
  assert.equal(guestListFileName('Indalecio & Claire', new Date(Date.UTC(2026, 9, 16, 3))), 'Indalecio-and-Claire-guest-list-2026-10-16.csv');
  assert.equal(guestListFileName('Peñaflor–Nuñez', new Date(Date.UTC(2026, 9, 16, 3))), 'Penaflor-Nunez-guest-list-2026-10-16.csv');
  assert.equal(guestListFileName(null, new Date(Date.UTC(2026, 9, 16, 3))), 'Guest-guest-list-2026-10-16.csv');
});

test('6 · the route never sends an empty file for a refused read, and keeps the list private', () => {
  const route = stripComments(readFileSync(join(WEB, 'app', 'dashboard', '[eventId]', 'guests', 'export', 'route.ts'), 'utf8'));
  assert.match(route, /if \(!guestsRead\.measured\) \{\s*return new NextResponse\([\s\S]{0,200}?status: 503/);
  assert.match(route, /viewerAreaLevel\(viewer, 'guest_list'\) === null/, 'only who may see the guest list');
  assert.match(route, /'Cache-Control': 'private, no-store'/);
  assert.match(route, /assignmentsRead\.measured && tablesRead\.measured/, 'an unread seat plan drops the Table column');
  const screen = readFileSync(join(WEB, 'app', 'dashboard', '[eventId]', 'guests', '_components', 'guests-screen.tsx'), 'utf8');
  assert.match(screen, /href=\{`\/dashboard\/\$\{eventId\}\/guests\/export`\}\s*download/, 'one tap from the list');
});
