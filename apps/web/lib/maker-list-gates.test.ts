import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MakerStageList } from './maker-scene-list';
import { gatedSceneShows, listWithGates } from './maker-list-gates';

/**
 * 🗑 REMOVE, THEN ＋ — the scene taken off a moment ago is offered back.
 *
 * Measured 2026-10-11 at 375 px: Remove on the Message ("Message removed from this page"), then ＋ on the Countdown
 * → "Every part is already on this page." The eye's save is held (no render of the Maker follows), and the ＋ sheet
 * read the last render's list. After: the same two taps offer "WORDS · Message", and it lands back in place
 * (`hub-walk/maker-fixes/shots/AFTER-P02-4-add-sheet.png`, `…-5-brought-back.png`).
 */
const LIST: MakerStageList = {
  stage: 'rsvp',
  shown: [
    { kind: 'fixed', key: 'f:hero', fixed: 'hero', label: 'Names & date', why: '' },
    { kind: 'scene', key: 'w:countdown', widgetId: 'w-countdown', type: 'countdown', label: 'Countdown' },
    { kind: 'scene', key: 'w:special_message', widgetId: 'w-special_message', type: 'special_message', label: 'Special message' },
  ] as MakerStageList['shown'],
  folded: [{ key: 'w:our_photos', widgetId: 'w-our_photos', type: 'our_photos', label: 'Photos you add', reason: 'Not on this stage.', hiddenByCouple: false }],
};
const scene = (id: string, mode: 'auto' | 'shown' | 'hidden', isVisible: boolean) => ({ id, mode, isVisible });

test('a scene the couple just took off is folded, hidden by the couple — what ＋ offers back', () => {
  const after = listWithGates(LIST, [scene('w-countdown', 'auto', true), scene('w-special_message', 'auto', false)]);
  assert.deepEqual(after.shown.map((t) => t.key), ['f:hero', 'w:countdown']);
  const back = after.folded.find((f) => f.key === 'w:special_message');
  assert.ok(back, 'the removed scene is not offered');
  assert.equal(back.hiddenByCouple, true);
  assert.equal(back.widgetId, 'w-special_message', 'the eye has no row to bring back');
  assert.equal(back.label, 'Special message');
  /* What the render already folded is left exactly as it was. */
  assert.deepEqual(after.folded[0], LIST.folded[0]);
  /* Auto · Hidden takes it off the same way the eye does. */
  assert.equal(listWithGates(LIST, [scene('w-special_message', 'hidden', true)]).folded.some((f) => f.key === 'w:special_message' && f.hiddenByCouple), true);
});

test('nothing off → the very same list; a fixed part is never folded; "Shown" beats a closed eye', () => {
  assert.equal(listWithGates(LIST, [scene('w-countdown', 'auto', true), scene('w-special_message', 'auto', true)]), LIST);
  assert.equal(listWithGates(LIST, []), LIST);
  /* An id that is not a scene tile of this list changes nothing. */
  assert.equal(listWithGates(LIST, [scene('w-elsewhere', 'auto', false)]), LIST);
  assert.equal(listWithGates(LIST, [scene('w-special_message', 'shown', false)]), LIST);
});

test('"is it on the page?" is the work area’s own two-gate rule, word for word', () => {
  for (const [mode, isVisible, want] of [['hidden', true, false], ['hidden', false, false], ['shown', false, true], ['shown', true, true], ['auto', true, true], ['auto', false, false]] as const)
    assert.equal(gatedSceneShows({ mode, isVisible }), want, `${mode} · ${isVisible}`);
  /* If the work area's rule changes, this one must — they are the same question. */
  const shell = readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'editor-shell.tsx'), 'utf8');
  assert.match(shell, /export function sceneShowing\(scene: Pick<MakerScene, 'mode' \| 'isVisible'>\): boolean \{\s*if \(scene\.mode === 'hidden'\) return false;\s*if \(scene\.mode === 'shown'\) return true;\s*return scene\.isVisible;\s*\}/);
});

test('the ＋ sheet reads the list through it', () => {
  const sheet = readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'launch', '_components', 'add-part-sheet.tsx'), 'utf8');
  assert.match(sheet, /list: listWithGates\(raw\.list, raw\.scenes\),/);
  assert.doesNotMatch(sheet, /^\s*list: raw\.list,/m, 'the sheet reads the last render’s list again');
});
