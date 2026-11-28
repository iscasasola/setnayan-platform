/**
 * the-floor-fits-the-room.test.ts — THE 2D FLOOR (owner 2026-11-20; drawing § 5 · § 10 · "On every view"; DECISION_LOG
 * "THE COUPLE'S SEAT PLAN USES THE SAME FLOOR PLAN AS A SUPPLIER'S SPACES" · "ONE SEAT-PLAN ENGINE" · round two).
 *
 * THE FAULTS, live at 375 (`now/13 · 16 · 17`): Fit and the draft framed the TABLES, not the room · the draft's
 * three-line notice sat on Zoom in / Zoom out · the draft's names were microscopic · rows were never either side of
 * the stage line.
 *
 *   1 · FIT IS THE ROOM, by the shared core, clear of the pinned row and the thumb row; again after every add / draft.
 *   2 · THE DRAFT SAYS ONE LINE WITH UNDO, in the thumb row's toast — no strip across the floor's foot in Guests.
 *   3 · THE DRAFT USES THE GRID (the server's layout is the core's), and its Undo takes back exactly its tables.
 *   4 · NAMES COME ON A TAP until they can be read: a ring that fills, a number, and a bubble that keeps its press.
 *   5 · THE SPACES LOOK: an ink outline, square corners, the hall's name and size.
 *   6 · A moved table lines up through the core, and says with what.
 *
 * Sabotage (each goes red): frame the tables again · drop the insets · put the long notice back · let the notice dock
 * show in Guests · lay the draft out with `computeAutoLayout` alone · print names from 0.72 · round the wall.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const SEATING = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'seating');
const ed = stripComments(readFileSync(join(SEATING, '_components', 'seating-editor.tsx'), 'utf8'));
const actions = stripComments(readFileSync(join(SEATING, 'actions.ts'), 'utf8'));

test('1 · Fit is the room — the core’s answer, clear of the pinned row and the thumb row', () => {
  const fit = ed.slice(ed.indexOf('const fitView = () => {'), ed.indexOf('useEffect(', ed.indexOf('const fitView = () => {')));
  assert.match(fit, /const v = fitRoom\(\{/, 'Fit is not the shared core’s');
  assert.match(fit, /room: \{ left: cell \? rect\.left - cell\.left : 0, top: cell \? rect\.top - cell\.top : 0, width: rect\.width, height: rect\.height \},/, 'the ROOM is not what is framed');
  assert.match(fit, /inset: cell \? \{ top: px\('--gs-stick-h'\), bottom: Math\.max\(0, px\('--sn-thumb-room'\) - px\('--sn-bottomdock-h'\)\) \} : undefined,/, 'the room is fitted under the chrome');
  assert.doesNotMatch(fit, /if \(!Number\.isFinite\(minX\)\)|fitW \/ bw/, 'Fit frames the tables again');
  assert.match(ed, /if \(inGuests\) return fitViewRef\.current\(\);/, 'a sized room opens on the old overview in Guests');
  assert.match(ed, /fitViewRef\.current\(\);\s*studioFitRef\.current = \{ z: zoomRef\.current, x: panRef\.current\.x, y: panRef\.current\.y \};\s*\}, 80\);[\s\S]{0,200}\}, \[tables\.length, addingTable\]\);/, 'the plan does not refit after an add or a draft');
});

test('2 · the draft says one line with Undo, in the thumb row’s toast — nothing across the floor’s foot', () => {
  const draft = ed.slice(ed.indexOf('const buildDraft = () => {'), ed.indexOf('const undoDraft = '));
  assert.doesNotMatch(ed, /Built a starting floor/, 'the three-line notice is back');
  assert.match(draft, /seated at \$\{formatCount\(res\.tables\)\}/);
  assert.match(draft, /setFloorNote\(\{ text, undo: null \}\);/);
  assert.match(ed, /: floorNote\s*\? \{ text: floorNote\.text, onUndo: floorNote\.undo, onDismiss: \(\) => setFloorNote\(null\) \}/, 'the floor’s line is not the toast');
  assert.match(ed, /if \(floorNote\) setMoveNote\(null\);/, 'an older seat-move line hides the floor’s newer one');
  assert.match(ed, /: !inGuests && \(notice \|\| \(autoRun && !isPhone\)\) \? 'notice'/, 'a notice strip can cover the zoom in Guests again');
  assert.match(ed, /: inGuests && notice\s*\? \{ text: notice, onUndo: null, onDismiss: \(\) => setNotice\(null\) \}/, 'a plain notice is lost in Guests');
});

test('3 · the draft uses the grid, and its Undo takes back exactly its own tables', () => {
  const draft = actions.slice(actions.indexOf('export async function buildSeatingDraft('), actions.indexOf('export async function saveReceptionDesign('));
  assert.match(draft, /const grid = seatingGridLayout\(\s*seatingFloorOf\(floorPlan\),/, 'the draft is not laid out by the shared core');
  assert.match(draft, /const layout: Record<string, \{ x: number; y: number \}> = \{ \.\.\.spill, \.\.\.grid \};/, 'the grid does not win over the old layout');
  const undo = draft.slice(draft.indexOf("formData.get('undo_table_ids')"), draft.indexOf('if (existing.length > 0)'));
  assert.ok(undo.length > 0, 'the Undo intent is gone');
  assert.ok(draft.indexOf('await assertSeatingLockHeld(supabase, eventId, lockId);') < draft.indexOf("formData.get('undo_table_ids')"), 'Undo runs before the lock is checked');
  assert.ok(draft.indexOf('guestsOrStop(supabase, eventId)') < draft.indexOf("formData.get('undo_table_ids')"), 'Undo writes before the stop-readers');
  assert.match(undo, /\.delete\(\)\.eq\('event_id', eventId\)\.in\('table_id', ids\)/, 'Undo is not scoped to this event and these tables');
  // 🛡 The browser's ids are only a claim (ship review 21 Nov): the server checks they are ONE draft batch and that
  // every seat on them is still the solver's, BEFORE it deletes; otherwise the draft stays and the screen says so.
  const check = undo.indexOf('const stillTheDrafts =');
  assert.ok(check > 0 && check < undo.indexOf('.delete()'), 'Undo deletes without checking the tables are still the draft’s');
  assert.match(undo, /batch\.size === 1/, 'Undo no longer asks for one draft batch');
  assert.match(undo, /r\.placed_by === 'auto'/, 'a seat placed by hand no longer stops Undo');
  assert.match(undo, /if \(!stillTheDrafts\) \{[\s\S]{0,120}return \{ tables: 0, seated: 0, kept: true \};/, 'a refused Undo is not reported as kept');
  assert.match(ed, /if \(res && 'kept' in res && res\.kept\) setNotice\(/, 'a refused Undo reads as done on the screen');
  assert.match(ed, /const ids = tables\.map\(\(t\) => t\.table_id\);\s*setFloorNote\(\{ text: waiting\.text, undo: \(\) => undoDraft\(ids\) \}\);[\s\S]{0,200}\}, \[tables\.length, floorNote\]\);/, 'the draft’s Undo is not armed with exactly its own tables, whichever arrives first');
});

test('4 · names come on a tap until they can be read', async () => {
  assert.match(ed, /const NAME_READABLE_PX = 7;/);
  assert.match(ed, /details\?\.host === 'guests'\s*\? Math\.max\(0\.72, Math\.min\(zoomMaxRef\.current \* 0\.85, NAME_READABLE_PX \/ \(SEAT_NAME_PX \* roundScale\)\)\)\s*: 0\.72;/, 'names print from a fixed zoom again');
  assert.match(ed, /const farLook = inGuests && !detail;/);
  assert.match(ed, /\{farLook \? <TableFillRing /);
  const ring = ed.slice(ed.indexOf('function TableFillRing('), ed.indexOf('function dominantColor('));
  assert.match(ring, /const tone = full \? 'text-success-600' : 'text-gold';/, 'green is not full / gold is not "has room"');
  assert.match(ring, /strokeDasharray=\{`\$\{c \* share\} \$\{c\}`\}/, 'the ring does not fill with the chairs');
  const bubble = ed.slice(ed.indexOf('data-plan-table-names={st.table_id}') - 1200, ed.indexOf('data-plan-table-names={st.table_id}') + 900);
  assert.match(bubble, /roomOnly && !detail && !dragId && highlightId/);
  assert.match(bubble, /onPointerDown=\{\(e\) => e\.stopPropagation\(\)\}/, 'the bubble’s tap is swallowed by the floor’s pan');
  assert.match(bubble, /onSelectView\('list'\);/, 'the bubble has no way into the table');
});

test('5 · the Spaces look: an ink outline, square corners, the hall’s name and size', () => {
  const wall = ed.slice(ed.indexOf('data-seat-room-wall="spaces"') - 200, ed.indexOf('data-seat-room-wall="spaces"') + 700);
  assert.match(wall, /className="pointer-events-none absolute inset-0 border-2 border-ink" data-seat-room-wall="spaces"/);
  assert.doesNotMatch(wall.slice(0, 330), /rounded/, 'the wall has round corners');
  assert.match(wall, /planRoomWords\(\{ widthM: roomM\.w, depthM: roomM\.d \}, venueHall\?\.name\)\.name/);
  assert.match(wall, /planRoomWords\(\{ widthM: roomM\.w, depthM: roomM\.d \}\)\.size/);
  // the hall's picture in Spaces (PlanPoster, out of the retired PlanMaker) draws the same wall: square, in the ink it sits in
  const poster = stripComments(readFileSync(join(process.cwd(), 'app', '_components', 'plan-poster.tsx'), 'utf8'));
  assert.match(poster, /<rect x=\{4\} y=\{4\} width=\{W - 8\} height=\{H - 8\} fill="none" className="stroke-current" strokeWidth=\{8\} \/>/, 'the Spaces wall changed — re-read this test');
  assert.doesNotMatch(poster, /<rect x=\{4\}[^>]*\brx=/, 'the Spaces wall has round corners');
});

test('6 · a moved table lines up through the core — on both plans — and says with what', () => {
  const drag = ed.slice(ed.indexOf('const snap = snapToLines({'), ed.indexOf('linedWithRef.current = lined;'));
  assert.ok(drag.length > 0, 'the couple’s drag no longer snaps through the core');
  assert.match(drag, /stage: \{ x: stage\.x, y: stage\.y \},/, 'the stage line is not a line');
  // 🪑 …naming the table as it SHOWS (lib/table-auto-name.ts, 27 Nov), not its stored label.
  assert.match(ed, /Lined up with \{shownNames\.get\(linedWithRef\.current!\) \?\? ''\}/);
  // a shop's hall IS this editor in venue mode (PlanMaker retired): the one snap is not skipped for a venue
  const guard = ed.slice(ed.lastIndexOf('if (', ed.indexOf('const snap = snapToLines({')), ed.indexOf('const snap = snapToLines({'));
  assert.doesNotMatch(guard, /isVenue|venueMode|source\.kind/, 'a shop’s Spaces does not line up through the same rule');
});
