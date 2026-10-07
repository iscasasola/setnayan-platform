/**
 * 🎨 THE PICKER SETS ONE COLOUR — AND WHERE THAT ONE COLOUR IS WRITTEN (owner
 * 2026-10-06, DECISION_LOG "AUTO PALETTE BESIDE SAVED — AND A REAL COLOUR
 * PICKER FOR CHANGING IT BY HAND": "one tap sets that colour and says what it
 * changes").
 *
 *   1 · ONE colour changes. The other four are written exactly as the couple
 *       sees them — a board still wearing its theme's colours is written whole
 *       with only that one changed (controller ruling 2026-10-07) — and nothing
 *       else on the board (a part, a role) moves.
 *   2 · It SAYS what it changes: every main colour has its one job.
 *   3 · 🎨 WHERE IT GOES — THE DRAFT (step 4c, 2026-10-07). The hub draft's
 *       `role_palette` now holds a PAINTED board (`sanitizePaintedPalette`, the
 *       Mood Board's own sanitizer), so the picker, ✨ Auto and the part
 *       palettes are drafted and published by Apply — never `saveRolePalette`
 *       live from the Studio.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { MAIN_COLOUR_COUNT, MAIN_COLOUR_JOBS, shownMainFive, withMainColour } from './mood-board-studio';
import { sanitizeHubDraftEventValue } from './hub-draft';
import { themeSeedPalette } from './theme-colours';

const FIVE = ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F'];

test('one tap sets ONE main colour; the other four and the rest of the board stay', () => {
  const before = { reception: FIVE, room_dressing: { chairs: '#ABCDEF' }, bridesmaids: ['#F3DDE3'] };
  for (let i = 0; i < MAIN_COLOUR_COUNT; i++) {
    const after = withMainColour(before, FIVE, i, '#102030');
    assert.equal(after.reception![i], '#102030');
    after.reception!.forEach((c, j) => j !== i && assert.equal(c, FIVE[j], `slot ${j} moved when ${i} was picked`));
    assert.deepEqual(after.room_dressing, before.room_dressing);
    assert.deepEqual(after.bridesmaids, before.bridesmaids);
  }
});

test('a board still wearing its theme is written whole, with only that colour changed', () => {
  const theme = themeSeedPalette('house').reception;
  const shown = shownMainFive({}, theme);
  assert.deepEqual(shown, theme.map((c) => c.toUpperCase()));
  const after = withMainColour({}, shown, 2, '#C0FFEE');
  assert.equal(after.reception!.length, MAIN_COLOUR_COUNT);
  assert.deepEqual(after.reception, shown.map((c, j) => (j === 2 ? '#C0FFEE' : c)));
});

test('a code that is not a colour sets nothing', () => {
  const before = { reception: FIVE };
  assert.equal(withMainColour(before, FIVE, 0, 'red'), before);
  assert.equal(withMainColour(before, FIVE, 7, '#000000'), before);
});

test('every main colour says what it changes', () => {
  assert.equal(MAIN_COLOUR_JOBS.length, MAIN_COLOUR_COUNT);
  for (const job of MAIN_COLOUR_JOBS) assert.ok(job.trim().length > 0);
});

test('🎨 the draft holds a painted palette — so the picker, Auto and the part palettes write INTO it (step 4c)', () => {
  const painted = withMainColour({ reception: FIVE }, FIVE, 0, '#102030');
  const held = sanitizeHubDraftEventValue('role_palette', painted) as { reception?: string[] } | undefined;
  assert.deepEqual(held?.reception, painted.reception, 'the draft no longer holds a painted palette');
  const src = stripComments(
    readFileSync(join(__dirname, '../app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx'), 'utf8'),
  );
  assert.match(src, /withMainColour\(palette, five, index, hex\)/, 'the picker must set exactly one slot');
  assert.match(src, /fd\.set\('patch', JSON\.stringify\(\{ events: \{ role_palette: paletteRef\.current \} \}\)\);/, 'the palette must be written into the draft');
  assert.match(src, /makerSave\(\(\) => hubDraftAction\(eventId, fd\)/);
  assert.doesNotMatch(src, /saveRolePalette/, 'the Studio still writes the palette live');
  assert.match(src, /MAIN_COLOUR_JOBS\[index\]/, 'the picker must say what it changed');
  assert.match(src, /undo: \(\) => commit\(before/, 'every picker change must be undoable');
});
