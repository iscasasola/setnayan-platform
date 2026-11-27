/**
 * 🪑 EVERY SURFACE THAT SHOWS A TABLE'S NAME READS IT FROM THE ONE READER (corpus SEAT-PLAN-COMPLETE-2026-11-27.md
 * § 4.3: "EVERY surface uses it … A second copy is a defect"; § 7 source asserts). A table that names itself after its
 * majority group must say the same name on the plan, the sign, the escort card, the caterer sheet and the guest's own
 * find-seat page — a print that kept the stored label would send a guest to "Table 3" while the sign says
 * "Reyes family".
 *
 * Held as source: each surface imports `lib/table-auto-name` (or its server half, which calls `tableDisplayNames`),
 * and the server half itself goes through `tableDisplayNames`. The L10 lane's list cards and table screen join this
 * list as they land.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const SURFACES = [
  // the 2D plan and its badges (L10's editor: the one hook), the Name row
  'app/dashboard/[eventId]/seating/_components/seating-editor.tsx',
  'app/dashboard/[eventId]/seating/_components/table-name-row.tsx',
  // the rename's clash check
  'app/dashboard/[eventId]/seating/actions.ts',
  // prints: the caterer sheet, the signs / escort / place cards, the entrance chart, the A3 plan
  'app/dashboard/[eventId]/seating/caterer/route.ts',
  'app/dashboard/[eventId]/seating/print/route.ts',
  'app/dashboard/[eventId]/seating/chart/page.tsx',
  'app/dashboard/[eventId]/seating/export/route.ts',
  // the guest's pages and the open name search
  'app/[slug]/seat/page.tsx',
  'app/[slug]/find-seat/page.tsx',
  'app/[slug]/find-my-table/page.tsx',
  'app/api/seat-lookup/[slug]/route.ts',
  // 27 Nov review: every other surface that names a table
  'lib/print-set.server.ts', // the hub print's tickets
  'lib/pass-card.server.ts', // the guest's pass
  'lib/guest-reminder-emails.ts', // the reminder email's table line (its words unchanged)
  'app/dashboard/[eventId]/guests/checkin/page.tsx', // the door desk
  'app/dashboard/[eventId]/page.tsx', // the day-of head table card
  'app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/actions.ts', // the coordinator's QR lookup
  'app/[slug]/_lib/your-own-day.server.ts',
  'app/[slug]/_lib/loaders.ts', // the guest's Event Hub table line
  'app/[slug]/_components/story/spine-data.ts', // the story's room
  'app/dashboard/[eventId]/seating/walkthrough/page.tsx',
  'app/dashboard/[eventId]/studio/patiktok/booth/page.tsx',
  'app/dashboard/[eventId]/guests/_components/guest-card-data.ts',
  'app/dashboard/[eventId]/guests/inline-actions.ts',
  'app/dashboard/[eventId]/guests/souvenirs/page.tsx',
  'app/dashboard/[eventId]/guests/seat-view-actions.ts', // Guests › seats
  'app/dashboard/[eventId]/guests/share/route.ts',
  'app/dashboard/[eventId]/guests/export/route.ts',
  'app/api/hub-print/[piece]/route.ts',
  'lib/change-requests.server.ts',
];

/**
 * No surface reads a table's label straight off `event_tables` for a person to read: a select naming `table_label`
 * belongs only to the readers themselves, the seat plan's own data layer, and the writers. A new one fails here —
 * route it through lib/table-auto-name(.server).ts, or add it to ALLOWED with the reason.
 */
const ALLOWED_LABEL_SELECTS = new Set([
  'lib/table-auto-name.server.ts', // the reader
  'lib/seating.ts', // fetchTables / fetchPublicTables: the rows the readers name
  'app/[slug]/seat/page.tsx', // the table QR's token lookup; the sign's name is swapped to the shown one below it
  'app/dashboard/[eventId]/guests/_components/guest-card-data.ts', // the embed fallback beside the shown read
  'app/dashboard/[eventId]/guests/inline-actions.ts', // the freed seat's row; its label is swapped to the shown name
  'app/dashboard/[eventId]/seating/walkthrough/page.tsx', // swapped to the shown name beside it
  'app/dashboard/[eventId]/studio/patiktok/booth/page.tsx', // swapped to the shown name beside it
  'app/[slug]/_components/story/spine-data.ts', // swapped to the shown name beside it
]);

