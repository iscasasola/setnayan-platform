/**
 * the-rsvp-save-button-edit-has-its-row.test.ts — EVERY RSVP LINE'S EDIT HAS ITS LAST ROW; THE PASS'S SAVE BUTTON TOO.
 *
 * HANDOFF_2026-10-10 §A item 6: "a line's Edit on RSVP has no Earlier/Later/Remove row". Measured in the lab on
 * 2026-10-12 (controller-2026-10-12/maker-polish/walk-*.json, 375 × 812 and 667): every line of the three screens has
 * it (`RsvpLinePlaceRow`, since 2026-10-11) — EXCEPT the pass's Save button, whose Edit was EMPTY: its row used to be
 * the toolbar's own three, and that row went on 2026-10-11 when a scene could be held on the page (owner). The record
 * (`Maker_RSVP_Per_Element_Add_Drag_Group_LOCKED_2026-10-09.md` §3: "Earlier · Later stay"; a grey step says why,
 * never a dead tap) is now true for it too:
 *   (1) its steps are all grey, each with the sentence the controller chose (`RSVP_SAVE_STAYS`'s words);
 *   (2) the RSVP panel draws that row as the Save button's Edit;
 *   (3) the toolbar hands Edit to the panel for it (`own`), without touching the toolbar's pinned line.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { RSVP_LIST_WORDS } from './rsvp-layout-edit';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('(1) the Save button’s steps: all grey, each saying why', async () => {
  const { rsvpSaveSteps } = await import('../app/dashboard/[eventId]/launch/_components/rsvp-line-list');
  const { RSVP_SAVE_STAYS } = await import('../app/dashboard/[eventId]/launch/_components/rsvp-list-stage');
  const s = rsvpSaveSteps();
  assert.deepEqual([s.earlier, s.later, s.group, s.remove, s.ungroup], [null, null, null, null, null], 'a step of the Save button can be taken');
  assert.equal(s.why.earlier, RSVP_SAVE_STAYS.earlier);
  assert.equal(s.why.later, RSVP_SAVE_STAYS.later);
  assert.equal(s.why.remove, RSVP_SAVE_STAYS.remove);
  assert.equal(s.why.group, RSVP_LIST_WORDS.save);
  for (const words of Object.values(s.why)) assert.ok(words.length > 10, 'a grey step says nothing');
});

test('(2) the RSVP panel draws that row as the Save button’s Edit', () => {
  const PANEL = src(`${L}/maker-rsvp-ask.tsx`);
  assert.match(
    PANEL,
    /if \(picked\.tool === 'edit' && picked\.part === 'pass' && picked\.line === 'save'\) \{\s*return \(\s*<div className=\{RSVP_ROWS\} data-rsvp-stage-controls=\{scene\} data-rsvp-stage-rows="" data-rsvp-stage-line-edit="save">\s*<RsvpLinePlaceRow steps=\{rsvpSaveSteps\(\)\} onWhy=\{sayOnToolbar\} \/>/,
    'the Save button’s Edit is empty again',
  );
});

test('(3) the toolbar hands the Save button’s Edit to the panel — its pinned line untouched', () => {
  const STAGE = src(`${L}/rsvp-list-stage.tsx`);
  assert.match(STAGE, /own: meta\.own \|\| \(on && part === 'pass' && line === 'save'\),/);
  assert.match(STAGE, /stays: on && part === 'pass' && line === 'save' \? RSVP_SAVE_STAYS : null,/);
  const TOOLS = src(`${L}/stage-tools.tsx`);
  assert.match(TOOLS, /const rsvpLineTypes = rsvpLineWord\(picked, rsvpLine\) !== null \|\| rsvpList\.own;/);
  assert.match(TOOLS, /data-stage-edit-own=\{rsvpLineTypes && shownTool === 'edit' \? '' : undefined\}/);
});
