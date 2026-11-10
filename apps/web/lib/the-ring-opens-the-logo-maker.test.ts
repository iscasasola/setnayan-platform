/**
 * the-ring-opens-the-logo-maker.test.ts — 💍 THE COVER'S RING OPENS THE LOGO MAKER · ▶ IS "PLAY THIS SCENE".
 *
 * Build 6 Lane F, two of the four picks settled 2026-11-10 (DECISION_LOG "ALL YES — BUILD 5 OPEN CALLS SETTLED"), owner
 * verbatim: *"the cover ring opens the Logo Maker while the rest of the cover opens the cover editor"* · *"▶ 'play this
 * scene' is the 5th thumb button"*. Approved prototypes `maker_scenes_tap_to_edit_2026-11-09` frames 3 · 8 and
 * `event_hub_stages_scenes_2026-11-10` M2 · M3.
 *
 *   (1) THE RING IS THE COVER'S MARK — `logo` on `f:hero` · `el: 'mark'` — and only a tap on it opens an editor at once
 *       (`makerTapOpensEditor`). Every other part of the cover only picks itself: its Edit is the cover's own fields.
 *   (2) THE WIRING — a tap the CANVAS sends (never the toolbar's own pick, heard back) opens the Logo Maker through the
 *       same door Edit's row opens (`onOpenStudio`, with "Done · back to <part>"), and nothing else is asked for.
 *   (3) ▶ — the fifth button of the thumb row, after Edit · Style · Background · Animate, named "Play this scene" while a
 *       scene is picked. Its job is the shipped one (tap plays, hold previews the whole page).
 *
 * Sabotage (2026-11-10, each seen red, then restored): `makerTapOpensEditor` answering 'logo' for `names` → (1) · the ring
 * check moved above `if (e.source === window)` → (2) · the ▶ label back to "Play this part" → (3).
 *
 * Run: cd apps/web && node --import tsx --test lib/the-ring-opens-the-logo-maker.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { MAKER_COVER_RING, MAKER_PARTS, makerTapOpensEditor, type MakerPartKey } from './maker-parts';

const WEB = join(__dirname, '..');
const TOOLS = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/stage-tools.tsx'), 'utf8'));

test('(1) the ring is the cover’s mark, and only a tap on it opens an editor at once', () => {
  assert.equal(MAKER_COVER_RING, 'logo');
  assert.equal(MAKER_PARTS.logo.canvas, 'f:hero', 'the Logo is not on the cover');
  assert.equal(MAKER_PARTS.logo.el, 'mark', 'the Logo is not the cover’s mark');
  assert.equal(MAKER_PARTS.logo.source, 'studio:logo');
  assert.equal(makerTapOpensEditor('logo'), 'logo');
  const keys = Object.keys(MAKER_PARTS) as MakerPartKey[];
  assert.ok(keys.length > 30, 'anti-vacuity: the parts were not found');
  const opening = keys.filter((k) => makerTapOpensEditor(k) !== null);
  assert.deepEqual(opening, ['logo'], 'a tap on something other than the ring opens an editor by itself');
  // The rest of the cover keeps its own Edit — the cover editor (its lines are typed there, the date/place have their door).
  const cover = keys.filter((k) => MAKER_PARTS[k].canvas === 'f:hero' && k !== 'logo');
  assert.ok(cover.length >= 4, 'anti-vacuity: the cover’s other parts were not found');
  for (const k of cover) assert.equal(makerTapOpensEditor(k), null, `${k}: a tap on the cover opens something other than its own Edit`);
  assert.equal(makerTapOpensEditor(null), null);
});

test('(2) a tap the canvas sends opens the Logo Maker through Edit’s own door; the toolbar’s own pick never does', () => {
  const self = TOOLS.indexOf('if (e.source === window) {');
  const ring = TOOLS.indexOf('const opens = makerTapOpensEditor(k);');
  assert.ok(self > 0 && ring > 0, 'anti-vacuity: the canvas listener was not found');
  assert.ok(ring > self, 'the ring is read before the toolbar’s own pick is set aside');
  const selfBranch = TOOLS.slice(self, TOOLS.indexOf('return;\n      }', self));
  assert.doesNotMatch(selfBranch, /makerTapOpensEditor|openEditorRef/, 'the toolbar’s own pick (a swipe, ↑ ↓) opens the Logo Maker');
  assert.match(
    TOOLS,
    /setPicked\(k\);\s*setTapped\(typeof d\.el === 'string' \? d\.el : null\);\s*const opens = makerTapOpensEditor\(k\);\s*if \(opens\) \{\s*setSlotAsk\(null\);\s*openEditorRef\.current\(opens, k\);\s*return;\s*\}/,
    'a tap on the ring does not open its editor at once',
  );
  assert.match(
    TOOLS,
    /openEditorRef\.current = \(tool, part\) => \{\s*resumeAt = \{ stage: stageKey, page: shownPage, part \};\s*onOpenStudio\(tool as StudioTileKey, \{ label: makerPartLabelOn\(stageKey, part\), focus: makerPartStudioDoor\(part\)\?\.focus \?\? null \}\);\s*\};/,
    'the ring does not use Edit’s own door (with its way back)',
  );
});

test('(3) ▶ is the fifth thumb button, "Play this scene"', () => {
  /* Read from the source: the module carries server-only imports a unit test cannot load. */
  assert.match(TOOLS, /export const STAGE_PLAY_SCENE = 'Play this scene';/);
  assert.match(TOOLS, /aria-label=\{playing \? 'Stop' : `\$\{picked \? STAGE_PLAY_SCENE : 'Play the stage as guests see it'\} — hold, or press Shift and Enter, to preview the whole page`\}/);
  assert.doesNotMatch(TOOLS, /Play this part/, 'the ▶ still says “part”');
  // Fifth: right after the four tools' group.
  const group = TOOLS.indexOf('<span role="group" aria-label="Edit with"');
  const play = TOOLS.indexOf('data-stage-play=""');
  assert.ok(group > 0 && play > group, 'anti-vacuity: the thumb row was not found');
  const between = TOOLS.slice(group, play);
  assert.equal((between.match(/<\/span>\s*<button/g) ?? []).length, 1, '▶ is not the button right after Edit · Style · Background · Animate');
});