test('every table-name surface imports the one reader', () => {
  for (const rel of SURFACES) {
    assert.match(
      read(rel),
      /from '@\/lib\/table-auto-name(\.server)?'|from '\.\/table-name-row'/,
      `${rel} shows a table's name — it must read it through lib/table-auto-name (tableDisplayNames)`,
    );
  }
});

test('the server half goes through tableDisplayNames, and the editor feeds the badges the shown names', () => {
  const server = read('lib/table-auto-name.server.ts');
  assert.match(server, /tableDisplayNames\(/);
  const editor = read('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  assert.match(editor, /tableDisplayNames\(/);
  assert.match(editor, /planTableBadges\(withDisplayNames\(tables, shownNames\)\)/, 'the 2D badges are made from the shown names');
  assert.doesNotMatch(editor, /planTableBadges\(tables\)/);
});

test('the prints and guest pages swap the label before they draw (never the raw fetchTables rows)', () => {
  for (const rel of [
    'app/dashboard/[eventId]/seating/caterer/route.ts',
    'app/dashboard/[eventId]/seating/print/route.ts',
    'app/dashboard/[eventId]/seating/chart/page.tsx',
    'app/dashboard/[eventId]/seating/export/route.ts',
  ]) {
    assert.match(read(rel), /withDisplayNames\([^)]*shownNamesFrom\(/, `${rel} must draw the shown names`);
  }
  for (const rel of ['app/[slug]/seat/page.tsx', 'app/[slug]/find-seat/page.tsx', 'app/[slug]/find-my-table/page.tsx']) {
    assert.match(read(rel), /guestTablesWithShownNames\(admin, [^)]*fetchPublicTables\(/, `${rel} must draw the shown names`);
  }
});

test('the rename writes who named the table, and refuses a name another table shows', () => {
  const actions = read('app/dashboard/[eventId]/seating/actions.ts');
  assert.match(actions, /label_is_auto: typed\.length === 0/);
  assert.match(actions, /hostNameClash\(tableId, typed, names\)/);
  assert.match(actions, /renameWrites\(own, typed, names\.get\(tableId\)\) === 'none'\) return;/, 'an unchanged name writes nothing on the server');
  assert.match(actions, /label_is_auto: isDefaultTableLabel\(trimmed\)/, 'a new table typed by the host keeps its name');
});

test('the editor\'s name fields hold the SHOWN name, and an unchanged field writes nothing', () => {
  const editor = read('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  assert.match(editor, /renameWrites\(table, trimmed, shownNames\.get\(tableId\)\) === 'none'\) return;/);
  assert.match(editor, /defaultValue=\{nameOf\(st\)\}/, 'the inline field is pre-filled with the shown name');
  assert.match(editor, /tableLabel=\{nameOf\(st\)\}/, 'the phone dock gets the shown name');
  assert.match(editor, /value=\{nameOf\(st\)\}/);
  assert.match(editor, /value=\{nameOf\(u\.lead\)\}/);
  assert.doesNotMatch(editor, /(defaultValue|value)=\{(st|u\.lead)\.table_label\}/);
});

test('no new surface reads a table label straight off event_tables', () => {
  const { execSync } = require('node:child_process') as typeof import('node:child_process');
  const out = execSync(`grep -rlE "select\\([^)]*table_label" app lib components --include=*.ts --include=*.tsx`, { cwd: WEB, encoding: 'utf8' });
  const files = out.split('\n').filter(Boolean).filter((f) => !/\.test\.|\/dev\/|\.lab\./.test(f));
  assert.ok(files.length >= 3, `the sweep found ${files.length} files — it must see the known readers`);
  const strays = files.filter((f) => !ALLOWED_LABEL_SELECTS.has(f));
  assert.deepEqual(strays, [], 'a surface reads table_label without the one reader');
});
