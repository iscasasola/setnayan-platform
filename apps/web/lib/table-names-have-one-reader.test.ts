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
];

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
  assert.match(actions, /label_is_auto: isDefaultTableLabel\(trimmed\)/, 'a new table typed by the host keeps its name');
});
