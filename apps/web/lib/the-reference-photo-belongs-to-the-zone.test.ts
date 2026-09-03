/**
 * A COUPLE DRESSING A ZONE SHOULD SEE THE PHOTO THEY UPLOADED FOR IT.
 *
 * `event_inspiration_assets` holds up to three photos across eighteen named
 * slots, and no 3D surface has ever read them. The couple uploads a ceiling
 * they love, then picks a ceiling treatment on a different screen with the
 * photo nowhere in sight.
 *
 * This pins the bridge between the two vocabularies.
 *
 * ⚠ THE CONTRACT SAYS THE KEYS "ALREADY LINE UP". THEY PARTLY DO. Four match
 * exactly, `table` → `tables` does not, and five design parts have no slot at
 * all. An honest map says so; a clever `slot === part` would silently drop the
 * tables photo and quietly invent nothing for the rest. Both halves are tested
 * below — what maps, and what must NOT.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INSPIRATION_SLOT_FOR_PART,
  inspirationSlotForPart,
  MOODBOARD_SLOT_KEYS,
  isMoodboardSlotKey,
} from './moodboard-slots';
import { RECEPTION_PARTS } from './reception-scene';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const EDITOR = join(
  import.meta.dirname, '..', 'app', 'dashboard', '[eventId]', 'seating', 'lab',
  '_components', 'reception-design-editor.tsx',
);
const src = () => stripComments(readFileSync(EDITOR, 'utf8'));

test('every mapped slot is a REAL slot key', () => {
  // A typo here is invisible at runtime — the lookup just returns nothing and
  // the zone shows no photo, which is indistinguishable from "none uploaded".
  for (const [part, slot] of Object.entries(INSPIRATION_SLOT_FOR_PART)) {
    assert.ok(isMoodboardSlotKey(slot), `${part} → '${slot}' is not a slot key`);
    assert.ok((MOODBOARD_SLOT_KEYS as readonly string[]).includes(slot));
  }
});

test('every mapped part is a REAL design part', () => {
  const parts = new Set(RECEPTION_PARTS.map((p) => p.id as string));
  for (const part of Object.keys(INSPIRATION_SLOT_FOR_PART)) {
    assert.ok(parts.has(part), `'${part}' is not a reception part`);
  }
});

test('the singular/plural mismatch is absorbed by the map', () => {
  // The one pair that a `slot === part` shortcut would drop on the floor.
  assert.equal(inspirationSlotForPart('tables'), 'table');
  assert.equal(inspirationSlotForPart('table'), null, 'the PART id is plural; the slot is not a part');
});

test('parts with no inspiration slot return null, never a guess', () => {
  for (const part of ['walls', 'photo_wall', 'welcome_signage', 'entrance', 'people']) {
    assert.equal(
      inspirationSlotForPart(part),
      null,
      `'${part}' has no slot — showing an unrelated photo beside it would be worse than showing none`,
    );
  }
});

test('an unknown part id is null, not a crash', () => {
  assert.equal(inspirationSlotForPart('not_a_part'), null);
  assert.equal(inspirationSlotForPart(''), null);
});


/* ── the wiring: it reaches the zone, and only as reference ───────────────── */

test('the photo shown follows the ACTIVE zone', () => {
  // Keyed on activePart, not a fixed slot: otherwise every zone shows the
  // ceiling photo, which is worse than showing none — it is confidently wrong.
  assert.match(
    src(),
    /inspirationByPart\?\.\[activePart\]/,
    'the reference strip must key off the part the couple is currently dressing',
  );
});

test('an absent photo renders nothing — never a placeholder', () => {
  assert.match(
    src(),
    /\(inspirationByPart\?\.\[activePart\]\?\.length \?\? 0\) > 0/,
    'five of ten parts have no slot at all, so "nothing here" is the common case ' +
      'and must render as nothing.',
  );
});

test('REFERENCE ONLY — the photo never enters the render', () => {
  // The contract is explicit: beside the zone, never composited. If an
  // inspiration URL ever reached renderVenueSvg or the 3D palette, the room
  // would stop being a drawing of what the couple chose and become a collage of
  // what they liked — and every "the room shows X" guarantee would be false.
  const s2 = src();
  const svgCall = s2.slice(s2.indexOf('renderVenueSvg('), s2.indexOf('renderVenueSvg(') + 160);
  assert.doesNotMatch(svgCall, /inspiration/i, 'inspiration data must not feed renderVenueSvg');
});
