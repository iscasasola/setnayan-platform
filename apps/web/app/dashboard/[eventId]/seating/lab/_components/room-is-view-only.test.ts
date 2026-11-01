/**
 * room-is-view-only.test.ts — THE 3D ROOM WRITES NOTHING TO THE PLAN.
 *
 * Owner, 2026-10-30, Guests › Seats › 3D on the iPhone app: *"also the other icons are eating up the space. the floating
 * menus there needs fixing"* → *"or maybe not editing for 3d"* → *"let's make 3d become view only because all are
 * plottend on the 2d"*. And for the accents: *"these doesn't need placement. just activate and its there"*.
 *
 * So the room (`seating-lab-3d.tsx`) and its tools (`room-view-tools.tsx`) hold NO editing control and NO editing
 * gesture: no seat-plan action module, no seat-plan lock, no table/chair/zone pointer handler, no drop bubble, no Build
 * panel. The ONE write left in the room is the Accents sheet (`accents-sheet.tsx`), which may call exactly
 * `saveReceptionDesign` and `dismissRoomSuggestion` — an accent is switched on or off, never placed.
 * The edits it lost each have a home in 2D (`seating-editor.tsx`): "Swap with another table…" (`swapTableOccupants`),
 * "Show supplier suggestions in 3D" (`setGhostBoothsEnabled`) and "Accents…" (the door that opens this sheet).
 *
 * Each claim is a PROPERTY read from the source, anchored per component.
 * SABOTAGES (2026-10-30, each run → red → restored): `import { assignGuest } from '@/app/dashboard/[eventId]/seating/actions'`
 * added to the room → RED · `onPointerDown={() => {}}` on TableMesh's group → RED · `onPointerMove={onFloorClick}` on the
 * floor catcher → RED · `updateTablePosition` added to the accents sheet's import → RED · the 2D "Swap with another
 * table…" row removed → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const ROOM = read('seating-lab-3d.tsx');
const TOOLS = read('room-view-tools.tsx');
const ACCENTS = read('accents-sheet.tsx');
const EDITOR = stripComments(readFileSync(join(HERE, '..', '..', '_components', 'seating-editor.tsx'), 'utf8'));

/** The body of `function NAME(` up to the next top-level `function ` / `/* ---` divider. */
function fnBody(src: string, name: string): string {
  const at = src.indexOf(`function ${name}(`);
  assert.ok(at > -1, `${name} moved — this guard is blind`);
  const next = src.slice(at + 10).search(/\n(?:export )?function [A-Z]/);
  return src.slice(at, next === -1 ? undefined : at + 10 + next);
}

test('the room and its tools import no seat-plan action and take no lock', () => {
  for (const [f, src] of [['seating-lab-3d.tsx', ROOM], ['room-view-tools.tsx', TOOLS]] as const) {
    assert.doesNotMatch(src, /from '[^']*seating\/actions'|from '\.\.\/\.\.\/actions'|from '\.\/actions'/, `${f} imports a seat-plan action module`);
    assert.doesNotMatch(src, /useSeatingLock|lock\.acquire|saveFloorPlan|updateTablePosition|assignGuest/, `${f} can edit the plan`);
  }
  assert.doesNotMatch(ROOM, /<DropConfirmBubble|<ZoneDragGrips|<Hud\b|<ReceptionDesignEditor|<RulesPanel|<FloorPanel/, 'an editing panel is back on the room');
});

test('no editing gesture: tables, chairs and the floor take no pointer that edits', () => {
  const table = fnBody(ROOM, 'TableMesh');
  assert.doesNotMatch(table, /onPointerDown|onPointerUp|onClick|onSeatDown|onDown|onToggleSeat|removable|interactive/, 'a table or a chair answers a tap again');
  // The floor catcher: a view tap (the dance floor in Play) — no drag, no drop. Its double-tap for full screen left with
  // the ⤢ (owner 2026-10-30, "THE MAP ARE ALWAYS FULL SCREEN — NO FULL-SCREEN BUTTON"; lib/maps-are-always-full-screen.test.ts).
  const at = ROOM.indexOf('<planeGeometry args={[room.w * 3, room.d * 3]} />');
  assert.ok(at > -1, 'the floor catcher moved — this guard is blind');
  const catcher = ROOM.slice(ROOM.lastIndexOf('<mesh', at), at);
  assert.match(catcher, /onClick=\{onFloorClick\}/);
  assert.doesNotMatch(catcher, /onDoubleClick=/, 'the double-tap full-screen toggle is back on the floor');
  assert.doesNotMatch(catcher, /onPointerMove|onPointerDown|onPointerUp/, 'the floor drags again');
  const click = ROOM.slice(ROOM.indexOf('const onFloorClick = useCallback('), ROOM.indexOf('const onFloorClick = useCallback(') + 700);
  assert.match(click, /sendDancer\(\)/);
  assert.doesNotMatch(click, /placeZone|setSelectedId|persist|save/, 'a floor tap places or saves again');
});

test('the accents sheet writes accents only — switched, never placed', () => {
  const imports = [...ACCENTS.matchAll(/import \{([^}]*)\} from '\.\.\/\.\.\/actions';/g)].map((m) => m[1]!.split(',').map((x) => x.trim()).filter(Boolean));
  assert.equal(imports.length, 1, 'the sheet reaches the actions module once');
  assert.deepEqual([...imports[0]!].sort(), ['dismissRoomSuggestion', 'saveReceptionDesign']);
  assert.match(ACCENTS, /saveReceptionDesign\(eventId, next, base\)/, 'the save sends its base (two hosts never overwrite)');
  assert.match(ACCENTS, /if \(finalizedByPart\?\.\[part\]\) return;/, 'a zone a supplier agreed to build stays frozen');
});

test('every edit the room lost has its home in 2D', () => {
  assert.match(EDITOR, /swapTableOccupants\(fd\)/, '2D swaps two tables');
  assert.match(EDITOR, /Swap with another table…/, 'the table menu offers the swap');
  assert.match(EDITOR, /<form action=\{setGhostBoothsEnabled\}/, 'the ghost booths have their switch in the seat settings');
  assert.match(EDITOR, /label="Accents…"/, 'the ⋯ opens the Accents sheet');
  assert.match(EDITOR, /SEAT_PLAN_SHOW_VIEW_EVENT/, '"Switch to 2D" from the room reaches the plan');
});
