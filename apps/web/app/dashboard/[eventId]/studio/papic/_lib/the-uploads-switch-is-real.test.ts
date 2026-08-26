/**
 * GUARD — the uploads switch governs something, and it governs it honestly.
 *
 * Owner 2026-08-26: *"a toggle will set if they will allow people to upload
 * photos manually as well"* and *"uploading can depend on the toggle for photo
 * upload."*
 *
 * ⛔ IT WAS DELIBERATELY NOT BUILT UNTIL THE PICKER EXISTED. A switch with
 * nothing behind it is a gate with no handle — this codebase has found five of
 * those, including a column that sat unread for seven weeks while the feature
 * it controlled was believed to be running. The order was: build the door,
 * then the lock.
 *
 * ⚖ IT DEFAULTS OPEN, and that is a stated choice rather than an accident.
 * Papic's purpose is now the event's media library; a library that refuses the
 * most obvious way to put something in it would be closed against its own
 * point, and an upload costs a credit exactly like a shot — so an open door is
 * not a free one.
 *
 * 🔑 AND THE LIMIT OF THIS GUARD IS WRITTEN DOWN. It checks that the SCREEN
 * obeys the switch, because today the only manual-upload path is the couple's
 * own picker and the only holder of the Uploads camera is the couple — a couple
 * bypassing their own preference harms nobody. **The moment somebody else can
 * upload, hiding a control is not closing a door**, and the server must read
 * this column too. That is the live-photo-wall lesson, where the only "off"
 * switch closed the venue screens while the feed carried on to a hundred
 * phones.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAPIC = dirname(dirname(fileURLToPath(import.meta.url)));
const PAGE = readFileSync(join(PAPIC, 'page.tsx'), 'utf8');
const CHOICE = readFileSync(join(PAPIC, '_components/uploads-open-choice.tsx'), 'utf8');
const ACTIONS = readFileSync(join(PAPIC, 'actions.ts'), 'utf8');

test('the switch exists on all three layers — column, action, control', () => {
  assert.match(ACTIONS, /papic_uploads_open/, 'the action no longer writes the column');
  assert.match(ACTIONS, /export async function setPapicUploadsOpen/, 'the action is gone');
  assert.match(CHOICE, /export function UploadsOpenChoice/, 'the control is gone');
  assert.match(PAGE, /<UploadsOpenChoice/, 'the control is not mounted — an unmounted control is not a control');
});

test('🚨 the switch actually GOVERNS the picker', () => {
  // The failure being guarded is a switch that saves a value nobody reads.
  assert.match(PAGE, /const uploadsOpen =/, 'the page no longer reads the column');
  assert.match(
    PAGE,
    /\{!uploadsOpen \?/,
    'the picker no longer branches on the switch — turning it off would save a value and change nothing a person can see',
  );
});

test('⚠ an absent column means OPEN, never closed', () => {
  // The column lands in 20271170068924. On a pre-migration database the read
  // must not close the library's most obvious door on everybody.
  assert.match(
    PAGE,
    /papic_uploads_open as boolean \| null\) \?\? true/,
    'a missing column no longer falls back to open — every couple on a pre-migration database loses uploading with no explanation',
  );
});

test('🚨 the control posts the value it WANTS, never a flip of what it read', () => {
  // A toggle that flips "whatever it last saw" lands on the opposite of what
  // somebody pressed when the page is stale or they double-tap — and this one
  // decides whether a wedding's gallery can be added to.
  assert.match(CHOICE, /name="open" value=\{open \? '0' : '1'\}/, 'the control no longer posts an explicit target value');
  assert.match(
    ACTIONS,
    /const open = String\(formData\.get\('open'\) \?\? ''\) === '1';/,
    'the action derives the new value from something other than the posted intent',
  );
  assert.ok(!/papic_uploads_open: !/.test(ACTIONS), 'the action negates the current value — that is the flip this rule exists to prevent');
});

test('the copy says what it costs, and what OFF actually means', () => {
  assert.match(CHOICE, /uses a credit/, '"allow uploads" reads like a free door unless the cost is on the same screen');
  assert.match(CHOICE, /Only what your cameras capture/, 'the off state no longer says what it does — a switch whose off position is unexplained gets left on');
});

test('🚨 saving it is confirmed, never silent', () => {
  // Nine settings on this page once saved into the void.
  assert.match(ACTIONS, /uploads_open_set=/, 'the action no longer reports its outcome');
  assert.match(PAGE, /uploadsOpenSet \?/, 'the outcome is emitted and read by nothing — the exact defect the banners guard was written after');
});
