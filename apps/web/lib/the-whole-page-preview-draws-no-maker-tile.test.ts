import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 👁 THE WHOLE-PAGE PREVIEW IS THE PAGE A GUEST GETS — NOTHING OF THE MAKER'S OWN IS ON IT.
 *
 * The walk of 2026-10-11, P10 — hold ▶ on the Invitation: the preview opened on a grey envelope reading "Opens once,
 * over the cover — then every page after it opens plain". That is the Stages toolbar's tile for the Reveal, which it
 * puts INTO the canvas (`stage-tools.tsx`, `[data-maker-reveal-part]`) so the Reveal can be tapped; no guest's page
 * has it. Measured before the fix, in the preview: `html[data-maker-guest]` set, the tile 331 × 182 and
 * `display: block`. The preview's rule (`globals.css`) hid an empty scene's placeholder and nothing else.
 *
 * Everything the Maker ADDS to the canvas for editing is named here with the mark it carries; each must be put away
 * by the preview's rule. A new one added to the canvas without a line here is the gap this test is for.
 */
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
const CSS = read('app', 'globals.css');
const hiddenInPreview = (mark: string) => new RegExp(`html\\[data-maker-guest\\] \\[${mark}\\] \\{ display: none !important; \\}`).test(CSS);

test('the Reveal’s tile and an empty scene’s placeholder are put away while the page is shown as a guest', () => {
  assert.equal(hiddenInPreview('data-maker-reveal-part'), true, 'the Reveal’s tile is drawn in the whole-page preview');
  assert.equal(hiddenInPreview('data-maker-empty'), true, 'an empty scene’s placeholder is drawn in the whole-page preview');
});

test('those marks are the ones the Maker really writes, and the preview really sets its flag', () => {
  /* The tile: created by the toolbar, in the canvas's own document, with this attribute and no display of its own. */
  const tools = read('app', 'dashboard', '[eventId]', 'launch', '_components', 'stage-tools.tsx');
  assert.match(tools, /part = doc\.createElement\('section'\);\s*part\.setAttribute\('data-maker-reveal-part', ''\);/);
  const style = /part\.style\.cssText = '([^']*)';/.exec(tools)?.[1] ?? '';
  assert.ok(style.length > 0 && !/display/.test(style), 'the tile sets its own display inline — the rule could not hide it');
  assert.match(read('app', '[slug]', '_components', 'maker-empty-scene.tsx'), /<section className="[^"]*" data-maker-empty=\{type\}>/);
  /* The flag: set by the bridge for `{ t: 'guest', on: true }`, which is what ▶ held down sends. */
  const bridge = read('app', '[slug]', '_components', 'editor-bridge.tsx');
  assert.match(bridge, /document\.documentElement\.setAttribute\('data-maker-guest', ''\);/);
  assert.match(tools, /postToCanvas\(\{ source: 'setnayan-editor', t: 'guest', on: true \}\);\s*setPreviewing\(true\);/);
});
