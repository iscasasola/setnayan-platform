/**
 * THE AI PRICES SCREEN CANNOT SAVE OVER A HALF-READ PRICE LIST.
 *
 * When a read of the price bands or the event kinds fails, the screen draws what it
 * could read, which may be incomplete. Before the clean port, a red box said "don't
 * save from here until it loads cleanly". The port first moved that sentence behind
 * an ⓘ (controller review of #8018), so an admin could press Save on a half-read
 * list without ever seeing the warning.
 *
 * Pinned here:
 *   1. the warning is a VISIBLE line (TemplateFail), not inside an InfoTip;
 *   2. the surface hands `locked={unreadable}` to the editor;
 *   3. in the editor, every write button (Save on a band price, Move a kind) is
 *      `disabled={locked}`, and the flag reaches both forms.
 * Comments are stripped, so this docblock cannot satisfy any assertion.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const here = dirname(fileURLToPath(import.meta.url));
const surface = stripComments(readFileSync(join(here, '_surfaces/ai-prices-surface.tsx'), 'utf8'));
const editor = stripComments(readFileSync(join(here, '_components/ai-bands-editor.tsx'), 'utf8'));

test('the "don\'t save" warning is a visible line, not hidden behind an ⓘ', () => {
  const fail = surface.match(/<TemplateFail[\s\S]*?<\/TemplateFail>/);
  assert.ok(fail, 'the unreadable state must draw a TemplateFail line');
  assert.match(fail[0], /don&apos;t save from here until it loads cleanly/);
  assert.doesNotMatch(fail[0], /<InfoTip/, 'the warning must not sit inside an InfoTip');
});

test('the surface locks the editor while the prices are unreadable', () => {
  assert.match(surface, /<AiBandsEditor[\s\S]*?locked=\{unreadable\}[\s\S]*?\/>/);
});

test('every write button in the editor is off while locked', () => {
  // Whole tags: the icon prop holds its own `<Icon … />`, so read up to the label and the tag's own `/>`.
  const buttons = (editor.match(/<ActionButton\b[\s\S]*?label="[^"]*"[^/]*\/>/g) ?? []).filter((b) => b.includes('type="submit"'));
  assert.ok(buttons.length >= 2, `expected the Save and Move submit buttons, found ${buttons.length}`);
  for (const b of buttons) {
    assert.match(b, /disabled=\{locked\}/, `a submit button can still save while unreadable: ${b}`);
  }
  // The flag must actually reach the per-band card and the price field, not just be declared.
  assert.match(editor, /<BandCard[\s\S]*?locked=\{locked\}[\s\S]*?\/>/);
  assert.match(editor, /<BandPriceField[\s\S]*?locked=\{locked\}[\s\S]*?\/>/);
});
