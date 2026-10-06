/**
 * 🎨 ONE MAIN COLOUR WAITS FOR APPLY (owner 2026-10-06: *"the five Mood Board
 * colours, each with its job … editable here — one palette, not a copy"*;
 * approved 2026-10-07 "THE MISSING FIELDS ARE APPROVED").
 *
 * Holds: the draft accepts one colour by slot (and nothing else); the host's
 * canvas lays it INTO the board's main colours, every other key kept, a short
 * board completed from the theme; a slot equal to live is no change; it is
 * never Pro; it is named on the Apply sheet; Apply writes it into the board as
 * it stands — never through the session `events` UPDATE as a column.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { boardWithMainColours, mainColourSlotsOf, mainColoursOf, sanitizeMainColourDraft } from './main-colours';
import { themeSeedPalette } from './mood-board-palette-set';
import { HUB_DRAFT_MAIN_COLOURS, eventColumnChange, eventItemIsPro, overlayHubDraftEvent, sanitizeHubDraftEventValue } from './hub-draft';
import { HUB_DRAFT_EVENT_PLACE } from './hub-draft-change-lines';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const BOARD = { reception: ['#111111', '#222222', '#333333', '#444444', '#555555'], ceremony: ['#AAAAAA'], room: { flowers: true } };

test('the draft takes a colour by slot, and nothing else', () => {
  assert.deepEqual(sanitizeMainColourDraft({ 2: '#abcdef' }), { 2: '#ABCDEF' });
  for (const bad of [{ 5: '#abcdef' }, { 2: 'red' }, { reception: ['#abcdef'] }, [], {}, null]) {
    assert.equal(sanitizeMainColourDraft(bad), undefined, `${JSON.stringify(bad)} was accepted`);
  }
  assert.equal(sanitizeHubDraftEventValue(HUB_DRAFT_MAIN_COLOURS, null), undefined, 'a colour is never cleared from here');
});

test('laid INTO the board: one slot moves, every other key stays; a short board is completed', () => {
  const next = boardWithMainColours(BOARD, { 2: '#ABCDEF' }, 'house');
  assert.deepEqual(next.reception, ['#111111', '#222222', '#ABCDEF', '#444444', '#555555']);
  assert.deepEqual(next.ceremony, ['#AAAAAA']);
  assert.deepEqual(next.room, { flowers: true });
  const seed = themeSeedPalette('house').reception;
  assert.deepEqual(boardWithMainColours({}, { 0: '#ABCDEF' }, 'house').reception, ['#ABCDEF', ...seed.slice(1)]);
  assert.deepEqual(mainColoursOf(null, 'house'), seed, 'no board = the theme’s five');
  const row = overlayHubDraftEvent({ role_palette: BOARD, invite_theme: 'house' } as Record<string, unknown>, { events: { main_colours: { 4: '#FEFEFE' } }, widgets: {} });
  assert.equal((row.role_palette as { reception: string[] }).reception[4], '#FEFEFE');
  assert.equal(HUB_DRAFT_MAIN_COLOURS in row, false, 'the pseudo-column leaked onto the row');
});

test('a slot equal to live is no change; a colour is never Pro; it is named', () => {
  const live = mainColourSlotsOf(BOARD, 'house');
  assert.equal(eventColumnChange(HUB_DRAFT_MAIN_COLOURS, live, { 1: '#222222' }), 'none');
  assert.equal(eventColumnChange(HUB_DRAFT_MAIN_COLOURS, live, { 1: '#123456' }), 'change');
  assert.equal(eventItemIsPro(HUB_DRAFT_MAIN_COLOURS, { 1: '#123456' }, 'change'), false);
  assert.deepEqual(HUB_DRAFT_EVENT_PLACE.main_colours, { place: 'Look', what: 'Colours' });
});

test('Apply lays it into the board as it stands, never as an events column', () => {
  const src = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(src, /delete eventsPatch\[HUB_DRAFT_MAIN_COLOURS\];/);
  assert.match(src, /\.update\(\{ role_palette: boardWithMainColours\(board\.role_palette, mainColoursWrite, board\.invite_theme\) \}\)/);
  assert.match(read('lib/hub-draft-store.ts'), /main_colours: mainColourSlotsOf\(/);
  const tools = read('app/dashboard/[eventId]/launch/_components/studio-tools.tsx');
  assert.match(tools, /draftPatch\(eventId, \{ events: \{ main_colours: nextSlots \} \}\)/);
});
