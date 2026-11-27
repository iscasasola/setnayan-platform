/**
 * 💾 ONE SAVE IN EVENT SETTINGS (owner 27 Nov 2026, MASTER-PLAN L3: "The 3 saves in event settings become 1" —
 * the ⚙ sheet showed Apply ✓, "Save basics" and "Save").
 *
 * In the sheet, the basics (`DetailsForm`) and the pricing view (`PaxSettingsCard`) save on their own — the way the
 * governed fields above them already do — so the sheet's one button is the Hub's Apply ✓. Event Details' own page
 * (`record-editor.tsx`) keeps its buttons: it is not the sheet.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const ROOT = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));
const D = 'app/dashboard/[eventId]/details/_components';

test('the ⚙ sheet mounts the settings in their saving-on-their-own form', () => {
  assert.match(read('app/dashboard/[eventId]/_components/event-settings-rows.tsx'), /<EventSettingsEditor [^>]*autoSave \/>/);
  const editor = read(`${D}/event-settings-editor.tsx`);
  assert.match(editor, /autoSave=\{autoSave\}\s*\/>/, 'the basics do not hear the sheet');
  assert.match(editor, /<PaxSettingsCard [^>]*autoSave=\{autoSave\} \/>/, 'the pricing view does not hear the sheet');
  // Event Details' own page is not the sheet — it keeps its buttons.
  assert.doesNotMatch(read(`${D}/record-editor.tsx`), /autoSave/);
});

test('the basics: no "Save basics" in the sheet; a change sends itself after a pause, only when it differs', () => {
  const src = read(`${D}/details-form.tsx`);
  assert.match(src, /\{autoSave \? \(\s*pending \? <span[^>]*>Saving…<\/span> : null\s*\) : \(\s*<button\s*type="submit"/);
  assert.match(src, /if \(shownKey === JSON\.stringify\(savedFields\.current\)\) return;/, 'opening the sheet would save');
  assert.match(src, /window\.setTimeout\(\(\) => sendRef\.current\(true\), 900\)/);
  // Quiet: no full-screen loader on a save nobody pressed; a refusal still says why.
  assert.match(src, /const res = quiet\s*\? await updateEventMatchCriteria\(fd\)/);
  assert.match(src, /setError\(res\.message\)/);
  // The merge guard rides along on every save (two hosts never overwrite each other).
  assert.match(src, /fd\.set\(MERGE_BASE_FIELD, JSON\.stringify\(savedFields\.current\)\);/);
});

test('the pricing view: a pick saves itself in the sheet — no Save button', () => {
  const src = read(`${D}/pax-settings-card.tsx`);
  assert.match(src, /onChange=\{autoSave \? \(e\) => e\.currentTarget\.requestSubmit\(\) : undefined\}/);
  assert.match(src, /\{autoSave \? \(\s*pending \? <span[^>]*>Saving…<\/span> : null\s*\) : \(\s*<button type="submit"/);
  assert.match(src, /const res = autoSave\s*\? await updatePaxSettings\(fd\)/);
});
