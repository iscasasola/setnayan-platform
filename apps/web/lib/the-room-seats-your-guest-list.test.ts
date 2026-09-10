/**
 * WHO IS IN THE ROOM IS THE GUEST LIST'S ANSWER, AND NOBODY ELSE'S.
 *
 * `people` is a reception-design part — couple / couple + entourage / everyone /
 * empty venue — and it sits in the lab's design panel directly beside the 3D
 * room. It reads like a room control. It is not one.
 *
 * It feeds `renderVenueSvg`: the flat concept illustration, the printed concept
 * PDF, and the supplier's mood-board mirror. Those have no seating to draw
 * from, so somebody has to say who to sketch. The ROOM populates from
 * `occByTable` — the guests who actually hold a seat.
 *
 * ⚠ THE TEMPTING FIX IS THE WRONG ONE, AND THIS FILE EXISTS TO STOP IT.
 * "The couple picked Empty venue and the room is full — honour the setting"
 * reads as an obvious bug report. Wiring it would install a SECOND mechanism
 * owning one fact: the guest list would say a table is seated and the design
 * picker would say the room is empty, each internally consistent, each passing
 * its own tests, disagreeing forever. Worse, the default is `who: 'couple'`, so
 * gating the crowd on it would empty every room already built.
 *
 * The honest fix was to say which surface the control governs. That is what is
 * pinned here — along with the boundary itself.
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts") from `apps/web`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const here = (...p: string[]) => join(import.meta.dirname, '..', ...p);
const EDITOR = here('app', 'dashboard', '[eventId]', 'seating', 'lab', '_components', 'reception-design-editor.tsx');
const WALK = here('app', '[slug]', 'venue', '_components', 'guest-venue-3d.tsx');
const LAB3D = here('app', 'dashboard', '[eventId]', 'seating', 'lab', '_components', 'seating-lab-3d.tsx');
const SCENE = here('lib', 'reception-scene.ts');

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

/* ── the boundary ─────────────────────────────────────────────────────────── */

test('no 3D surface reads `people` from the design', () => {
  // The moment one does, the guest list has a rival.
  for (const [name, path] of [['the public walk', WALK], ['the couple lab', LAB3D]] as const) {
    assert.doesNotMatch(
      read(path),
      /sel(All)?\(\s*(design|receptionDesign)\s*,\s*'people'/,
      `${name} must seat the guest list, never a design picker — two mechanisms ` +
        'owning "who is in the room" disagree forever and each passes its own tests.',
    );
  }
});

test('the room seats whoever actually holds a seat', () => {
  assert.match(
    read(WALK),
    /occByTable/,
    'the crowd must derive from seat occupancy — that is the guest list reaching the room',
  );
});

/* ── the control is not dead, it has a different home ─────────────────────── */

test('`people` really does drive the concept illustration', () => {
  // If this stops being true the control governs nothing at all, and the note
  // below would be pointing at a surface that no longer uses it.
  assert.match(
    read(SCENE),
    /people\(sel\(design, 'people', 'who'\)/,
    'renderVenueSvg must still consume the people choice',
  );
});

/* ── and the editor says so ───────────────────────────────────────────────── */

test('the editor tells the couple which surface this control governs', () => {
  const s = read(EDITOR);
  assert.match(s, /activePart === 'people'/, 'the note must be scoped to the People zone');
  assert.match(
    s,
    /concept\s*\n?\s*image/,
    'it must name the concept image — "this does something somewhere" is not a disclosure',
  );
  assert.match(
    s,
    /seats whoever is on your guest\s*\n?\s*list/,
    'and it must say where the room gets its people instead',
  );
});
